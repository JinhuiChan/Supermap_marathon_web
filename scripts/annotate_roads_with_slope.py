"""Annotate Web road GeoJSON with raster-derived slope impedance.

The script samples the Wuhan 30 m slope raster along each road feature and writes
route-planning fields consumed by the web graph builder:

- slope_mean / slope_max / slope_p85
- slope_sample_count / slope_source
- base_impedance / slope_impedance / constraint_impedance
- impedance / suitability
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import rasterio


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SLOPE_RASTER = Path(
    r"E:\SuperMap\data\dataset\dataset\武汉市_30米分辨率坡度数据\武汉市_30米分辨率的坡度数据.tif"
)
DEFAULT_ROAD_FILES = [
    REPO_ROOT / "public" / "data" / "local-wuhan-road-network-osm.geojson",
    REPO_ROOT / "public" / "data" / "local-wuhan-marathon-area-roads.geojson",
    REPO_ROOT / "public" / "data" / "local-wuhan-marathon-corridor-roads.geojson",
]
SLOPE_SOURCE = "wuhan_30m_slope_tif"
SAMPLE_SPACING_KM = 0.09


Coordinate = tuple[float, float]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slope-raster", type=Path, default=DEFAULT_SLOPE_RASTER)
    parser.add_argument("--road-file", type=Path, action="append", dest="road_files")
    parser.add_argument("--sample-spacing-km", type=float, default=SAMPLE_SPACING_KM)
    args = parser.parse_args()

    road_files = args.road_files or DEFAULT_ROAD_FILES
    with rasterio.open(args.slope_raster) as slope_ds:
      for road_file in road_files:
          stats = annotate_road_file(road_file, slope_ds, args.sample_spacing_km)
          print(
              f"{road_file.name}: {stats['features']} features, "
              f"{stats['annotated']} annotated, {stats['samples']} raster samples"
          )


def annotate_road_file(path: Path, slope_ds: rasterio.DatasetReader, sample_spacing_km: float) -> dict[str, int]:
    data = json.loads(path.read_text(encoding="utf-8"))
    features = data.get("features", [])
    annotated = 0
    sample_total = 0

    for feature in features:
        properties = feature.setdefault("properties", {})
        lines = iter_lines(feature.get("geometry"))
        samples = sample_slope_percent_values(slope_ds, lines, sample_spacing_km)
        if samples.size == 0:
            clear_slope_fields(properties)
            continue

        slope_mean = float(np.mean(samples))
        slope_max = float(np.max(samples))
        slope_p85 = float(np.percentile(samples, 85))
        base_impedance = road_base_impedance(properties)
        slope_impedance = slope_resistance_penalty(slope_p85)
        constraint_impedance = 0.0 if control_ok(properties) else 80.0
        impedance = min(100.0, base_impedance + slope_impedance + constraint_impedance)

        properties.update(
            {
                "slope_mean": round(slope_mean, 3),
                "slope_max": round(slope_max, 3),
                "slope_p85": round(slope_p85, 3),
                "slope_sample_count": int(samples.size),
                "slope_source": SLOPE_SOURCE,
                "base_impedance": round(base_impedance, 3),
                "slope_impedance": round(slope_impedance, 3),
                "constraint_impedance": round(constraint_impedance, 3),
                "impedance": round(impedance, 3),
                "suitability": round(max(0.0, 100.0 - impedance), 3),
            }
        )
        annotated += 1
        sample_total += int(samples.size)

    path.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return {"features": len(features), "annotated": annotated, "samples": sample_total}


def iter_lines(geometry: dict[str, Any] | None) -> list[list[Coordinate]]:
    if not geometry:
        return []
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if geometry_type == "LineString" and isinstance(coordinates, list):
        line = normalize_line(coordinates)
        return [line] if len(line) > 1 else []
    if geometry_type == "MultiLineString" and isinstance(coordinates, list):
        return [
            line
            for raw_line in coordinates
            if isinstance(raw_line, list)
            for line in [normalize_line(raw_line)]
            if len(line) > 1
        ]
    return []


def normalize_line(raw_line: Iterable[Any]) -> list[Coordinate]:
    line: list[Coordinate] = []
    for item in raw_line:
        if not isinstance(item, list) or len(item) < 2:
            continue
        lon, lat = item[0], item[1]
        if isinstance(lon, (int, float)) and isinstance(lat, (int, float)):
            line.append((float(lon), float(lat)))
    return line


def sample_slope_percent_values(
    slope_ds: rasterio.DatasetReader,
    lines: list[list[Coordinate]],
    sample_spacing_km: float,
) -> np.ndarray:
    points: list[Coordinate] = []
    for line in lines:
        points.extend(sample_line(line, sample_spacing_km))
    if not points:
        return np.array([], dtype=np.float32)

    values: list[float] = []
    nodata = slope_ds.nodata
    for sample in slope_ds.sample(points):
        value = float(sample[0])
        if nodata is not None and math.isclose(value, float(nodata), rel_tol=0, abs_tol=1e-6):
            continue
        if not math.isfinite(value):
            continue
        if value < 0 or value > 90:
            continue
        values.append(degrees_to_percent(value))
    return np.array(values, dtype=np.float32)


def sample_line(line: list[Coordinate], sample_spacing_km: float) -> list[Coordinate]:
    points: list[Coordinate] = []
    for start, end in zip(line, line[1:]):
        length_km = haversine_km(start, end)
        steps = max(1, math.ceil(length_km / sample_spacing_km))
        for index in range(steps + 1):
            ratio = index / steps
            points.append(
                (
                    start[0] + (end[0] - start[0]) * ratio,
                    start[1] + (end[1] - start[1]) * ratio,
                )
            )
    return dedupe_points(points)


def dedupe_points(points: list[Coordinate]) -> list[Coordinate]:
    seen: set[tuple[int, int]] = set()
    output: list[Coordinate] = []
    for lon, lat in points:
        key = (round(lon * 1_000_000), round(lat * 1_000_000))
        if key in seen:
            continue
        seen.add(key)
        output.append((lon, lat))
    return output


def degrees_to_percent(degrees: float) -> float:
    return math.tan(math.radians(abs(degrees))) * 100.0


def haversine_km(a: Coordinate, b: Coordinate) -> float:
    radius_km = 6371.0
    d_lat = math.radians(b[1] - a[1])
    d_lon = math.radians(b[0] - a[0])
    lat1 = math.radians(a[1])
    lat2 = math.radians(b[1])
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    return 2 * radius_km * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def road_base_impedance(properties: dict[str, Any]) -> float:
    level = str(properties.get("road_level") or properties.get("highway") or properties.get("fclass") or "").lower()
    if level in {"trunk", "primary"}:
        return 8.0
    if level == "secondary":
        return 12.0
    if level == "tertiary":
        return 18.0
    if level in {"cycleway", "footway", "path", "pedestrian", "greenway"}:
        return 20.0
    if level in {"residential", "unclassified", "living_street"}:
        return 30.0
    if level == "service":
        return 42.0
    if level == "track":
        return 52.0
    if level == "motorway":
        return 72.0
    return 34.0


def slope_resistance_penalty(slope_percent: float) -> float:
    slope = abs(slope_percent)
    if slope <= 1.5:
        return 0.0
    if slope <= 3:
        return round((slope - 1.5) * 8)
    if slope <= 6:
        return round(12 + (slope - 3) * 12)
    return round(48 + min(52, (slope - 6) * 10))


def control_ok(properties: dict[str, Any]) -> bool:
    value = properties.get("control_ok")
    if value in {True, 1, "1", "true", "yes", "T", "t"}:
        return True
    if value in {False, 0, "0", "false", "no", "F", "f"}:
        return False
    level = str(properties.get("road_level") or properties.get("highway") or properties.get("fclass") or "").lower()
    return level in {"trunk", "primary", "secondary", "tertiary"}


def clear_slope_fields(properties: dict[str, Any]) -> None:
    for key in [
        "slope_mean",
        "slope_max",
        "slope_p85",
        "slope_sample_count",
        "slope_source",
        "slope_impedance",
    ]:
        properties.pop(key, None)


if __name__ == "__main__":
    main()
