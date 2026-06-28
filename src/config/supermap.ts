export const superMapConfig = {
  version: "SuperMap GIS 2025 Update1 / V12.0.1.0",
  iServerBaseUrl: "http://127.0.0.1:8090/iserver",
  iClientJavaScriptUrl: "http://127.0.0.1:8090/iserver/iClient/forJavaScript/web/index.html",
  iClient3DUrl: "http://127.0.0.1:8090/iserver/iClient/for3D/webgl/index.html",

  // Target services (to be published via iDesktopX)
  expectedMapServiceUrl: "http://127.0.0.1:8090/iserver/services/map-wuhan-marathon/rest/maps/武汉马拉松赛道",
  expectedSceneServiceUrl: "http://127.0.0.1:8090/iserver/services/3D-wuhan-marathon/rest/realspace",

  // Fallback services (already available on iServer)
  fallbackMapService: "http://127.0.0.1:8090/iserver/services/map-world/rest",
  fallbackSceneService: "http://127.0.0.1:8090/iserver/services/3D-CBD/rest",

  // Map view defaults (Wuhan area)
  mapCenter: [114.32, 30.58] as [number, number],
  mapZoom: 12,

  // DEM data
  demDataPath: "E:\\SuperMap\\data\\GDEM\\ASTGTMV003_N30E114\\ASTGTMV003_N30E114_dem.tif",
  demMetadata: {
    name: "ASTGTMV003_N30E114",
    crs: "WGS 84 / EPSG:4326",
    size: "3601 x 3601",
    bounds: "113.9999E-115.0001E, 29.9999N-31.0001N",
    elevationRange: "-135m 至 771m"
  }
} as const;
