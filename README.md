# Supermap_marathon_web

武汉马拉松赛道空间选线 WebGIS 系统。项目使用 React、TypeScript、Vite、Leaflet 和 SuperMap iServer/WMS 服务，围绕武汉三条差异化马拉松路线进行 Full OSM 路网生成、控制点命中、赛道质量检查、路线对比、赛道分析和保障规划建议。

## 项目现状

- Web UI 只保留 Full OSM 路网生成模式。
- 三条路线均为全马目标距离：东湖线、滨江线、城市景观线。
- 生成路线时显示阶段式真实进度：路网图、控制点吸附、控制点连接、里程补齐、指标计算、完成。
- 赛道分析基于路线几何、道路属性、拓扑检测、坡度指标和本地服务点数据输出，不把估算指标当作官方结论。
- 赛事保障模块已改为“保障规划建议”，按路线长度、桥梁、坡度、自交、重复道路等指标推导补给、医疗、厕所和引导建议。

## 快速运行

```powershell
npm.cmd install
npm.cmd run dev
```

浏览器打开：

```text
http://127.0.0.1:5173/
```

构建与测试：

```powershell
npm.cmd test
npm.cmd run build
```

## SuperMap 与数据依赖

默认 SuperMap iServer 地址：

```text
http://127.0.0.1:8090/iserver
```

关键配置在 `src/config/supermap.ts`。前端会优先加载 iDesktopX 发布的 WMS 地图服务，同时叠加本地 GeoJSON 路网、约束、POI 和生成路线。用于 Full OSM 生成的核心数据文件是：

```text
public/data/local-wuhan-road-network-osm.geojson
```

这个大文件当前属于本地运行数据，未列在仓库跟踪文件清单中；如果缺失，路线生成按钮会显示 Full OSM 路网加载失败。

## 路线类型

- 东湖线：全马竞速/PB 主题，控制点覆盖东湖绿道与青山江滩。
- 滨江线：全马滨江观光主题，控制点覆盖汉口、汉阳、武昌滨江与桥梁节点。
- 城市景观线：全马文旅展示主题，控制点覆盖老城、桥梁、东湖和青山工业滨江。

## 仓库文件用途

### 根目录

| 文件 | 用途 |
| --- | --- |
| `.gitignore` | 忽略依赖、构建产物、本地 SuperMap 工作空间和本地大数据文件。 |
| `README.md` | 项目总览、运行方式和仓库文件说明；仓库中唯一保留的 Markdown 文档。 |
| `说明文档.md` | 使用说明和详细技术说明，面向最终交付和答辩说明。 |
| `package.json` | npm 脚本、运行依赖和开发依赖声明。 |
| `package-lock.json` | 锁定 npm 依赖版本，保证安装一致性。 |
| `tsconfig.json` | TypeScript 编译配置。 |
| `vite.config.ts` | Vite 构建、开发服务器和 Vitest 测试配置。 |
| `index.html` | Vite 前端应用 HTML 入口。 |

### artifacts

| 文件 | 用途 |
| --- | --- |
| `artifacts/full-osm-all-waypoints/report.json` | Full OSM 全控制点路线生成实验报告。 |
| `artifacts/route-qa/city-experience.png` | 城市体验路线质量截图/留档。 |
| `artifacts/route-qa/organization-support.png` | 组织保障路线质量截图/留档。 |
| `artifacts/route-qa/race-flat.png` | 竞速平坦路线质量截图/留档。 |
| `artifacts/route-topology/pb-friendly.png` | PB 友好路线拓扑实验截图。 |
| `artifacts/route-topology/scenic.png` | 景观路线拓扑实验截图。 |

### public

| 文件 | 用途 |
| --- | --- |
| `public/preview_roads.html` | 本地路网预览页面，用于快速查看道路 GeoJSON。 |
| `public/data/wuhan-marathon-routes.geojson` | 可下载/展示的武汉马拉松候选路线 GeoJSON。 |
| `public/data/experimental-full-osm-all-waypoint-routes.geojson` | Full OSM 全控制点实验路线 GeoJSON。 |
| `public/data/wuhan-marathon-support-points.geojson` | 赛事服务点 GeoJSON，包括起终点、补给、医疗、停车等示意点。 |
| `public/data/gis/constraint_sensitive_hospital_area.geojson` | 医院敏感区约束图层。 |
| `public/data/gis/constraint_sensitive_school_area.geojson` | 学校敏感区约束图层。 |
| `public/data/gis/constraint_water_area.geojson` | 水域面约束图层。 |
| `public/data/gis/constraint_water_line.geojson` | 水系线约束图层。 |
| `public/data/gis/park_green_osm.geojson` | 公园绿地/绿道相关 OSM 图层。 |
| `public/data/gis/poi_commercial_potential_area.geojson` | 商业服务潜力区 POI 图层。 |
| `public/data/gis/poi_traffic_station_area.geojson` | 交通站点 POI 图层。 |

