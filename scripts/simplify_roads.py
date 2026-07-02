"""Simplify Wuhan roads by retaining endpoints and approximate intersections."""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path


DEFAULT_ALLOWED = {"trunk", "primary", "secondary", "tertiary"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default="public/data/wuhan-roads.geojson")
    parser.add_argument("--output", default="public/data/wuhan-roads-simplified.geojson")
    parser.add_argument("--tolerance", type=float, default=0.0001, help="Coordinate grid tolerance, about 10m.")
    parser.add_argument(
        "--allowed",
        default=",".join(sorted(DEFAULT_ALLOWED)),
        help="Comma-separated road classes to keep.",
    )
    return parser.parse_args()


def grid_key(coord: list[float], tolerance: float) -> tuple[int, int]:
    return (round(coord[0] / tolerance), round(coord[1] / tolerance))


def iter_lines(geometry: dict) -> list[list[list[float]]]:
    if geometry.get("type") == "LineString":
        return [geometry.get("coordinates", [])]
    if geometry.get("type") == "MultiLineString":
        return geometry.get("coordinates", [])
    return []


def main() -> None:
    args = parse_args()
    allowed = {item.strip() for item in args.allowed.split(",") if item.strip()}
    input_path = Path(args.input)
    output_path = Path(args.output)

    print("1. Loading roads...")
    geojson = json.loads(input_path.read_text(encoding="utf-8"))

    grid_to_roads: dict[tuple[int, int], list[tuple[tuple[float, float], int]]] = defaultdict(list)
    roads = []
    original_segments = 0

    for feature in geojson.get("features", []):
        fclass = feature.get("properties", {}).get("fclass")
        if fclass not in allowed:
            continue

        for line in iter_lines(feature.get("geometry", {})):
            if len(line) < 2:
                continue
            road_index = len(roads)
            for coord in line:
                grid_to_roads[grid_key(coord, args.tolerance)].append((tuple(coord), road_index))
            original_segments += len(line) - 1
            roads.append({"coords": line, "properties": feature.get("properties", {})})

    intersection_grids = {
        key
        for key, entries in grid_to_roads.items()
        if len({road_index for _, road_index in entries}) >= 2
    }

    simplified = []
    simplified_segments = 0
    for road in roads:
        coords = road["coords"]
        kept = []
        for index, coord in enumerate(coords):
            if index == 0 or index == len(coords) - 1 or grid_key(coord, args.tolerance) in intersection_grids:
                kept.append(coord)
        if len(kept) < 2:
            continue
        simplified_segments += len(kept) - 1
        simplified.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": kept},
            "properties": road["properties"],
        })

    avg_segment_m = (
        sum(
            math.dist(line[i], line[i + 1]) * 111000
            for feature in simplified
            for line in [feature["geometry"]["coordinates"]]
            for i in range(len(line) - 1)
        )
        / max(simplified_segments, 1)
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps({"type": "FeatureCollection", "features": simplified}, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"   roads kept: {len(roads)}")
    print(f"   segments: {original_segments} -> {simplified_segments}")
    print(f"   average simplified segment: {avg_segment_m:.0f}m")
    print(f"2. Wrote {output_path} ({output_path.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
