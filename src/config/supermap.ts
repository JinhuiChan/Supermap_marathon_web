export const superMapConfig = {
  version: "SuperMap GIS 2025 Update1 / V12.0.1.0",
  iServerBaseUrl: "http://127.0.0.1:8090/iserver",
  iClientJavaScriptUrl: "http://127.0.0.1:8090/iserver/iClient/forJavaScript/index.html",
  iClient3DUrl: "http://127.0.0.1:8090/iserver/iClient/for3D/webgl/index.html",
  expectedMapServiceUrl: "http://127.0.0.1:8090/iserver/services/map-wuhan-marathon/rest/maps/武汉马拉松赛道",
  expectedSceneServiceUrl: "http://127.0.0.1:8090/iserver/services/3D-wuhan-marathon/rest/realspace",
  demDataPath: "E:\\SuperMap\\data\\GDEM\\ASTGTMV003_N30E114\\ASTGTMV003_N30E114_dem.tif",
  demMetadata: {
    name: "ASTGTMV003_N30E114",
    crs: "WGS 84 / EPSG:4326",
    size: "3601 x 3601",
    bounds: "113.9999E-115.0001E, 29.9999N-31.0001N",
    elevationRange: "-135m 至 771m"
  }
} as const;
