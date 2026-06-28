# -*- coding: utf-8 -*-
"""
iDesktopX 数据准备辅助脚本
==========================

运行位置：
  只能在 SuperMap iDesktopX 的 Python 窗口中运行。

用途：
  1. 预检 DEM、GeoJSON、iServer 地址。
  2. 尝试创建工作空间和导入数据。
  3. 给出明确的手动发布地址。

说明：
  iServer 发布服务仍建议通过 iDesktopX 图形界面完成，因为不同 iDesktopX
  安装环境中的 Python API 暴露不完全一致。脚本不会保存任何账号密码。
"""

import os
import urllib.request

ISERVER_URL = "http://127.0.0.1:8090/iserver"
DEM_PATH = r"E:\SuperMap\data\GDEM\ASTGTMV003_N30E114\ASTGTMV003_N30E114_dem.tif"
ROUTES_GEOJSON = r"E:\SuperMap\超图\Supermap_marathon_web\public\data\wuhan-marathon-routes.geojson"
SUPPORT_GEOJSON = r"E:\SuperMap\超图\Supermap_marathon_web\public\data\wuhan-marathon-support-points.geojson"
DATA_DIR = r"E:\SuperMap\超图\Supermap_marathon_web\data"
WORKSPACE_PATH = os.path.join(DATA_DIR, "wuhan-marathon.smwu")
UDBX_PATH = os.path.join(DATA_DIR, "wuhan-marathon.udbx")
MAP_NAME = "武汉马拉松赛道地图"


def check_file(path, label):
    exists = os.path.exists(path)
    print(("[OK] " if exists else "[缺失] ") + label + ": " + path)
    return exists


def check_iserver():
    try:
        with urllib.request.urlopen(ISERVER_URL + "/services.json", timeout=5) as response:
            ok = response.status == 200
            print("[OK] iServer 服务列表可访问" if ok else "[异常] iServer 返回状态: " + str(response.status))
            return ok
    except Exception as exc:
        print("[异常] iServer 不可访问: " + str(exc))
        return False


def get_iobjectspy():
    try:
        import iobjectspy
        print("[OK] iObjectSpy 已加载")
        return iobjectspy
    except Exception as exc:
        print("[异常] 无法加载 iObjectSpy。请确认脚本是在 iDesktopX Python 窗口中运行。")
        print("      " + str(exc))
        return None


print("=" * 64)
print("武汉马拉松赛道 iDesktopX 数据准备")
print("=" * 64)

os.makedirs(DATA_DIR, exist_ok=True)
inputs_ok = all(
    [
        check_file(DEM_PATH, "武汉 DEM"),
        check_file(ROUTES_GEOJSON, "候选路线 GeoJSON"),
        check_file(SUPPORT_GEOJSON, "赛事保障点 GeoJSON"),
        check_iserver()
    ]
)

iobjectspy = get_iobjectspy()
if not inputs_ok or iobjectspy is None:
    print()
    print("预检未通过，已停止。请先修正上面的缺失项。")
    raise SystemExit(1)

print()
print("预检通过。开始尝试创建工作空间和导入数据。")

try:
    workspace = iobjectspy.Workspace()
    if os.path.exists(WORKSPACE_PATH):
        workspace.open(WORKSPACE_PATH)
        print("[OK] 已打开工作空间: " + WORKSPACE_PATH)
    else:
        workspace.create(WORKSPACE_PATH)
        print("[OK] 已创建工作空间: " + WORKSPACE_PATH)

    datasource = workspace.datasources.create(UDBX_PATH)
    print("[OK] 已创建数据源: " + UDBX_PATH)

    if hasattr(iobjectspy, "DataImport"):
        importer = iobjectspy.DataImport
        importer.import_raster(DEM_PATH, datasource, "wuhan_dem_30m")
        importer.import_vector(ROUTES_GEOJSON, datasource, "marathon_routes")
        importer.import_vector(SUPPORT_GEOJSON, datasource, "marathon_support_points")
        print("[OK] DEM、路线、保障点导入完成")
    else:
        print("[提示] 当前 iObjectSpy 未暴露 DataImport，请使用 iDesktopX 导入数据菜单导入三份数据。")

    workspace.save()
    print("[OK] 工作空间已保存")
except Exception as exc:
    print("[异常] 自动导入未完成: " + str(exc))
    print("      请按 docs/idesktopx-publishing-workflow.md 使用图形界面导入。")

print()
print("=" * 64)
print("下一步：在 iDesktopX 中制作地图并发布服务")
print("地图名称: " + MAP_NAME)
print("服务名: map-wuhan-marathon")
print("REST: " + ISERVER_URL + "/services/map-wuhan-marathon/rest/maps/" + MAP_NAME)
print("WMS:  " + ISERVER_URL + "/services/map-wuhan-marathon/wms111/" + MAP_NAME)
print("=" * 64)
