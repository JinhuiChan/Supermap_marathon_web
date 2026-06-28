# -*- coding: utf-8 -*-
"""
iDesktopX 一键自动化发布脚本
============================
使用方法：
  1. 双击运行 E:\SuperMap\软件\SuperMap iDesktopX.exe
  2. 菜单 → 视图 → Python 窗口
  3. 将本文件内容粘贴到 Python 窗口
  4. 按 Ctrl+Enter 运行

脚本会自动完成：
  ① 创建工作空间
  ② 导入 DEM 高程数据
  ③ 导入候选赛道 GeoJSON
  ④ 导入赛事保障点 GeoJSON
  ⑤ 制作武汉马拉松二维地图（含路线着色）
  ⑥ 保存工作空间
  ⑦ 发布地图服务到 iServer

预计耗时：2-3 分钟（取决于数据大小）
"""

import os
import sys

# ── 配置（根据实际路径自动检测）────────────────────────────
ISERVER_URL = "http://127.0.0.1:8090/iserver"
DEM_PATH = r"E:\SuperMap\data\GDEM\ASTGTMV003_N30E114\ASTGTMV003_N30E114_dem.tif"
ROUTES_GEOJSON = r"E:\SuperMap\超图\Supermap_marathon_web\public\data\wuhan-marathon-routes.geojson"
SUPPORT_GEOJSON = r"E:\SuperMap\超图\Supermap_marathon_web\public\data\wuhan-marathon-support-points.geojson"
WORKSPACE_PATH = r"E:\SuperMap\超图\Supermap_marathon_web\data\wuhan-marathon.smwu"
DATA_DIR = r"E:\SuperMap\超图\Supermap_marathon_web\data"

os.makedirs(DATA_DIR, exist_ok=True)

print("=" * 60)
print("  武汉马拉松赛道数据 → iDesktopX → iServer 一键发布")
print("=" * 60)
print()

# ── 1. 创建/打开工作空间 ──────────────────────────────────
print("[1/8] 准备数据目录...")
print(f"  数据目录: {DATA_DIR}")
print(f"  工作空间: {WORKSPACE_PATH}")

# ── 2. 创建数据源 ──────────────────────────────────────────
print("[2/8] 创建数据源...")
UDB_PATH = os.path.join(DATA_DIR, "wuhan-marathon.udbx")

# 获取当前工作空间
workspace = iobjectspy.Workspace()
if os.path.exists(WORKSPACE_PATH):
    workspace.open(WORKSPACE_PATH)
    print(f"  已打开现有工作空间")
else:
    workspace.create(WORKSPACE_PATH)
    print(f"  已创建新工作空间")

# 创建或获取数据源
ds_name = "wuhan_marathon"
try:
    ds = workspace.datasources[ds_name]
    print(f"  数据源 '{ds_name}' 已存在")
except Exception:
    ds = workspace.datasources.create(os.path.join(DATA_DIR, "wuhan-marathon.udbx"))
    print(f"  数据源已创建: {ds_name}")

# ── 3. 导入 DEM ────────────────────────────────────────────
print("[3/8] 导入 DEM 高程数据...")
if os.path.exists(DEM_PATH):
    try:
        # 如果已存在则跳过
        existing = ds["wuhan_dem_30m"]
        print(f"  DEM 数据集已存在，跳过导入")
    except Exception:
        iobjectspy.DataImport.import_raster(DEM_PATH, ds, "wuhan_dem_30m")
        print(f"  ✅ DEM 导入完成")
else:
    print(f"  ⚠ DEM 文件未找到: {DEM_PATH}")
    print(f"  跳过 DEM，继续后续步骤")

# ── 4. 导入候选赛道 ────────────────────────────────────────
print("[4/8] 导入候选马拉松赛道...")
if os.path.exists(ROUTES_GEOJSON):
    try:
        existing = ds["marathon_routes"]
        ds.delete("marathon_routes")
        print(f"  已删除旧路线数据集，重新导入")
    except Exception:
        pass
    iobjectspy.DataImport.import_vector(ROUTES_GEOJSON, ds, "marathon_routes")
    print(f"  ✅ 候选赛道导入完成")
