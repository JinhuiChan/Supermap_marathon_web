# 武汉马拉松 GIS 资产与服务状态

更新时间：2026-07-08

## Web 当前使用的数据

| 文件 | 用途 |
| --- | --- |
| `public/data/local-wuhan-road-network-osm.geojson` | 全武汉 OSM 道路展示图层，含道路名称、等级、桥梁/隧道和适宜性字段。 |
| `public/data/local-wuhan-marathon-area-roads.geojson` | 选线模型使用的武汉核心区道路网络。 |
| `public/data/local-wuhan-marathon-corridor-roads.geojson` | 官方赛道走廊参考道路网络。 |
| `public/data/wuhan-marathon-support-points.geojson` | 起终点、补给、医疗、地铁站、停车场、公园、公厕、商圈/补给和应急集结点。 |
| `public/data/gis/*.geojson` | 水域、学校/医院敏感区、公园绿地、商圈潜力区和交通站点潜力区。 |

## 道路字段

道路 GeoJSON 保留并使用这些字段：

- `fclass`、`highway`、`name`
- `road_level`
- `is_arterial`
- `bridge`、`is_bridge`
- `tunnel`、`is_tunnel`
- `is_greenway`
- `control_ok`
- `impedance`
- `suitability`
- `slope_mean`

前端解析逻辑位于 `src/data/roadNetworkGeoJson.ts`：

- `control_ok=0` 会标记为不适合赛事选线，并增加约束阻力。
- `impedance` 会进入道路边 `baselineCost`。
- `slope_mean` 会增加坡度阻力，并进入最终路线的平均坡度、最大坡度和长坡占比指标。

## iServer 服务状态

已在本机 iServer 验证：

| 服务名 | 状态 | 说明 |
| --- | --- | --- |
| `map-wuhan-road-network` | 已发布 | 武汉道路 WMS/REST 底图服务，Web 默认底图使用此服务。 |
| `data-wuhan-road-network` | 已发布 | 道路数据服务，包含 `road_network_osm`。 |
| `data-wuhan-poi` | 已发布 | POI 数据服务。 |

仍需在 iDesktopX/iServer 管理页发布：

| 服务名 | 状态 | 建议图层 |
| --- | --- | --- |
| `map-wuhan-constraints` | 待发布 | 水域、学校/医院敏感区、不适合跑步道路、管制困难区。 |
| `map-wuhan-dem-slope` | 待发布 | DEM、坡度、坡向栅格。 |

前端已配置这两个服务 URL，并会在 SuperMap 接入面板中显示“待发布/已发布”。

## 重新生成 Web GIS 资产

```powershell
python E:\SuperMap\超图\Supermap_marathon_web_main\scripts\build_web_gis_assets.py
```

该脚本从 `E:\SuperMap\data\processed\wuhan_marathon\web_geojson` 重新生成道路 GeoJSON，并复制约束/POI 参考图层到 `public/data/gis`。
