# -*- coding: utf-8 -*-
"""
iDesktopX data preparation script for the Wuhan marathon demo.

Run inside SuperMap iDesktopX Python window:
    exec(open(r"E:\SuperMap\超图\Supermap_marathon_web\scripts\auto_publish.py",
              encoding="utf-8").read())

The script imports local DEM and GeoJSON data into a SuperMap datasource, creates
one map named "武汉马拉松赛道地图", and saves a workspace that can be published
from iDesktopX or iServer Manager.
"""

from __future__ import annotations

import os
import urllib.request

import iobjectspy as sm
from iobjectspy.mapping import Map


PROJECT_DIR = r"E:\SuperMap\超图\Supermap_marathon_web"
WORKSPACE_DIR = os.path.join(PROJECT_DIR, "supermap-workspace")
WORKSPACE_PATH = os.path.join(WORKSPACE_DIR, "wuhan-marathon.smwu")
DATASOURCE_PATH = os.path.join(WORKSPACE_DIR, "wuhan-marathon.udbx")

DEM_PATH = r"E:\SuperMap\data\GDEM\ASTGTMV003_N30E114\ASTGTMV003_N30E114_dem.tif"
ROUTES_GEOJSON = os.path.join(PROJECT_DIR, "public", "data", "wuhan-marathon-routes.geojson")
SUPPORT_GEOJSON = os.path.join(PROJECT_DIR, "public", "data", "wuhan-marathon-support-points.geojson")

ISERVER_URL = "http://127.0.0.1:8090/iserver"
MAP_NAME = "武汉马拉松赛道地图"
SERVICE_NAME = "map-wuhan-marathon"


def check_file(path: str, label: str) -> bool:
    exists = os.path.exists(path)
    print(("[OK] " if exists else "[缺失] ") + label + ": " + path)
    return exists


def check_iserver() -> bool:
    try:
        with urllib.request.urlopen(ISERVER_URL + "/services.json", timeout=5) as response:
            ok = response.status == 200
            print("[OK] iServer 可访问" if ok else "[异常] iServer 返回状态: " + str(response.status))
            return ok
    except Exception as exc:  # noqa: BLE001 - printed for iDesktopX console users.
        print("[异常] iServer 不可访问: " + str(exc))
        return False


def reset_output_dir() -> None:
    os.makedirs(WORKSPACE_DIR, exist_ok=True)


def workspace_connection_info() -> sm.WorkspaceConnectionInfo:
    return sm.WorkspaceConnectionInfo(
        server=WORKSPACE_PATH,
        workspace_type=sm.WorkspaceType.SMWU,
        name="wuhan-marathon"
    )


def import_data(datasource):
    print("[导入] 路线 GeoJSON")
    route_datasets = sm.import_geojson(
        ROUTES_GEOJSON,
        datasource,
        out_dataset_name="marathon_routes",
        import_mode=sm.ImportMode.OVERWRITE,
        source_file_charset="UTF-8"
    )

    print("[导入] 保障点 GeoJSON")
    support_datasets = sm.import_geojson(
        SUPPORT_GEOJSON,
        datasource,
        out_dataset_name="marathon_support_points",
        import_mode=sm.ImportMode.OVERWRITE,
        source_file_charset="UTF-8"
    )

    print("[导入] 武汉 DEM GeoTIFF")
    dem_datasets = sm.import_tif(
        DEM_PATH,
        datasource,
        out_dataset_name="wuhan_dem_30m",
        is_import_as_grid=True,
        is_build_pyramid=True
    )

    return route_datasets, support_datasets, dem_datasets


def resolve_datasets(datasource, dataset_refs):
    resolved = []
    for dataset_ref in dataset_refs:
        if isinstance(dataset_ref, str):
            resolved.append(datasource.get_dataset(dataset_ref))
        else:
            resolved.append(dataset_ref)
    return [dataset for dataset in resolved if dataset is not None]


def find_existing_dataset(datasource, candidates):
    for name in candidates:
        try:
            dataset = datasource.get_dataset(name)
            if dataset is not None:
                return dataset
        except Exception:
            pass
    return None


def get_existing_datasets(datasource):
    routes = find_existing_dataset(datasource, ["marathon_routes_L", "marathon_routes"])
    support = find_existing_dataset(datasource, ["marathon_support_points", "marathon_support_points_P"])
    dem = find_existing_dataset(datasource, ["wuhan_dem_30m"])
    if routes and support and dem:
        print("[OK] 复用已导入的数据集")
        return [routes], [support], [dem]
    return None


def make_map(workspace, datasource, datasets) -> None:
    route_datasets, support_datasets, dem_datasets = datasets
    route_datasets = resolve_datasets(datasource, route_datasets)
    support_datasets = resolve_datasets(datasource, support_datasets)
    dem_datasets = resolve_datasets(datasource, dem_datasets)

    map_obj = Map()
    map_obj.set_name(MAP_NAME)

    for dataset in dem_datasets:
        map_obj.add_dataset(dataset, is_add_to_head=False)
    for dataset in route_datasets:
        map_obj.add_dataset(dataset, is_add_to_head=True)
    for dataset in support_datasets:
        map_obj.add_dataset(dataset, is_add_to_head=True)

    map_obj.view_entire()
    if MAP_NAME in [item.get_name() for item in workspace.get_maps()]:
        workspace.set_map(MAP_NAME, map_obj)
    else:
        workspace.add_map(MAP_NAME, map_obj)


def main() -> None:
    print("=" * 72)
    print("武汉马拉松赛道 iDesktopX 数据准备")
    print("=" * 72)

    inputs_ok = all(
        [
            check_file(DEM_PATH, "武汉 DEM"),
            check_file(ROUTES_GEOJSON, "候选路线 GeoJSON"),
            check_file(SUPPORT_GEOJSON, "赛事保障点 GeoJSON"),
            check_iserver(),
        ]
    )
    if not inputs_ok:
        print("[停止] 预检未通过，请先修复缺失项。")
        raise SystemExit(1)

    reset_output_dir()

    workspace = sm.Workspace()
    try:
        datasource = None
        try:
            datasource = workspace.get_datasource("wuhan-marathon")
        except Exception:
            datasource = None

        if datasource is None:
            created_workspace = workspace.create(workspace_connection_info(), save_existed=False)
            if created_workspace is not None:
                workspace = created_workspace
            else:
                workspace = sm.Workspace()

            try:
                datasource = workspace.create_datasource(DATASOURCE_PATH)
            except Exception:
                workspace = sm.Workspace()
                datasource = workspace.create_datasource(DATASOURCE_PATH)

        datasets = get_existing_datasets(datasource) or import_data(datasource)
        make_map(workspace, datasource, datasets)

        workspace.save()
        print("[OK] 工作空间已保存: " + WORKSPACE_PATH)
        print("[OK] 数据源已保存: " + DATASOURCE_PATH)
        print("[OK] 地图名称: " + MAP_NAME)
    finally:
        workspace.close()

    print()
    print("下一步发布参数：")
    print("服务名称: " + SERVICE_NAME)
    print("发布工作空间: " + WORKSPACE_PATH)
    print("REST 目标: " + ISERVER_URL + "/services/" + SERVICE_NAME + "/rest/maps/" + MAP_NAME)
    print("WMS 目标:  " + ISERVER_URL + "/services/" + SERVICE_NAME + "/wms111/" + MAP_NAME)
    print("=" * 72)


main()