### scripts

| 文件 | 用途 |
| --- | --- |
| `scripts/auto_publish.py` | 在 SuperMap iDesktopX Python 环境中导入数据、制作地图和准备发布。 |
| `scripts/annotate_roads_with_slope.py` | 将坡度/高程相关属性写入道路数据。 |
| `scripts/build_web_gis_assets.py` | 生成前端可直接加载的 WebGIS GeoJSON 资产。 |
| `scripts/clip_wuhan_roads.py` | 从完整 OSM/道路数据中裁剪武汉范围或目标区域道路。 |
| `scripts/extract_wuhan_pois.py` | 从源数据抽取武汉 POI/服务点候选数据。 |
| `scripts/generate_full_osm_all_waypoint_routes.ts` | 在 Node/TypeScript 环境批量生成 Full OSM 全控制点路线。 |
| `scripts/simplify_roads.py` | 简化道路几何，降低前端加载和渲染压力。 |

### src 根入口

| 文件 | 用途 |
| --- | --- |
| `src/main.tsx` | React 应用挂载入口。 |
| `src/App.tsx` | 主应用壳，管理工作模式、路线生成、路线对比、地图和分析面板。 |
| `src/App.test.tsx` | App 顶层渲染、Full OSM UI 和中文文案防乱码测试。 |
| `src/styles.css` | 全局样式、地图布局、控制面板、分析卡和进度条样式。 |
| `src/types/geojson.d.ts` | GeoJSON 模块/类型声明。 |

### src/components

| 文件 | 用途 |
| --- | --- |
| `CandidateRouteDrawer.tsx` / `.test.tsx` | 候选路线抽屉、路线选择、对比和分析入口。 |
| `ComparisonPanel.tsx` | 多路线对比分数和柱状图。 |
| `DataPackagePanel.tsx` / `.test.tsx` | GIS 数据包下载入口，包括路线和控制点 CSV。 |
| `ExportPanel.tsx` | 生成文本分析报告导出内容。 |
| `GisModeNav.tsx` | 智能选型/赛道分析模式切换。 |
| `GisSelectionPanel.tsx` / `.test.tsx` | Full OSM 路线选择、合规规则展示和生成进度条。 |
| `LayerControlPanel.tsx` / `.test.tsx` | 地图图层显隐控制。 |
| `RouteAnalysisPanel.tsx` / `.test.tsx` | 赛道分析、数据来源、数据缺口和保障规划建议展示。 |
| `RouteDetails.tsx` | 单条路线基础指标详情。 |
| `RouteLibrary.tsx` / `.test.tsx` | 路线库展示组件。 |
| `RouteMap.tsx` | Leaflet/SuperMap 不可用时的 SVG 备用示意地图。 |
| `RouteQualityPanel.tsx` / `.test.tsx` | 质量门禁证据展示，包括距离、坡度、自交、复访、折返等。 |
| `SelectionProfilePanel.tsx` / `.test.tsx` | 历史选线偏好面板，保留给扩展/对照使用。 |
| `SuperMapStatusPanel.tsx` | SuperMap iServer 服务状态检查展示。 |

### src/config

| 文件 | 用途 |
| --- | --- |
| `supermap.ts` | SuperMap iServer 地址、WMS/REST 服务、数据 URL、地图中心和 DEM 元数据配置。 |
| `supermap.test.ts` | SuperMap 配置基本可用性测试。 |

### src/data

