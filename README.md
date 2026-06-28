# Supermap_marathon_web

基于 SuperMap WebGIS 的马拉松赛道智能选型与多路线对比分析系统。

## 当前状态

本项目已经完成可演示闭环：

- iDesktopX 已导入武汉 DEM、候选赛道 GeoJSON、赛事保障点 GeoJSON。
- iDesktopX 已生成地图：`武汉马拉松赛道地图`。
- iServer 已发布二维地图服务：`map-wuhan-marathon`。
- 前端已切换到自有 SuperMap WMS：`武汉马拉松赛道地图`。
- 地图加载失败时仍保留 SVG 示意图降级。

## 本地运行

```powershell
npm.cmd install
npm.cmd run dev
```

打开本地地址：

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

## 数据与脚本

```text
public/data/wuhan-marathon-routes.geojson
public/data/wuhan-marathon-support-points.geojson
scripts/auto_publish.py
docs/idesktopx-publishing-workflow.md
docs/demo-script.md
```

`scripts/auto_publish.py` 用于在 iDesktopX Python 窗口中导入数据、创建地图和保存工作空间。iServer 服务发布仍通过 iDesktopX 的“在线 -> 工作空间”发布向导完成。

## DEM 数据

```text
ASTGTMV003_N30E114
WGS 84 / EPSG:4326
3601 x 3601
113.9999E-115.0001E, 29.9999N-31.0001N
高程范围 -135m 至 771m
```
