# -*- coding: utf-8 -*-
r"""
iDesktopX data preparation script for the Wuhan marathon demo.

Run inside the SuperMap iDesktopX Python window:
    exec(open("E:\\SuperMap\\\u8d85\u56fe\\Supermap_marathon_web\\scripts\\auto_publish.py",
              encoding="utf-8").read())

The script imports road, route, polygon constraint and DEM datasets into a
SuperMap UDBX datasource, then creates three maps prepared for iServer:

  - road_network_osm@wuhan_marathon_base -> map-wuhan-road-network
  - wuhan_marathon_constraints -> map-wuhan-constraints
  - wuhan_dem_slope -> map-wuhan-dem-slope
"""

from __future__ import annotations

import os
import urllib.request

import iobjectspy as sm
from iobjectspy.mapping import Map


PROJECT_DIR = "E:\\SuperMap\\\u8d85\u56fe\\Supermap_marathon_web"
WORKSPACE_DIR = os.path.join(PROJECT_DIR, "supermap-workspace")
WORKSPACE_PATH = os.path.join(WORKSPACE_DIR, "wuhan-marathon.smwu")
DATASOURCE_PATH = os.path.join(WORKSPACE_DIR, "wuhan-marathon.udbx")

ROAD_NETWORK_GEOJSON = os.path.join(PROJECT_DIR, "public", "data", "local-wuhan-road-network-osm.geojson")
ROUTES_GEOJSON = os.path.join(PROJECT_DIR, "public", "data", "wuhan-marathon-routes.geojson")
SUPPORT_GEOJSON = os.path.join(PROJECT_DIR, "public", "data", "wuhan-marathon-support-points.geojson")
DEM_PATH = "E:\\SuperMap\\data\\GDEM\\ASTGTMV003_N30E114\\ASTGTMV003_N30E114_dem.tif"

CONSTRAINT_GEOJSON_LAYERS = [
    ("constraint_water_area", "water area polygons", os.path.join(PROJECT_DIR, "public", "data", "gis", "constraint_water_area.geojson")),
    ("constraint_water_line", "water lines", os.path.join(PROJECT_DIR, "public", "data", "gis", "constraint_water_line.geojson")),
    ("constraint_sensitive_hospital_area", "hospital sensitive polygons", os.path.join(PROJECT_DIR, "public", "data", "gis", "constraint_sensitive_hospital_area.geojson")),
    ("constraint_sensitive_school_area", "school sensitive polygons", os.path.join(PROJECT_DIR, "public", "data", "gis", "constraint_sensitive_school_area.geojson")),
    ("park_green_osm", "park and green polygons", os.path.join(PROJECT_DIR, "public", "data", "gis", "park_green_osm.geojson")),
    ("poi_commercial_potential_area", "commercial potential polygons", os.path.join(PROJECT_DIR, "public", "data", "gis", "poi_commercial_potential_area.geojson")),
    ("poi_traffic_station_area", "traffic station polygons", os.path.join(PROJECT_DIR, "public", "data", "gis", "poi_traffic_station_area.geojson")),
]

ISERVER_URL = "http://127.0.0.1:8090/iserver"

ROAD_MAP_NAME = "road_network_osm@wuhan_marathon_base"
CONSTRAINT_MAP_NAME = "wuhan_marathon_constraints"
DEM_SLOPE_MAP_NAME = "wuhan_dem_slope"

ROAD_MAP_SERVICE_NAME = "map-wuhan-road-network"
CONSTRAINT_MAP_SERVICE_NAME = "map-wuhan-constraints"
DEM_SLOPE_MAP_SERVICE_NAME = "map-wuhan-dem-slope"


def check_file(path: str, label: str, required: bool = True) -> bool:
    exists = os.path.exists(path)
    if exists:
        print("[OK] " + label + ": " + path)
        return True
    if required:
        print("[MISSING] " + label + ": " + path)
        return False
    print("[SKIP] Optional " + label + " not found: " + path)
    return True


def check_iserver() -> bool:
    try:
        with urllib.request.urlopen(ISERVER_URL + "/services.json", timeout=5) as response:
            ok = response.status == 200
            if ok:
                print("[OK] iServer is reachable")
            else:
                print("[WARN] iServer status: " + str(response.status))
            return ok
    except Exception as exc:  # noqa: BLE001 - visible diagnostic for iDesktopX users.
        print("[WARN] iServer is not reachable: " + str(exc))
        return False


