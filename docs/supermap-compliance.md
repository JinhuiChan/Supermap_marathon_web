# SuperMap 大赛合规推进说明

## 当前定位

本项目参加开发组，需要基于 SuperMap GIS 系列软件完成。当前前端已经具备可演示的马拉松赛道选型工作台，并新增了 SuperMap 接入配置层，用于连接本机 SuperMap iServer 与后续发布的武汉马拉松地图/三维服务。

## 已确认环境

| 项目 | 当前状态 |
| --- | --- |
| SuperMap iServer | 已通过绿色包启动，首页和服务列表可访问 |
| 云许可 | 已激活，日志显示许可检查通过 |
| iServer 地址 | `http://127.0.0.1:8090/iserver` |
| 服务列表 | `http://127.0.0.1:8090/iserver/services.json` |
| iClient JavaScript | `http://127.0.0.1:8090/iserver/iClient/forJavaScript/index.html` |
| iClient3D for WebGL/WebGPU | `http://127.0.0.1:8090/iserver/iClient/for3D/webgl/index.html` |
| DEM 数据 | `E:\SuperMap\data\GDEM\ASTGTMV003_N30E114\ASTGTMV003_N30E114_dem.tif` |
| DEM 坐标系 | WGS 84 / EPSG:4326 |
| DEM 范围 | 113.9999E-115.0001E, 29.9999N-31.0001N |
| DEM 尺寸 | 3601 x 3601 |
| DEM 高程 | -135m 至 771m |
| 候选路线数据 | `public/data/wuhan-marathon-routes.geojson` |
| 赛事保障点数据 | `public/data/wuhan-marathon-support-points.geojson` |
| iServer 包目录 | `E:\SuperMap\安装包\supermap-iserver-2025u1a-windows-x64-all\supermap-iserver-2025u1a-windows-x64-all` |
| iDesktopX 安装包目录 | `E:\SuperMap\安装包\supermap-idesktopx-2025u1-windows-x64-setup\supermap-idesktopx-2025u1-windows-x64-setup` |

## 当前发现的问题

iServer 当前已经能返回 `/iserver/services.json`，默认示例服务状态为 `OK`，云许可已激活并通过检查。

当前尚未发布本项目自己的 `map-wuhan-marathon` 二维地图服务和 `3D-wuhan-marathon` 三维场景服务，因此前端仍会把这两个自有服务标记为 `待发布`。

## 前端已完成的 SuperMap 接入边界

配置文件：

```text
src/config/supermap.ts
```

当前预留服务地址：

```text
http://127.0.0.1:8090/iserver/services/map-wuhan-marathon/rest/maps/武汉马拉松赛道
http://127.0.0.1:8090/iserver/services/3D-wuhan-marathon/rest/realspace
```

后续只需要把 iServer 中发布出的真实服务地址填入该配置文件，即可将地图面板从 SVG 示意替换为 SuperMap iClient 图层。服务发布步骤见：

```text
docs/supermap-publish-checklist.md
```

## 下一步合规开发任务

1. 使用 SuperMap iDesktopX 打开 DEM 数据，完成坐标系统一、坡度/高程衍生数据处理。
2. 导入当前工程中的候选路线和赛事保障点 GeoJSON。
3. 后续补充武汉路网、POI、行政边界等矢量数据。
4. 在 iDesktopX 中制作武汉马拉松二维地图和 DEM 三维场景。
5. 使用 iServer 发布以下服务：
   - 武汉马拉松二维地图服务。
   - 武汉 DEM 三维场景服务。
   - 路线指标空间分析服务。
6. 前端接入真实 iServer 服务：
   - 使用 iClient JavaScript 加载二维地图服务。
   - 使用 iClient3D for WebGL/WebGPU 加载三维地形服务。
   - 将示范路线数据替换为 iServer 返回的路线与指标数据。

## 比赛提交材料对应关系

| 官方提交项 | 本项目准备方向 |
| --- | --- |
| 工程源代码 | 当前仓库前端源码、配置、测试、文档 |
| 数据 | DEM、路网、POI、路线数据和数据说明表 |
| 运行文件 | 前端构建包 `dist`，iServer 服务配置说明 |
| 作品文档 | 系统介绍、部署说明、指标模型说明 |
| 精彩截图 | WebGIS 工作台、路线对比、导出报告截图 |
| 演示录像 | 按“选择路线 -> 对比指标 -> 输出推荐 -> 导出报告”录制 |