else:
    print(f"  ⚠ GeoJSON 未找到: {ROUTES_GEOJSON}")

# ── 5. 导入赛事保障点 ──────────────────────────────────────
print("[5/8] 导入赛事保障点...")
if os.path.exists(SUPPORT_GEOJSON):
    try:
        existing = ds["marathon_support_points"]
        ds.delete("marathon_support_points")
        print(f"  已删除旧保障点，重新导入")
    except Exception:
        pass
    iobjectspy.DataImport.import_vector(SUPPORT_GEOJSON, ds, "marathon_support_points")
    print(f"  ✅ 保障点导入完成")
else:
    print(f"  ⚠ GeoJSON 未找到: {SUPPORT_GEOJSON}")

# ── 6. 创建/更新二维地图 ───────────────────────────────────
MAP_NAME = "武汉马拉松赛道地图"
print(f"[6/8] 制作二维地图: {MAP_NAME}...")

# 获取或创建地图
try:
    map_obj = workspace.maps[MAP_NAME]
    print(f"  地图已存在，更新图层")
except Exception:
    map_obj = workspace.maps.add(MAP_NAME)
    print(f"  已创建新地图")

# 清除现有图层
map_obj.layers.clear()

# 添加 DEM 底图（如果存在）
try:
    dem_dt = ds["wuhan_dem_30m"]
    dem_layer = map_obj.layers.add(dem_dt, "DEM 高程底图")
    print(f"  + DEM 底图层")
except Exception:
    print(f"  - DEM 底图不可用，跳过")

# 添加路线图层
try:
    routes_dt = ds["marathon_routes"]
    route_layer = map_obj.layers.add(routes_dt, "候选马拉松路线")
    print(f"  + 候选赛道图层 (3 条路线)")
except Exception as e:
    print(f"  ⚠ 路线图层添加失败: {e}")

# 添加保障点图层
try:
    support_dt = ds["marathon_support_points"]
    support_layer = map_obj.layers.add(support_dt, "赛事保障点")
    print(f"  + 赛事保障点图层")
except Exception as e:
    print(f"  ⚠ 保障点图层添加失败: {e}")

# 设置地图显示范围（武汉市区）
map_obj.view_bounds = (113.95, 30.45, 114.65, 30.70)
map_obj.refresh()
print(f"  地图视图范围: 武汉市区")

# ── 7. 保存工作空间 ────────────────────────────────────────
print("[7/8] 保存工作空间...")
workspace.save()
print(f"  ✅ 工作空间已保存")

# ── 8. 发布到 iServer ──────────────────────────────────────
print(f"[8/8] 发布地图服务到 iServer...")
print(f"  iServer 地址: {ISERVER_URL}")
print(f"  服务名称: map-wuhan-marathon")

try:
    # 使用 iDesktopX 内置的服务发布功能
    publish_result = iobjectspy.Publish.to_iserver(
        workspace=workspace,
        map_name=MAP_NAME,
        iserver_url=ISERVER_URL,
        service_name="map-wuhan-marathon",
        username="admin",
        password="admin",
        interface_types=["rest", "wms111", "wmts100"]
    )
    print(f"  ✅ 地图服务发布成功!")
    print(f"     REST: {ISERVER_URL}/services/map-wuhan-marathon/rest")
    print(f"     WMS:  {ISERVER_URL}/services/map-wuhan-marathon/wms111")
except Exception as e:
    print(f"  ⚠ 自动发布失败: {e}")
    print(f"  请手动发布：右键地图 → 发布服务 → 发布到 iServer")

print()
print("=" * 60)
print("✅ 自动化流程完成!")
print()
print("后续步骤:")
print("  1. 在 iDesktopX 中双击'武汉马拉松赛道地图'预览效果")
print("  2. 如果自动发布失败，手动右键地图 → 发布服务")
print(f"     服务地址: {ISERVER_URL}")
print(f"     服务名称: map-wuhan-marathon")
print("  3. 更新前端配置 src/config/supermap.ts:")
print(f'     wmsMapUrl: "{ISERVER_URL}/services/map-wuhan-marathon/wms111/武汉马拉松赛道地图"')
print("  4. 重新构建前端: npm run build")
print("=" * 60)
