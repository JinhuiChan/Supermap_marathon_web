export type BasemapMode = "online" | "supermapDem";

export const superMapConfig = {
  version: "SuperMap GIS 2025 Update1 / V12.0.1.0",
  iServerBaseUrl: "http://127.0.0.1:8090/iserver",

  leafletJsUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  leafletCssUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",

  defaultBasemap: "supermapDem" as BasemapMode,
  onlineBasemap: {
    name: "在线真实地图",
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors"
  },

  // Published from iDesktopX on this machine.
  wmsMapUrl: "http://127.0.0.1:8090/iserver/services/map-wuhan-road-network/wms111",
  wmsLayerName: "0",

  // iClient references for later spatial query / 3D enhancement work.
  iClientJavaScriptUrl: "http://127.0.0.1:8090/iserver/iClient/forJavaScript/web/index.html",
  iClient3DUrl: "http://127.0.0.1:8090/iserver/iClient/for3D/webgl/index.html",

  expectedMapServiceUrl: "http://127.0.0.1:8090/iserver/services/map-wuhan-road-network/rest/maps/road_network_osm%40wuhan_marathon_base",
  expectedSceneServiceUrl: "http://127.0.0.1:8090/iserver/services/3D-wuhan-marathon/rest/realspace",

  fallbackMapService: "http://127.0.0.1:8090/iserver/services/map-world/rest",
  fallbackSceneService: "http://127.0.0.1:8090/iserver/services/3D-CBD/rest",

  displayRoadNetworkGeoJsonUrl: "data/local-wuhan-road-network-osm.geojson",
  routingRoadNetworkGeoJsonUrl: "data/local-wuhan-marathon-area-roads.geojson",

  mapCenter: [114.32, 30.58] as [number, number],
  mapZoom: 12,

  demDataPath: "E:\\SuperMap\\data\\GDEM\\ASTGTMV003_N30E114\\ASTGTMV003_N30E114_dem.tif",
  demMetadata: {
    name: "ASTGTMV003_N30E114",
    crs: "WGS 84 / EPSG:4326",
    size: "3601 x 3601",
    bounds: "113.9999E-115.0001E, 29.9999N-31.0001N",
    elevationRange: "-135m 至 771m"
  }
} as const;
