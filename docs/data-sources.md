# 武汉马拉松赛道选型系统 — 数据来源指南

## 1. 武汉道路路网数据（最优先）

### 方案 A：公众号直接领（最快）
- **公众号**：立方数据学院
- **回复关键词**：517
- **数据**：2025年1月 OSM 武汉道路 Shapefile（WGS84，含道路等级字段 `fclass`）
- **备选关键词**：245（2024年数据）
- **来源**：OpenStreetMap，已按武汉市裁剪

### 方案 B：Overpass Turbo 在线导出
- 打开 https://overpass-turbo.eu/
- 粘贴以下查询语句，点击运行 → 导出 → 选 GeoJSON
```
[out:json][timeout:25];
area["name"="武汉市"]->.wuhan;
(
  way["highway"](area.wuhan);
);
out body;
>;
out skel qt;
```
- 优点：无需注册，直接导出 GeoJSON

### 方案 C：Geofabrik 下载全国数据自行裁剪
- https://download.geofabrik.de/ → Asia → China
- 下载 `china-latest-free.shp.zip`
- 用 QGIS 或 ogr2ogr 裁剪武汉范围：
  ```
  ogr2ogr -f GeoJSON wuhan_roads.geojson china_roads.shp -clipsrc 114.0 30.4 114.6 30.7
  ```

---

## 2. 赛事服务点 / POI 数据

### 高德地图 API（推荐）
- **注册**：https://lbs.amap.com（个人开发者，免费）
- **搜索类别**：医院、地铁站、停车场、公厕、商圈、公园
- **调用方式**：写 Python 脚本，按网格分块请求
- **额度**：个人版每日有免费调用次数

### OSM POI 数据
- 与路网同一渠道（立方数据学院或 Geofabrik）可一并下载

---

## 3. 历届武汉马拉松路线

- **维基百科**：搜索"武汉马拉松"，有历年路线文字描述
- **跑步 App**：Strava / 悦跑圈 / 咕咚 搜索"武汉马拉松"，有跑者上传的 GPX 轨迹
- **手工标注**：根据路线描述在 OSM 地图上标关键点，生成参考路线

### 历届路线关键点参考
- **起点**：沿江大道三阳路口
- **经典路段**：长江大桥、东湖绿道、江汉关、中山大道、楚河汉街
- **终点**：青山江滩（近年）
- **坐标范围**：约 114.0°E ~ 114.6°E, 30.4°N ~ 30.7°N

---

## 4. 起终点与必经点

手动在 OSM 或 Google Maps 上标点即可，参考坐标：
- 起点：114.302, 30.604（沿江大道三阳路口）
- 长江大桥：114.286, 30.545
- 东湖绿道入口：114.38, 30.55
- 青山江滩终点：114.395, 30.635

---

## 5. 桥梁数据（选填）

武汉主要过江通道坐标可在 OSM 路网中提取（字段中标记 bridge=yes），无需单独找数据。

---

## 6. 已有的数据

- **DEM 高程数据**：`test-temp/ASTGTMV003_N30E114_dem.tif`（ASTER GDEMV3，30m 分辨率，覆盖 E114°~E115°, N30°~N31°）
- **示范路线数据**：`public/data/wuhan-marathon-routes.geojson`（3 条候选路线）
- **示范服务点数据**：`public/data/wuhan-marathon-support-points.geojson`（15 个服务点）

# Local Road Network Data

The real Wuhan road network data is stored outside GitHub.

Current local files:

- `E:\SuperMap\data\wuhan_roads\wuhan-roads-overpass.geojson`
  - Source: OpenStreetMap via Overpass API
  - Coverage: Wuhan central marathon planning area
  - Size: about 9.4 MB
  - Feature count at download time: 24,941 road features
- `E:\SuperMap\data\osm\hubei-latest-free.shp.zip`
  - Source: Geofabrik Hubei OpenStreetMap extract
  - Confirmed road layer: `gis_osm_roads_free_1.shp`
  - Size: about 123 MB

These files should not be committed. If the browser app needs to test a local copy, place it under `public/data/local-*`; that pattern is ignored by Git.