def workspace_connection_info() -> sm.WorkspaceConnectionInfo:
    return sm.WorkspaceConnectionInfo(
        server=WORKSPACE_PATH,
        workspace_type=sm.WorkspaceType.SMWU,
        name="wuhan-marathon",
    )


def open_or_create_workspace() -> sm.Workspace:
    os.makedirs(WORKSPACE_DIR, exist_ok=True)

    workspace = sm.Workspace()
    if os.path.exists(WORKSPACE_PATH):
        print("[OPEN] Existing workspace: " + WORKSPACE_PATH)
        try:
            opened = workspace.open(workspace_connection_info())
            if opened is not None and opened is not False:
                workspace = opened
            return workspace
        except Exception as exc:  # noqa: BLE001
            print("[WARN] Existing workspace open failed, will create a workspace object: " + str(exc))
            workspace = sm.Workspace()

    print("[CREATE] Workspace: " + WORKSPACE_PATH)
    created = workspace.create(workspace_connection_info(), save_existed=True)
    if created is not None and created is not False:
        workspace = created
    return workspace


def open_or_create_datasource(workspace):
    if os.path.exists(DATASOURCE_PATH):
        try:
            print("[OPEN] Existing datasource file: " + DATASOURCE_PATH)
            return sm.Datasource.open(DATASOURCE_PATH)
        except Exception as exc:  # noqa: BLE001
            print("[WARN] Existing datasource file open failed: " + str(exc))

    for alias in ("wuhan-marathon", "wuhan_marathon", "wuhan_marathon_base"):
        try:
            datasource = workspace.get_datasource(alias)
            if datasource is not None:
                print("[OPEN] Existing datasource alias: " + alias)
                return datasource
        except Exception:
            pass

    try:
        datasources = workspace.datasources()
    except Exception:
        datasources = []
    for datasource in datasources or []:
        try:
            if DATASOURCE_PATH.replace("\\", "/").lower() in str(datasource).replace("\\", "/").lower():
                print("[OPEN] Existing datasource from workspace datasource list")
                return datasource
        except Exception:
            pass

    print("[CREATE] Datasource: " + DATASOURCE_PATH)
    return workspace.create_datasource(DATASOURCE_PATH)


def import_geojson_dataset(datasource, path: str, dataset_name: str, label: str, required: bool = True):
    if not os.path.exists(path):
        if required:
            raise FileNotFoundError(path)
        print("[SKIP] Optional " + label + " not found")
        return []

    print("[IMPORT] " + label)
    return sm.import_geojson(
        path,
        datasource,
        out_dataset_name=dataset_name,
        import_mode=sm.ImportMode.OVERWRITE,
        source_file_charset="UTF-8",
    )


def import_tif_dataset(datasource, path: str, dataset_name: str, label: str, required: bool = True):
    if not os.path.exists(path):
        if required:
            raise FileNotFoundError(path)
        print("[SKIP] Optional " + label + " not found")
        return []

    print("[IMPORT] " + label)
    return sm.import_tif(
        path,
        datasource,
        out_dataset_name=dataset_name,
        is_import_as_grid=True,
        is_build_pyramid=True,
    )


def import_data(datasource):
    road_datasets = import_geojson_dataset(
        datasource,
        ROAD_NETWORK_GEOJSON,
        "road_network_osm",
        "Wuhan OSM road network GeoJSON",
    )
    route_datasets = import_geojson_dataset(
        datasource,
        ROUTES_GEOJSON,
        "marathon_routes",
        "candidate routes GeoJSON",
        required=False,
    )
    support_datasets = import_geojson_dataset(
        datasource,
        SUPPORT_GEOJSON,
        "marathon_support_points",
        "marathon support points GeoJSON",
        required=False,
    )
    constraint_datasets = []
    for dataset_name, label, path in CONSTRAINT_GEOJSON_LAYERS:
        constraint_datasets.extend(import_geojson_dataset(datasource, path, dataset_name, label))
    dem_datasets = import_tif_dataset(datasource, DEM_PATH, "wuhan_dem_30m", "Wuhan DEM GeoTIFF")

    return {
        "road": road_datasets,
        "routes": route_datasets,
        "support": support_datasets,
        "constraints": constraint_datasets,
        "dem": dem_datasets,
    }


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


