Supermap_marathon_web 使用说明与技术说明
============================================================

一、项目用途
------------------------------------------------------------

本项目是一个面向武汉马拉松赛道规划的 WebGIS 前端系统。它把 SuperMap iDesktopX/iServer 发布的底图服务、本地 Full OSM 道路网络 GeoJSON、约束图层、POI 图层和路线生成算法结合起来，用于生成和分析三条差异化全马路线：

1. 东湖线：竞速 PB 主题，强调东湖绿道、平缓路线和控制点命中。
2. 滨江线：滨江观光主题，强调长江、汉江、桥梁和三镇滨水空间。
3. 城市景观线：文旅展示主题，强调老城、桥梁、东湖、青山工业滨江等城市地标。

当前 Web UI 只保留 Full OSM 生成模式，不再展示 Area roads 切换项。路线生成时会显示基于算法阶段的进度条。


二、运行环境
------------------------------------------------------------

1. Node.js / npm

项目是 Vite + React + TypeScript 前端，依赖由 package.json 和 package-lock.json 管理。

常用命令：

  npm.cmd install
  npm.cmd run dev
  npm.cmd test
  npm.cmd run build

2. 浏览器

开发服务器默认监听：

  http://127.0.0.1:5173/

3. SuperMap

推荐环境：

  SuperMap GIS 2025 Update1 / V12.0.1.0
  SuperMap iServer: http://127.0.0.1:8090/iserver

前端配置集中在：

  src/config/supermap.ts

该配置包含 iServer 地址、WMS/REST 服务地址、地图中心点、缩放级别、DEM 元数据、本地 GeoJSON 数据路径等。


三、启动使用流程
------------------------------------------------------------

1. 安装依赖

在仓库根目录执行：

  npm.cmd install

2. 准备 Full OSM 本地路网数据

路线生成依赖：

  public/data/local-wuhan-road-network-osm.geojson

该文件较大，但已提交到 GitHub。同学克隆仓库并安装依赖后，可以直接运行 Web 并生成路线，不需要额外拷贝路网文件。

3. 启动前端

  npm.cmd run dev

打开：

  http://127.0.0.1:5173/

4. 生成路线

在“智能选型”页面点击：

  东湖线
  滨江线
  城市景观线

系统会加载 Full OSM 路网，将控制点吸附到最近道路节点，连接控制点并补齐到目标全马距离。

5. 查看分析

生成路线后，可以进入“赛道分析”页面。系统会展示：

  路线详情
  赛道分析
  保障规划建议
  多路线对比
  报告导出
  质量合规检查


四、主要功能说明
------------------------------------------------------------

1. Full OSM 路网路线生成

系统只使用 Full OSM 路网作为生成来源。生成过程分为：

  路网图准备
  控制点吸附
  控制点连接
  剩余里程补齐
  路线指标计算
  生成完成

进度条不是纯 UI 假进度，而是由 fullOsmAllWaypointRoute.ts 中的异步生成函数回调算法阶段。

2. 控制点命中

三条路线各自带有一组控制点。算法会尽可能多地经过这些控制点，并通过 getWaypointHitDistancesM 计算路线到控制点的距离。当前命中半径由 waypointHitRadiusKm 控制，默认 2km。

3. 质量门禁

质量检查包括：

  目标距离
  起终点净下降
  累计爬升
  最大坡度
  连续大坡
  重复道路
  路线自交
  局部绳结
  交叉口复访
  平行折返
  发卡掉头
  急弯密度
  路网连续误差
  道路几何贴合率
  道路适赛性

这些检查主要由 src/domain/routeQuality.ts、src/domain/routeTopology.ts 和 src/domain/competitionSuitability.ts 负责。

4. 赛道分析

赛道分析不再使用泛化宣传语。它只基于已有数据输出事实和建议：

  路线几何坐标
  道路拓扑检测指标
  道路等级与适赛性指标
  坡度/爬升指标
  Full OSM 路网生成结果
  本地服务点 GeoJSON

同时明确列出数据缺口：

  未接入官方补给点部署
  未接入官方医疗点部署
  未接入官方厕所/停车部署
  未接入交通管制数据
  未接入实时交通
  未接入封路许可
  未接入人流疏散数据
  未接入现场道路宽度实测数据

5. 保障规划建议

赛事保障模块现在不是评价“已有保障是否足够”，而是基于路线生成建议。系统会根据路线长度、桥梁段、坡度、转弯惩罚、自交、重复道路和已接入服务点，给出：

  补给站建议
  医疗点建议
  厕所点建议
  志愿者/隔离带/方向标识建议

