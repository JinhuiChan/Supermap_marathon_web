# DEM / slope routing workflow

This project uses the local Wuhan 30 m slope raster to assign slope resistance
to road-network edges before route generation.

## Input data

- Slope raster:
  `E:\SuperMap\data\dataset\dataset\武汉市_30米分辨率坡度数据\武汉市_30米分辨率的坡度数据.tif`
- Web road files:
  - `public/data/local-wuhan-road-network-osm.geojson`
  - `public/data/local-wuhan-marathon-area-roads.geojson`
  - `public/data/local-wuhan-marathon-corridor-roads.geojson`

The `public/data/local-*` files are intentionally ignored by Git because they
are large local GIS artifacts. Regenerate them on each machine that needs the
same routing data.

## Regenerate slope-aware roads

Run from the repository root:

```powershell
python scripts/annotate_roads_with_slope.py
```

The script samples the raster along every road line at about 90 m spacing and
writes these properties:

- `slope_mean`
- `slope_max`
- `slope_p85`
- `slope_sample_count`
- `slope_source`
- `base_impedance`
- `slope_impedance`
- `constraint_impedance`
- `impedance`
- `suitability`

Raster slope values are treated as slope degrees and converted to slope percent
with `tan(degrees) * 100` before scoring.

## Frontend scoring

`src/data/roadNetworkGeoJson.ts` reads the generated fields when building the
route graph. If decomposed impedance fields are present, `impedance` is treated
as the total resistance and is not double-counted with slope or constraint
penalties. If old data lacks the decomposed fields, the graph builder keeps the
legacy behavior and estimates slope resistance from `slope_mean`.
