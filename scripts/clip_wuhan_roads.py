"""Clip Wuhan road features from a Geofabrik-style OSM shapefile package."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import fiona
from shapely.geometry import shape
from shapely.prepared import prep


FCLASS_MAP = {
    "motorway": "motorway",
    "motorway_link": "motorway",
    "trunk": "trunk",
    "trunk_link": "trunk",
    "primary": "primary",
    "primary_link": "primary",
    "secondary": "secondary",
    "secondary_link": "secondary",
    "tertiary": "tertiary",
    "tertiary_link": "tertiary",
    "residential": "residential",
    "unclassified": "residential",
    "living_street": "residential",
    "road": "residential",
    "unknown": "residential",
    "service": "service",
    "track": "track",
    "footway": "track",
    "path": "track",
    "pedestrian": "track",
    "steps": "track",
    "bridleway": "track",
    "cycleway": "greenway",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shp-dir", required=True, help="Directory containing gis_osm_* shapefiles.")
    parser.add_argument("--admin-osm-id", default="3076268", help="OSM admin area id for Wuhan.")
    parser.add_argument("--output", default="public/data/wuhan-roads.geojson")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    shp_dir = Path(args.shp_dir)
    roads_path = shp_dir / "gis_osm_roads_free_1.shp"
    admin_path = shp_dir / "gis_osm_adminareas_a_free_1.shp"
    output_path = Path(args.output)

    print("1. Reading Wuhan boundary...")
    with fiona.open(admin_path) as source:
      for feature in source:
          if str(feature["properties"]["osm_id"]) == str(args.admin_osm_id):
              wuhan_polygon = shape(feature["geometry"])
              print(f"   Wuhan admin feature: {feature['properties'].get('name', '')}")
              break
      else:
          raise RuntimeError(f"Admin area {args.admin_osm_id} not found")

    prepared_wuhan = prep(wuhan_polygon)
    features = []
    road_counts: dict[str, int] = {}
    total = 0

    print("2. Clipping roads...")
    with fiona.open(roads_path) as source:
        for feature in source:
            total += 1
            if total % 50000 == 0:
                print(f"   processed {total}, selected {len(features)}")

            geometry = shape(feature["geometry"])
            if not prepared_wuhan.intersects(geometry):
                continue

            try:
                clipped = geometry.intersection(wuhan_polygon)
            except Exception:
                continue
            if clipped.is_empty:
                continue

            properties = feature["properties"]
            mapped = FCLASS_MAP.get(properties.get("fclass", ""), "residential")
            road_counts[mapped] = road_counts.get(mapped, 0) + 1
            features.append({
                "type": "Feature",
                "geometry": json.loads(json.dumps(clipped.__geo_interface__)),
                "properties": {
                    "osm_id": properties.get("osm_id"),
                    "fclass": mapped,
                    "name": properties.get("name") or "",
                    "bridge": properties.get("bridge") == "T",
                    "tunnel": properties.get("tunnel") == "T",
                },
            })

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"   Hubei roads: {total} -> Wuhan roads: {len(features)}")
    for level, count in sorted(road_counts.items()):
        print(f"   {level}: {count}")
    print(f"3. Wrote {output_path} ({output_path.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
