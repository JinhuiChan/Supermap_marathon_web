# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

基于 SuperMap WebGIS 的马拉松赛道智能选型与多路线对比分析系统。研究区域：武汉市全域。核心业务：赛道智能生成 + 多路线量化对比。目标用户：赛事组委会（方案评审）+ 大众跑者（难度预判）。

详细设计文档见 [超图马拉松开发赛道流程设计.md](超图马拉松开发赛道流程设计.md) 和 [马拉松.md](马拉松.md)。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端框架 | 待定（SuperMap iClient for Leaflet/OpenLayers + iClient3D for Cesium + ECharts） |
| 前端语言 | JavaScript / TypeScript |
| 数据处理 | Python（GDAL, Fiona, Shapely, NumPy, Pandas） |
| GIS 桌面端 | SuperMap iDesktopX 2026（数据处理、专题图、三维场景） |
| GIS 服务端 | SuperMap iServer 2026（地图/场景/空间分析服务发布） |
| 空间数据库 | PostgreSQL + PostGIS（待定） |
| 版控 | Git + GitHub |
| 运行环境 | Node.js（前端开发/打包） |

## 开发策略

**核心原则**：先跑通"有路线 → 有指标 → 能对比 → 有结论 → 能展示 → 能导出"的最小闭环，再补强算法和三维效果。

**兜底策略**：
- 赛道自动生成不稳 → 用预置候选路线库演示对比分析
- 三维性能不足 → 以二维地图 + 图表为主，三维做截图/视频备份
- 真实 POI 不足 → 先用示范 POI 数据保证流程完整
- iServer 联调受阻 → 前端先用本地 mock 数据，后续平滑切换

## 目录结构（规划）

```
├── data/               # DEM、路网、POI 等原始数据（不入 git）
├── scripts/            # Python 数据处理与指标计算脚本
├── web/                # 前端 Web 系统源码
├── docs/               # 技术文档与答辩材料
├── iserver/            # iServer 服务配置说明
└── README.md
```

## 项目状态

当前处于规划阶段，尚无代码。团队成员：陈锦辉（队长）、Tar0tSa1k0、柴源。
