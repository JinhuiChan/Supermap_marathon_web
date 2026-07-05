# Wuhan GIS Assets

Generated on 2026-07-05 from `E:\SuperMap\data\processed\wuhan_marathon`.

## Files Used By The App

| File | Purpose |
| --- | --- |
| `public\data\local-wuhan-marathon-corridor-roads.geojson` | Current interactive road network loaded by the app. It contains 6610 road features around the marathon corridor. |
| `public\data\local-wuhan-marathon-area-roads.geojson` | Wider Wuhan core-area road network with 9771 road features. |
| `public\data\gis\*.geojson` | Reference GIS layers for parks, water, sensitive areas, commercial potential, and traffic-station potential. |

## Road Properties

The current road GeoJSON keeps the OSM fields and marathon suitability fields:

- `fclass`, `highway`, `name`
- `road_level`
- `is_arterial`
- `bridge`, `is_bridge`
- `tunnel`, `is_tunnel`
- `is_greenway`
- `control_ok`
- `impedance`
- `suitability`
- `slope_mean`

`src\data\roadNetworkGeoJson.ts` reads these properties. `control_ok=0` marks a road as unsuitable for competition routing, and `impedance` is converted into the edge `baselineCost`.

## Regeneration

Run this after regenerating the processed GIS package:

```powershell
python E:\SuperMap\超图\Supermap_marathon_web\scripts\build_web_gis_assets.py
```

The script rebuilds the two road GeoJSON files and copies selected reference layers into `public\data\gis`.
