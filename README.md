# Supermap_marathon_web

基于 SuperMap WebGIS 的武汉马拉松赛道智能选线与多路线对比分析系统。

## 当前状态

- 已通过 SuperMap iDesktopX 导入武汉 DEM、候选赛道 GeoJSON、赛事服务点 GeoJSON。
- 已在 SuperMap iServer 发布二维地图服务：`map-wuhan-marathon`。
- 前端已接入自有 WMS 服务，并叠加候选赛道、补给点、医疗点、停车点和起终点。
- 已支持路线评分、多路线对比、路线研判、图层控制和文本报告导出。
- WMS 或 Leaflet 加载失败时，页面会自动降级到 SVG 示意图。

## 本地运行

```powershell
npm.cmd install
npm.cmd run dev
```

打开：

```text
http://127.0.0.1:5173/
```

## 验证

```powershell
npm.cmd test
npm.cmd run build
```

## SuperMap 服务

```text
iServer:
http://127.0.0.1:8090/iserver

REST 地图服务:
http://127.0.0.1:8090/iserver/services/map-wuhan-marathon/rest/maps/武汉马拉松赛道地图

WMS 地图服务:
http://127.0.0.1:8090/iserver/services/map-wuhan-marathon/wms111/武汉马拉松赛道地图
```

前端配置文件：

```text
src/config/supermap.ts
```

本地 SuperMap 工作空间和数据源由脚本生成在：

```text
supermap-workspace/
```

该目录已加入 `.gitignore`，不会上传到 GitHub。

## 主要功能

- 真实 SuperMap iServer WMS 底图加载。
- 三条武汉候选马拉松路线可视化与点击选择。
- 赛事服务点叠加：起终点、补给、医疗、停车。
- 图层控制：候选赛道和赛事服务点可独立开关。
- 单路线研判：地形友好度、通行组织、赛事保障、观赛体验。
- 多路线对比：难度分、保障分、综合推荐分和坡度剖面对比。
- 成果导出：生成包含 SuperMap 服务依据、推荐理由和风险提示的文本报告。

## 数据与脚本

```text
public/data/wuhan-marathon-routes.geojson
public/data/wuhan-marathon-support-points.geojson
scripts/auto_publish.py
docs/idesktopx-publishing-workflow.md
docs/demo-script.md
```

`scripts/auto_publish.py` 用于在 iDesktopX Python 窗口中导入数据、创建地图和保存工作空间。iServer 服务发布通过 iDesktopX 的在线发布流程完成。

## DEM 数据

```text
ASTGTMV003_N30E114
WGS 84 / EPSG:4326
3601 x 3601
113.9999E-115.0001E, 29.9999N-31.0001N
高程范围 -135m 至 771m
```