| 文件 | 用途 |
| --- | --- |
| `profileRoutePlanner.ts` / `.test.ts` | 三条路线控制点、目标距离、路线主题和历史候选规划逻辑。 |
| `fullOsmAllWaypointRoute.ts` / `.test.ts` | Full OSM 全控制点路线生成算法、进度回调、命中距离和指标计算。 |
| `roadNetworkGeoJson.ts` / `.test.ts` | 将 GeoJSON 道路转换为内部道路图结构。 |
| `osmMarathonRoute.ts` / `.test.ts` | 早期 OSM 候选路线生成算法与候选路线构造。 |
| `osmMarathonRoute.realdata.test.ts` | 基于真实道路数据的路线生成验证。 |
| `osmMarathonRoute.realdata.waypoints.test.ts` | 真实道路数据下控制点命中验证。 |
| `osmMarathonRoute.realdata.connectivity.test.ts` | 真实道路数据连通性验证。 |
| `generatedRoutes.ts` | 生成路线数据入口/适配层。 |
| `routes.ts` / `.test.ts` | 静态路线数据和基础路线结构测试。 |
| `supportPoints.ts` / `.test.ts` | 赛事服务点数据、按路线统计服务点。 |
| `wuhanLandmarks.ts` / `.test.ts` | 武汉地标 POI 标签和显示优先级。 |
| `poiData.ts` / `.test.ts` | 将 POI 分数映射到道路边。 |
| `testGraph.ts` | 单元测试用小型道路图。 |

### src/domain

| 文件 | 用途 |
| --- | --- |
| `roadNetwork.ts` / `.test.ts` | 道路图节点、边、基础 ID 和图结构类型。 |
| `roadAttributes.ts` / `.test.ts` | 距离、坡度、转弯、道路属性和 POI 权重计算。 |
| `routeMetrics.ts` / `.test.ts` | 马拉松路线指标、推荐分、难度分、路线排序和选线偏好评分。 |
| `routeQuality.ts` / `.test.ts` | 赛道质量门禁：距离、坡度、重复、自交、折返、路网贴合等。 |
| `routeTopology.ts` / `.test.ts` | 自交、复访、平行折返、发卡掉头和局部绳结检测。 |
| `routeAnalysis.ts` / `.test.ts` | 基于数据证据的赛道分析和保障规划建议。 |
| `routeCollection.ts` / `.test.ts` | 生成路线集合的插入、更新和去重。 |
| `routeReconstruct.ts` / `.test.ts` | 根据路径重建路线坐标和指标。 |
| `routeSearch.ts` / `.test.ts` | 路网搜索、候选路线搜索和约束相关逻辑。 |
| `routeGenerator.ts` / `.test.ts` | 通用路线生成流程测试和组合入口。 |
| `routeConstraints.ts` | 路线约束类型和规则定义。 |
| `competitionSuitability.ts` / `.test.ts` | 赛事承办适宜性评分。 |
| `poiTypes.ts` | POI 分类、权重和选线偏好映射类型。 |

### src/map

| 文件 | 用途 |
| --- | --- |
| `src/map/components/SuperMapMap.tsx` / `.test.ts` | 地图主组件，加载 Leaflet、WMS、矢量路线、路网和 POI。 |
| `src/map/components/Scene3DPanel.tsx` | 三维场景服务信息面板。 |
| `src/map/components/LoadingSpinner.tsx` | 地图加载状态组件。 |
| `src/map/core/MapEngine.ts` | Leaflet 地图封装，管理底图、路线、路网、POI、图层显隐和事件。 |
| `src/map/core/loadScript.ts` | 动态加载 Leaflet JS/CSS。 |
| `src/map/layers/RouteLayer.ts` / `.test.ts` | 路线矢量图层绘制和交互。 |
| `src/map/layers/RoadNetworkLayer.ts` / `.test.ts` | 道路网络 GeoJSON 提取和地图绘制。 |
| `src/map/layers/PoiLabelLayer.ts` / `.test.ts` | POI 标签提取和绘制。 |
| `src/map/layers/SupportPointLayer.ts` / `.test.ts` | 赛事服务点图层绘制。 |
| `src/map/layers/VectorBasemapLayer.ts` / `.test.ts` | 水体、公园、商业区、交通站点等辅助底图矢量图层。 |

### src/services

| 文件 | 用途 |
| --- | --- |
| `supermapHealth.ts` / `.test.ts` | 检测 SuperMap iServer 服务是否可访问。 |
| `iserverPoi.ts` / `.test.ts` | 从 iServer REST 数据服务读取 POI 标签。 |

## 详细说明文档

使用说明和详细技术说明见根目录：

```text
说明文档.md
```
