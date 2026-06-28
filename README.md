# Supermap_marathon_web

基于 SuperMap WebGIS 的马拉松赛道智能选型与多路线对比分析系统。

## 第一版目标

第一版先完成比赛可演示闭环：候选赛道展示、单路线指标、多路线对比、坡度剖面、推荐结论和报告导出。

## 本地运行

```powershell
npm.cmd install
npm.cmd run dev
```

打开终端输出的本地地址。

## 验证

```powershell
npm.cmd test
npm.cmd run build
```

## SuperMap 接入路径

1. 使用 SuperMap iDesktopX 处理 DEM、路网、POI 和路线数据。
2. 使用 SuperMap iServer 发布二维地图、三维场景和空间分析服务。
3. 前端当前使用示范路线数据，后续通过统一数据接口替换为 iServer 返回结果。
4. 多路线对比、评分和推荐逻辑保留在前端领域模块中，便于演示和测试。

## GIS 数据包

当前已内置两份可导入 SuperMap iDesktopX 的 GeoJSON：

```text
public/data/wuhan-marathon-routes.geojson
public/data/wuhan-marathon-support-points.geojson
```

## 当前 SuperMap 配置

前端配置文件：

```text
src/config/supermap.ts
```

当前默认连接：

```text
http://127.0.0.1:8090/iserver
```

当前 DEM 数据已识别为：

```text
ASTGTMV003_N30E114
WGS 84 / EPSG:4326
3601 x 3601
113.9999E-115.0001E, 29.9999N-31.0001N
高程范围 -135m 至 771m
```

合规推进说明见：

```text
docs/supermap-compliance.md
docs/supermap-publish-checklist.md
```
