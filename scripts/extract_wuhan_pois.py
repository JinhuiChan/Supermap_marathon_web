"""Extract marathon-relevant Wuhan POIs from a Geofabrik-style OSM shapefile package."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import fiona
from shapely.geometry import shape
from shapely.prepared import prep


CATEGORY_MAP = {
    "hospital": "medical",
    "park": "park",
    "recreation_ground": "park",
    "viewpoint": "scenic",
    "attraction": "scenic",
    "museum": "scenic",
    "memorial": "scenic",
    "theme_park": "scenic",
    "zoo": "scenic",
    "railway_station": "transit",
    "bus_station": "transit",
    "ferry_terminal": "transit",
    "supermarket": "supply",
    "convenience": "supply",
    "toilet": "supply",
    "marketplace": "supply",
    "mall": "supply",
    "hotel": "supply",
    "drinking_water": "supply",
}

LAYERS = [
    "gis_osm_pois_free_1.shp",
    "gis_osm_pois_a_free_1.shp",
    "gis_osm_transport_free_1.shp",
    "gis_osm_landuse_a_free_1.shp",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shp-dir", required=True, help="Directory containing gis_osm_* shapefiles.")
    parser.add_argument("--admin-osm-id", default="3076268", help="OSM admin area id for Wuhan.")
    parser.add_argument("--output", default="public/data/wuhan-pois.geojson")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    shp_dir = Path(args.shp_dir)
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
    stats: dict[str, int] = {}

    print("2. Extracting POIs...")
    for layer_name in LAYERS:
        layer_path = shp_dir / layer_name
        if not layer_path.exists():
            continue

        layer_count = 0
        with fiona.open(layer_path) as source:
            for feature in source:
                fclass = feature["properties"].get("fclass", "")
                category = CATEGORY_MAP.get(fclass)
                if not category:
                    continue

                geometry = shape(feature["geometry"])
                if not prepared_wuhan.intersects(geometry):
                    continue

                if geometry.geom_type in ("Polygon", "MultiPolygon"):
                    point = geometry.centroid
                elif geometry.geom_type == "Point":
                    point = geometry
                else:
                    continue

                features.append({
                    "type": "Feature",
                    "geometry": json.loads(json.dumps(point.__geo_interface__)),
                    "properties": {
                        "category": category,
                        "fclass": fclass,
                        "name": feature["properties"].get("name") or "",
                    },
                })
                layer_count += 1
                stats[category] = stats.get(category, 0) + 1
        print(f"   {layer_name}: +{layer_count}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"   total: {len(features)} POIs")
    for category, count in sorted(stats.items()):
        print(f"   {category}: {count}")
    print(f"3. Wrote {output_path} ({output_path.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