所有保障建议都会明确说明“不是官方保障方案”，避免被误读为真实赛事部署。


五、技术架构说明
------------------------------------------------------------

1. 前端框架

项目使用：

  React 19
  TypeScript 5
  Vite 7
  Vitest
  SuperMap iClient for JavaScript（Leaflet 版）
  lucide-react

React 负责 UI 状态和组件渲染。Vite 负责本地开发服务器、生产构建和测试环境集成。

2. 应用主流程

入口文件：

  src/main.tsx

主应用：

  src/App.tsx

App.tsx 管理以下核心状态：

  workspaceMode：智能选型或赛道分析
  routes：当前已生成路线集合
  roadGeoJson：Full OSM 路网数据
  generationStatus：路线生成状态文本
  generationProgress：生成进度百分比
  activeRouteId：当前选中路线
  comparedRouteIds：加入对比的路线 ID
  mapLayerVisibility：路线层和道路层显隐

页面启动后，App 会 fetch Full OSM 路网数据。用户点击路线按钮后，App 调用 buildFullOsmAllWaypointRouteAsync 生成路线，并把算法回调的进度传给 GisSelectionPanel 显示。

3. 路线数据结构

核心类型在：

  src/domain/routeMetrics.ts

主要类型：

  Coordinate：经纬度坐标 [longitude, latitude]
  ElevationPoint：高程剖面点
  RouteMetrics：路线指标集合
  MarathonRoute：完整路线对象
  RouteScore：评分结果

MarathonRoute 包含：

  id
  name
  color
  lengthKm
  targetDistanceKm
  closedLoop
  coordinates
  elevationProfile
  metrics
  lineage

metrics 是后续质量检查、赛道分析、路线对比和保障规划的主要数据来源。

4. Full OSM 路线生成算法

核心文件：

  src/data/fullOsmAllWaypointRoute.ts

主要导出：

  buildFullOsmAllWaypointRoute
  buildFullOsmAllWaypointRouteAsync
  getWaypointHitDistancesM
  buildFullOsmAllWaypointRouteFeatureCollection

算法步骤：

  1. 将 GeoJSON 转换为 RoadGraph。
  2. 把每个路线控制点吸附到最近道路节点。
  3. 从起点开始，维护未访问控制点集合。
  4. 在剩余控制点中选择代价最低的下一段路径。
  5. 路径搜索使用 Dijkstra 风格的最短路搜索，并叠加道路等级、重复边、拓扑避让等惩罚。
  6. 对可能自交或复访的路径追加惩罚，必要时生成候选替代路径。
  7. 所有控制点连接完成后，如果路线长度不足目标距离，调用前向补齐搜索。
  8. 补齐阶段优先寻找未使用道路，减少立即折返。
  9. 如果严格拓扑补齐不够，再进入较宽松的补齐策略。
  10. 最后计算坡度、转弯、重复道路、自交、适赛性、桥梁、控制点命中等指标。

异步版本 buildFullOsmAllWaypointRouteAsync 会在关键阶段调用 onProgress：

  graph
  snap
  controls
  filler
  metrics
  complete

这就是 UI 进度条的数据来源。

5. 道路网络解析

核心文件：

  src/data/roadNetworkGeoJson.ts
  src/domain/roadNetwork.ts

roadNetworkGeoJson.ts 负责从 GeoJSON FeatureCollection 读取 LineString/MultiLineString，道路属性和坐标，并构造 RoadGraph。

RoadGraph 包含：

  nodes：道路节点表
  edges：道路边表
  adjacency：邻接表

道路边 RoadEdge 包含：

  id
  fromNodeId
  toNodeId
  coordinates
  lengthKm
  roadName
  roadLevel
  roadWidthM
  isBridge
  isTunnel
  isElevated
  surfaceSuitable
  competitionSuitable

这些属性参与搜索和质量评价。

6. 路线质量与拓扑

核心文件：

  src/domain/routeQuality.ts
  src/domain/routeTopology.ts
  src/domain/competitionSuitability.ts

routeQuality.ts 负责质量门禁，判断路线是否满足全马规划约束。

routeTopology.ts 负责检测：

  revisitedNodeCount
  parallelBacktrackCount
  hairpinTurnCount
  localKnotCount
  selfIntersectionCount
  sharpTurnDensityPerKm

competitionSuitability.ts 根据道路边属性和路线几何计算赛事承办适宜性。

7. 赛道分析

核心文件：

  src/domain/routeAnalysis.ts
  src/components/RouteAnalysisPanel.tsx

