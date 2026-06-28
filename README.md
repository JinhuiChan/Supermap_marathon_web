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
3. ✅ 前端已接入 SuperMap iClient JavaScript (Leaflet 变体)，地图面板从 iServer 加载真实底图。
4. 路线数据当前使用示范路线，待 iServer 服务发布后接入真实空间分析结果。
5. 多路线对比、评分和推荐逻辑保留在前端领域模块中，便于演示和测试。

## 当前地图接入状态

| 项目 | 状态 |
| --- | --- |
| SuperMap iServer | ✅ 运行中，WMS 底图正常 |
| 地图引擎 | ✅ Leaflet + SuperMap iServer WMS 真实瓦片 |
| WMS 底图服务 | ✅ map-world/wms111（SuperMap 内置世界地图） |
| 目标二维地图服务 | 待通过 iDesktopX 发布 map-wuhan-marathon |
| 三维场景预览面板 | ✅ 可折叠面板（自动检测 iClient3D 可用性） |
| 目标三维场景服务 | 待发布 3D-wuhan-marathon |
| 服务状态自动检测 | ✅ 每 30 秒自动刷新 |
| SVG 示意图兜底 | ✅ 地图加载失败时自动降级 |

## iDesktopX 发布指南

详细的 iDesktopX → iServer 服务发布操作步骤见：

```text
docs/idesktopx-publishing-workflow.md
```

发布完成后更新 `src/config/supermap.ts` 中的 `wmsMapUrl` 和 `wmsLayerName` 即可切换为自有服务。

## 演示材料

比赛演示脚本见：

```text
docs/demo-script.md
```

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
