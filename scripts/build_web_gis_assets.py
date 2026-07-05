"""Build lightweight WebGIS assets from the prepared Wuhan marathon GIS package."""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path
from typing import Any


ROOT = Path(r"E:\SuperMap")
PREPARED = ROOT / "data" / "processed" / "wuhan_marathon" / "web_geojson"
WEB_PUBLIC = ROOT / "超图" / "Supermap_marathon_web" / "public" / "data"
WEB_GIS = WEB_PUBLIC / "gis"

ROAD_SOURCE = PREPARED / "road_network_osm.geojson"
ROUTE_SOURCE = WEB_PUBLIC / "wuhan-marathon-routes.geojson"

AREA_BOUNDS = {
    "minLon": 114.235,
    "minLat": 30.525,
    "maxLon": 114.475,
    "maxLat": 30.652,
}
CORRIDOR_KM = 1.5

COPY_LAYERS = [
    "park_green_osm.geojson",
    "constraint_water_area.geojson",
    "constraint_water_line.geojson",
    "constraint_sensitive_hospital_area.geojson",
    "constraint_sensitive_school_area.geojson",
    "poi_commercial_potential_area.geojson",
    "poi_traffic_station_area.geojson",
]


def load_geojson(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_geojson(path: Path, features: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def iter_lines(geometry: dict[str, Any] | None) -> list[list[list[float]]]:
    if not geometry:
        return []
    if geometry.get("type") == "LineString":
        coordinates = geometry.get("coordinates", [])
        return [coordinates] if isinstance(coordinates, list) else []
    if geometry.get("type") == "MultiLineString":
        coordinates = geometry.get("coordinates", [])
        return coordinates if isinstance(coordinates, list) else []
    return []


def in_area(coord: list[float]) -> bool:
    lon, lat = coord[:2]
    return (
        AREA_BOUNDS["minLon"] <= lon <= AREA_BOUNDS["maxLon"]
        and AREA_BOUNDS["minLat"] <= lat <= AREA_BOUNDS["maxLat"]
    )


def project_km(coord: list[float], origin_lat: float) -> tuple[float, float]:
    lon, lat = coord[:2]
    return (lon * 111.32 * math.cos(math.radians(origin_lat)), lat * 110.574)


def point_segment_distance_km(point: list[float], start: list[float], end: list[float]) -> float:
    origin_lat = point[1]
    px, py = project_km(point, origin_lat)
    ax, ay = project_km(start, origin_lat)
    bx, by = project_km(end, origin_lat)
    dx = bx - ax
    dy = by - ay
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def line_near_route(line: list[list[float]], route_segments: list[tuple[list[float], list[float]]]) -> bool:
    for coord in line:
        if not in_area(coord):
            continue
        if any(point_segment_distance_km(coord, start, end) <= CORRIDOR_KM for start, end in route_segments):
            return True
    return False


def route_segments() -> list[tuple[list[float], list[float]]]:
    if not ROUTE_SOURCE.exists():
        return []
    segments: list[tuple[list[float], list[float]]] = []
    for feature in load_geojson(ROUTE_SOURCE).get("features", []):
        for line in iter_lines(feature.get("geometry")):
            for index in range(len(line) - 1):
                segments.append((line[index], line[index + 1]))
    return segments


def normalize_properties(properties: dict[str, Any]) -> dict[str, Any]:
    bridge = properties.get("bridge")
    tunnel = properties.get("tunnel")
    is_bridge = properties.get("is_bridge")
    is_tunnel = properties.get("is_tunnel")
    fclass = properties.get("fclass") or properties.get("highway") or properties.get("road_level") or ""
    return {
        "osm_id": properties.get("osm_id"),
        "name": properties.get("name") or "",
        "fclass": fclass,
        "highway": properties.get("highway") or fclass,
        "road_level": properties.get("road_level") or fclass,
        "is_arterial": properties.get("is_arterial", 0),
        "bridge": bridge if bridge is not None else ("yes" if is_bridge else "no"),
        "tunnel": tunnel if tunnel is not None else ("yes" if is_tunnel else "no"),
        "is_bridge": is_bridge if is_bridge is not None else int(str(bridge).upper() == "T"),
        "is_tunnel": is_tunnel if is_tunnel is not None else int(str(tunnel).upper() == "T"),
        "is_greenway": properties.get("is_greenway", 0),
        "control_ok": properties.get("control_ok"),
        "impedance": properties.get("impedance"),
        "suitability": properties.get("suitability"),
        "slope_mean": properties.get("slope_mean"),
    }


def rounded_geometry(geometry: dict[str, Any]) -> dict[str, Any]:
    def round_coord(coord: list[float]) -> list[float]:
        return [round(float(coord[0]), 6), round(float(coord[1]), 6)]

    if geometry.get("type") == "LineString":
        return {"type": "LineString", "coordinates": [round_coord(coord) for coord in geometry.get("coordinates", [])]}
    if geometry.get("type") == "MultiLineString":
        return {
            "type": "MultiLineString",
            "coordinates": [
                [round_coord(coord) for coord in line]
                for line in geometry.get("coordinates", [])
            ],
        }
    return geometry


def make_web_road_assets() -> tuple[int, int]:
    roads = load_geojson(ROAD_SOURCE)
    segments = route_segments()
    full_features: list[dict[str, Any]] = []
    area_features: list[dict[str, Any]] = []
    corridor_features: list[dict[str, Any]] = []

    for feature in roads.get("features", []):
        geometry = feature.get("geometry")
        lines = iter_lines(geometry)
        if not lines:
            continue
        web_feature = {
            "type": "Feature",
            "geometry": rounded_geometry(geometry),
            "properties": normalize_properties(feature.get("properties") or {}),
        }
        full_features.append(web_feature)

        if not any(any(in_area(coord) for coord in line) for line in lines):
            continue

        area_features.append(web_feature)

        if segments and any(line_near_route(line, segments) for line in lines):
            corridor_features.append(web_feature)

    if not corridor_features:
        corridor_features = area_features

    write_geojson(WEB_PUBLIC / "local-wuhan-road-network-osm.geojson", full_features)
    write_geojson(WEB_PUBLIC / "local-wuhan-marathon-area-roads.geojson", area_features)
    write_geojson(WEB_PUBLIC / "local-wuhan-marathon-corridor-roads.geojson", corridor_features)
    return len(full_features), len(area_features), len(corridor_features)


def copy_reference_layers() -> list[str]:
    WEB_GIS.mkdir(parents=True, exist_ok=True)
    copied: list[str] = []
    for name in COPY_LAYERS:
        source = PREPARED / name
        if source.exists():
            shutil.copy2(source, WEB_GIS / name)
            copied.append(name)
    return copied


def main() -> None:
    full_count, area_count, corridor_count = make_web_road_assets()
    copied = copy_reference_layers()
    print(f"full roads: {full_count}")
    print(f"area roads: {area_count}")
    print(f"corridor roads: {corridor_count}")
    print(f"reference layers copied: {len(copied)}")
    for name in copied:
        print(f"  - {name}")


if __name__ == "__main__":
    main()
