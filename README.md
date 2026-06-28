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