routeAnalysis.ts 输出 RouteAnalysis，其中包含：

  dimensionCards：地形、通行、办赛、保障规划、景观体验
  highlights：事实摘要
  risks：复核项
  dataSources：数据来源
  dataGaps：数据缺口
  supportPlan：保障规划建议
  recommendation：基于当前数据的边界说明

每个 dimensionCard 都有：

  source
  reliability
  inputs
  evidence

reliability 分为：

  measured：实测或直接数据
  derived：由路线/路网指标推导
  estimated：模型估算

8. 地图渲染

核心文件：

  src/map/components/SuperMapMap.tsx
  src/map/core/MapEngine.ts
  src/map/layers/*.ts

SuperMapMap 负责加载数据、初始化地图和同步 React 状态到 MapEngine。

MapEngine 封装 SuperMap iClient for JavaScript（Leaflet 版）：

  初始化 iServer REST 地图图层
  绘制路线
  绘制路网
  绘制 POI 标签
  绘制辅助矢量底图
  管理图层显隐
  管理路线点击事件
  高亮当前路线和对比路线

如果 SuperMap iClient 或 iServer 地图服务初始化失败，系统会回退到 src/components/RouteMap.tsx 的 SVG 示意图。

9. SuperMap 接入

核心文件：

  src/config/supermap.ts
  src/services/supermapHealth.ts
  src/services/iserverPoi.ts

supermap.ts 定义服务地址：

  roadMapWms
  roadMapRest
  roadDataRest
  poiDataRest
  constraintMapRest
  demSlopeMapRest

supermapHealth.ts 检测服务是否可访问。

iserverPoi.ts 从 iServer REST 数据服务读取 POI 标签。读取失败时，前端会使用本地 GeoJSON 和 wuhanLandmarks.ts 中的地标标签作为回退。

10. SuperMap 工作空间与 iServer 发布步骤

比赛材料中需要把工作空间、数据源和服务发布过程写清楚，建议按下面顺序整理：

  1. 在 SuperMap iDesktopX 中运行 scripts/auto_publish.py，生成 supermap-workspace/wuhan-marathon.smwu 和 supermap-workspace/wuhan-marathon.udbx。
  2. 如果本机使用 UDB 数据源，交付说明中同时写明 .udb/.udd 文件路径；如果使用 UDBX，则以 .udbx 为准。
  3. 将工作空间发布副本放在 E:/SuperMap/data/processed/wuhan_marathon_supermap_workspace/，iServer 服务配置指向该英文路径下的 wuhan-marathon.smwu，避免中文路径和同名服务覆盖问题。
  4. 在 iDesktopX 中打开 wuhan-marathon.smwu，检查道路、路线、约束面、DEM/坡度等图层名称与坐标系。
  5. 在 iServer 管理页面发布工作空间，发布道路地图服务、约束面地图服务、DEM/坡度地图服务和必要的数据服务。
  6. 道路地图服务发布后，前端默认使用 REST 地图地址：

     http://127.0.0.1:8090/iserver/services/map-wuhan-road-network/rest/maps/road_network_osm%40wuhan_marathon_base

     该道路底图服务以 road_network_osm 线要素为主，用于选线和路径生成，不把大体量面要素混入主底图。

  7. 面要素发布为约束地图服务：

     http://127.0.0.1:8090/iserver/services/map-wuhan-constraints/rest/maps/wuhan_marathon_constraints

     包含 constraint_water_area、constraint_water_line、constraint_sensitive_hospital_area、constraint_sensitive_school_area、park_green_osm、poi_commercial_potential_area、poi_traffic_station_area。前端默认不直接渲染这些大 GeoJSON 面坐标，避免影响页面缩放和平移性能。

  8. DEM/坡度发布为地形服务：

     http://127.0.0.1:8090/iserver/services/map-wuhan-dem-slope/rest/maps/wuhan_dem_slope

  9. WMS 地址保留为服务健康检查和兜底：

     http://127.0.0.1:8090/iserver/services/map-wuhan-road-network/wms111

  10. iClient for JavaScript 由本机 iServer 提供，前端加载：

     http://127.0.0.1:8090/iserver/iClient/forJavaScript/web/libs/leaflet/1.9.4/leaflet.js
     http://127.0.0.1:8090/iserver/iClient/forJavaScript/dist/leaflet/iclient-leaflet-es6.min.js

     不在 React 运行时动态加载 include-leaflet.js，因为该文件通过 document.write 注入依赖，页面加载完成后再执行会导致 Leaflet 未定义。

  11. 发布后用 /iserver/services.json、REST 地图 JSON、WMS GetCapabilities 和 iClient 脚本 URL 逐项验证。
  12. 如果 iServer 发布时设置了非常规服务名、地图名、端口、权限或跨域策略，需要在部署说明中截图留档；常规默认发布只需保留服务列表、道路 REST 地图、约束面 REST 地图和 DEM/坡度地图页面截图。

11. 数据生成脚本

scripts 目录用于本地数据准备：

  auto_publish.py：导入道路、约束面、DEM/坡度数据，生成道路底图、约束面和 DEM/坡度三类 iServer 发布对象。
  build_web_gis_assets.py：生成前端 GeoJSON 资产。
  clip_wuhan_roads.py：裁剪武汉道路范围。
  simplify_roads.py：简化道路几何。
  annotate_roads_with_slope.py：写入坡度/高程属性。
  extract_wuhan_pois.py：抽取武汉 POI。
  generate_full_osm_all_waypoint_routes.ts：批量生成 Full OSM 控制点路线。

这些脚本不是前端运行时必需，但用于准备 public/data 下的静态数据。

12. 算法补充建议

答辩时建议把路线生成算法按“数据输入 - 图构建 - 控制点约束 - 质量门禁 - 输出材料”说明：

  1. 数据输入：使用 public/data/local-wuhan-road-network-osm.geojson 作为全量道路网络，结合城市包中的控制点、桥梁规则、地标权重和坡度/道路等级属性。
  2. 图构建：roadNetworkGeoJson.ts 将 GeoJSON 转为 RoadGraph，节点为道路端点或交汇点，边保存长度、道路等级、桥梁、坡度和赛事可用性。
  3. 控制点吸附：fullOsmAllWaypointRoute.ts 将起点、途经点和终点吸附到最近道路节点，并记录控制点命中距离。
  4. 分段寻路：在控制点之间使用带优先队列的最短路径搜索，代价由道路长度、道路等级惩罚、重复边惩罚和拓扑惩罚共同决定。
  5. 里程补齐：如果控制点串联后不足 42.195 km，算法继续沿可用道路搜索补齐段，并尽量减少自交、复访和折返。
  6. 指标计算：计算距离、累计爬升、最大坡度、桥梁距离、急弯、自交、复访、道路贴合率、地标覆盖率和赛事适宜性评分。
  7. 质量门禁：routeQuality.ts 使用全马距离、坡度、自交、重复道路、局部绳结、发卡掉头等阈值判断是否合规。
  8. 输出材料：前端导出 GeoJSON、控制点 CSV、分析 HTML/打印 PDF；如老师需要 Word/Excel 附件，可由这些导出结果整理为 docx/xlsx。


六、仓库清理说明
------------------------------------------------------------

本次整理后，仓库自有 Markdown 文件只保留：

  README.md

历史开发计划、草稿和阶段性设计说明已删除。详细使用与技术说明迁移到：

  Documentation.md

这样可以避免仓库内出现多个互相冲突的说明入口。


七、测试与验收
------------------------------------------------------------

建议最终提交前执行：

  npm.cmd test
  npm.cmd run build

重点测试文件：

  src/App.test.tsx
  src/components/GisSelectionPanel.test.tsx
  src/components/RouteAnalysisPanel.test.tsx
  src/data/fullOsmAllWaypointRoute.test.ts
  src/domain/routeAnalysis.test.ts
  src/domain/routeQuality.test.ts
  src/domain/routeTopology.test.ts

如果只是验证本次文档整理，运行 npm.cmd run build 足够确认 TypeScript/Vite 不受影响；如果要验证算法行为，应运行 npm.cmd test。


八、重要限制
------------------------------------------------------------

1. Full OSM 生成路线是规划结果，不等于正式赛事认证路线。
2. World Athletics / AIMS 认证仍需合资格测量员沿最短可跑线实测。
3. 保障规划建议不是官方保障方案。
4. 医疗、补给、厕所、停车、交通管制、人流疏散等需要后续接入真实官方数据或现场踏勘。
5. public/data/local-wuhan-road-network-osm.geojson 已随仓库提交；如果被手动删除，路线生成不可用。
6. 如果 SuperMap iServer 未启动，WMS/REST 状态会失败，但前端仍可在可用数据范围内显示页面和回退内容。


九、最终交付建议
------------------------------------------------------------

推荐最终仓库保持：

  main 分支
  README.md
  Documentation.md
  package.json / package-lock.json
  src 源码
  public 静态数据
  scripts 数据处理脚本
  artifacts 实验截图和报告

不建议提交：

  node_modules
  dist
  supermap-workspace
  未被源码引用的本地超大临时数据
  与最终系统无关的历史计划 Markdown