def find_existing_datasets(datasource, dataset_names):
    datasets = []
    for name in dataset_names:
        dataset = find_existing_dataset(datasource, [name, name + "_L", name + "_P", name + "_R"])
        if dataset is not None:
            datasets.append(dataset)
    return datasets


def get_existing_datasets(datasource):
    road = find_existing_datasets(datasource, ["road_network_osm"])
    constraints = find_existing_datasets(datasource, [item[0] for item in CONSTRAINT_GEOJSON_LAYERS])
    dem = find_existing_datasets(datasource, ["wuhan_dem_30m"])
    if road and len(constraints) == len(CONSTRAINT_GEOJSON_LAYERS) and dem:
        print("[OK] Reusing imported road, constraint and DEM datasets")
        return {
            "road": road,
            "routes": find_existing_datasets(datasource, ["marathon_routes"]),
            "support": find_existing_datasets(datasource, ["marathon_support_points"]),
            "constraints": constraints,
            "dem": dem,
        }
    return None


def upsert_map(workspace, map_name: str, datasets, add_to_head: bool = True) -> None:
    map_obj = Map()
    map_obj.set_name(map_name)
    for dataset in datasets:
        map_obj.add_dataset(dataset, is_add_to_head=add_to_head)
    map_obj.view_entire()

    existing_map_names = [item.get_name() for item in workspace.get_maps()]
    if map_name in existing_map_names:
        workspace.set_map(map_name, map_obj)
    else:
        workspace.add_map(map_name, map_obj)


def make_maps(workspace, datasource, datasets) -> None:
    road_datasets = resolve_datasets(datasource, datasets["road"])
    route_datasets = resolve_datasets(datasource, datasets["routes"])
    support_datasets = resolve_datasets(datasource, datasets["support"])
    constraint_datasets = resolve_datasets(datasource, datasets["constraints"])
    dem_datasets = resolve_datasets(datasource, datasets["dem"])

    upsert_map(workspace, ROAD_MAP_NAME, road_datasets + route_datasets + support_datasets)
    upsert_map(workspace, CONSTRAINT_MAP_NAME, constraint_datasets)
    upsert_map(workspace, DEM_SLOPE_MAP_NAME, dem_datasets, add_to_head=False)


def print_publish_target(service_name: str, map_name: str) -> None:
    print("Service name: " + service_name)
    print("REST target: " + ISERVER_URL + "/services/" + service_name + "/rest/maps/" + map_name)
    print("WMS target:  " + ISERVER_URL + "/services/" + service_name + "/wms111/" + map_name)


def main() -> None:
    print("=" * 72)
    print("Wuhan marathon iDesktopX data preparation")
    print("=" * 72)

    inputs_ok = all(
        [
            check_file(ROAD_NETWORK_GEOJSON, "Wuhan OSM road network GeoJSON"),
            check_file(ROUTES_GEOJSON, "candidate routes GeoJSON", required=False),
            check_file(SUPPORT_GEOJSON, "marathon support points GeoJSON", required=False),
            check_file(DEM_PATH, "Wuhan DEM"),
            *[check_file(path, label) for _, label, path in CONSTRAINT_GEOJSON_LAYERS],
            check_iserver(),
        ]
    )
    if not inputs_ok:
        print("[STOP] Precheck failed; fix missing required files first.")
        raise SystemExit(1)

    workspace = open_or_create_workspace()
    try:
        datasource = open_or_create_datasource(workspace)
        datasets = get_existing_datasets(datasource) or import_data(datasource)
        make_maps(workspace, datasource, datasets)

        workspace.save()
        print("[OK] Workspace saved: " + WORKSPACE_PATH)
        print("[OK] Datasource ready: " + DATASOURCE_PATH)
        print("[OK] Road map: " + ROAD_MAP_NAME)
        print("[OK] Constraint map: " + CONSTRAINT_MAP_NAME)
        print("[OK] DEM/slope map: " + DEM_SLOPE_MAP_NAME)
    finally:
        workspace.close()

    print()
    print("Next iServer publish parameters:")
    print("Publish workspace: " + WORKSPACE_PATH)
    print_publish_target(ROAD_MAP_SERVICE_NAME, ROAD_MAP_NAME)
    print_publish_target(CONSTRAINT_MAP_SERVICE_NAME, CONSTRAINT_MAP_NAME)
    print_publish_target(DEM_SLOPE_MAP_SERVICE_NAME, DEM_SLOPE_MAP_NAME)
    print("=" * 72)


main()
