# CityPackage 城市包接入模板

本文档用于把当前武汉实例扩展到第二个城市。目标不是改一堆散落的硬编码，而是新增一个完整 `CityPackage` 和对应 `CityRoutingProfile`，再让系统选择它运行。

## 1. 城市包边界

一个城市包至少包含：

| 类别 | 代码位置 | 必填内容 |
| --- | --- | --- |
| 城市身份 | `src/config/cityPackages.ts` | `id`、`name`、`displayName`、`marathonName` |
| 地图视图 | `CityPackage.mapCenter/mapZoom` | 城市中心点 `[lon, lat]` 和默认缩放级别 |
| SuperMap 服务 | `CityPackage.superMap.serviceUrls` | 道路 WMS/REST、POI Data、约束图层、DEM/坡度服务 |
| 道路网络 | `public/data/` + `superMap.*RoadNetworkGeoJsonUrl` | 完整路网 GeoJSON、赛事区域轻量路网 GeoJSON |
| 路线模板 | `routePlans` | 2-4 条候选主题线，每条包含控制点、目标距离、定位、受众、特征 |
| 保障服务点 | `supportPoints` | 医疗、补给、交通、停车、厕所、应急集结等服务点 |
| 地标 POI | `landmarks` | 城市展示地标、桥梁、景区、公园、交通节点 |
| 算法策略 | `routingProfile` | 地标影响半径、必经跨河桥规则、普通跨河景观桥规则 |
| 地形与约束 | `demDataPath/slopeDataPath/constraintLayerUrls` | DEM、坡度、河湖、学校、医院、公园、商业、交通等约束图层 |

## 2. 文件命名建议

把城市 id 作为文件前缀，避免和武汉数据混在一起：

```text
public/data/<city-id>-marathon-routes.geojson
public/data/<city-id>-marathon-waypoints.csv
public/data/local-<city-id>-road-network-osm.geojson
public/data/local-<city-id>-marathon-area-roads.geojson
public/data/gis/<city-id>-constraint_water_area.geojson
public/data/gis/<city-id>-constraint_sensitive_hospital_area.geojson
public/data/gis/<city-id>-poi_traffic_station_area.geojson
```

如果比赛现场只演示一个城市，可以继续用本地 GeoJSON；如果要证明通用性，建议至少准备第二城市的轻量路网和 1 条路线模板。

## 3. 数据准备清单

### 道路网络

- 来源：OSM、城市道路中心线、SuperMap 数据集或交通部门开放数据。
- 字段建议：`highway`、`name`、`bridge`、`tunnel`、`lanes`、`width_m`、`surface`、`slope_mean`、`slope_max`、`control_ok`。
- 处理要求：统一为 WGS84 经纬度 GeoJSON；保留桥梁、隧道、道路等级、道路名称；赛事区域轻量路网应覆盖起终点和所有控制点。

### POI 与保障点

- 医疗：医院、急救站、AED、临时医疗点候选。
- 补给：商圈、公园入口、广场、校园/体育场外部空间。
- 交通：地铁站、公交枢纽、停车场、疏散广场。
- 服务：公厕、安检集结区、志愿者布点候选。

### 地形与约束

- DEM：30m 或更高分辨率 DEM。
- 坡度：可预处理进道路属性，也可发布为 iServer DEM/坡度服务。
- 约束：河湖水域、学校医院敏感区、施工/管制区、绿地、公园、商业潜力、交通站点。

## 4. 配置骨架

```ts
export const sampleRoutingProfile: CityRoutingProfile = {
  id: "sample-city-routing",
  cityId: "sample-city",
  landmarks: sampleLandmarkPoiLabels,
  landmarkInfluenceRadiusKm: 0.45,
  riverBridgeNamePattern: /跨河桥|大桥/,
  requiredRiverBridges: [
    {
      id: "sample-main-river-bridge",
      name: "示例城市主跨河桥",
      namePattern: /示例城市主跨河桥/
    }
  ]
};

export const sampleCityPackage: CityPackage = {
  id: "sample-city",
  name: "示例城市",
  displayName: "示例城市马拉松",
  marathonName: "示例城市马拉松赛道空间选线平台",
  mapCenter: [120.0000, 30.0000],
  mapZoom: 12,
  routePlans: sampleWaypointRoutePlans,
  supportPoints: sampleSupportPoints,
  landmarks: sampleLandmarkPoiLabels,
  routingProfile: sampleRoutingProfile,
  superMap: {
    ...wuhanCityPackage.superMap,
    displayRoadNetworkGeoJsonUrl: "data/local-sample-city-road-network-osm.geojson",
    routingRoadNetworkGeoJsonUrl: "data/local-sample-city-marathon-area-roads.geojson",
    routingRoadNetworkGeoJsonUrls: {
      area: "data/local-sample-city-marathon-area-roads.geojson",
      fullOsm: "data/local-sample-city-road-network-osm.geojson"
    }
  }
};
```

## 5. 接入步骤

1. 准备路网、POI、约束、DEM/坡度数据。
2. 新增城市地标数据文件，例如 `src/data/sampleCityLandmarks.ts`。
3. 新增路线模板数据，或把现有 `profileRoutePlanner.ts` 拆成城市专属路线模板文件。
4. 新增 `CityRoutingProfile`，配置地标影响半径、必经桥梁、跨河桥规则。
5. 新增 `CityPackage`，把 SuperMap 服务、路网 URL、路线模板和策略挂到同一个对象。
6. 运行 `getCityPackageChecklist(cityPackage)`，确认完整度达到 `9/9`。
7. 运行 `npm.cmd test` 和 `npm.cmd run build`。

## 6. 验证标准

城市包达到可演示状态时，应满足：

- 数据包面板显示 `城市包完整度 9/9`。
- 地图能加载道路 WMS 或本地道路 GeoJSON。
- 至少一条路线可以完成 Full OSM 生成并进入分析。
- 报告标题使用当前城市名称，不出现武汉默认文案。
- 路线质量面板能区分“候选方案风险复核”和“推荐方案”。
- 单路线 HTML 报告和多路线 HTML 报告均可导出。

## 7. 答辩口径

可以这样解释通用性：

> 系统采用 CityPackage + CityRoutingProfile 双层城市包设计。CityPackage 管理地图服务、路网、POI、路线模板和报告品牌；CityRoutingProfile 管理城市地标、桥梁例外和景观偏好等算法策略。武汉是第一个完整城市实例，后续城市只需要补齐城市包数据和策略规则，不需要改核心路线生成、分析和导出模块。

