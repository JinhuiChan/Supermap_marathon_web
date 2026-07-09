export type BasemapMode = "localVector" | "online" | "supermapDem";

const iServerBaseUrl = "http://127.0.0.1:8090/iserver";

export const superMapConfig = {
  version: "SuperMap GIS 2025 Update1 / V12.0.1.0",
  iServerBaseUrl,

  leafletJsUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  leafletCssUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",

  defaultBasemap: "supermapDem" as BasemapMode,
  localVectorBasemap: {
    name: "本地仿 OSM 矢量底图",
    attribution: "Local OSM/SuperMap vector layers"
  },
  onlineBasemap: {
    name: "在线真实地图",
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors"
  },

  serviceUrls: {
    roadMapWms: `${iServerBaseUrl}/services/map-wuhan-road-network/wms111`,
    roadMapRest: `${iServerBaseUrl}/services/map-wuhan-road-network/rest`,
    roadDataRest: `${iServerBaseUrl}/services/data-wuhan-road-network/rest`,
    poiDataRest: `${iServerBaseUrl}/services/data-wuhan-poi/rest`,
    constraintMapRest: `${iServerBaseUrl}/services/map-wuhan-constraints/rest`,
    constraintMapWms: `${iServerBaseUrl}/services/map-wuhan-constraints/wms111`,
    demSlopeMapRest: `${iServerBaseUrl}/services/map-wuhan-dem-slope/rest`,
    demSlopeMapWms: `${iServerBaseUrl}/services/map-wuhan-dem-slope/wms111`
  },

  // Published from iDesktopX on this machine.
  wmsMapUrl: `${iServerBaseUrl}/services/map-wuhan-road-network/wms111`,
  wmsLayerName: "0",

  // iClient references for later spatial query / 3D enhancement work.
  iClientJavaScriptUrl: `${iServerBaseUrl}/iClient/forJavaScript/web/index.html`,
  iClient3DUrl: `${iServerBaseUrl}/iClient/for3D/webgl/index.html`,

  expectedMapServiceUrl: `${iServerBaseUrl}/services/map-wuhan-road-network/rest/maps/road_network_osm%40wuhan_marathon_base`,
  expectedSceneServiceUrl: `${iServerBaseUrl}/services/3D-wuhan-marathon/rest/realspace`,

  fallbackMapService: `${iServerBaseUrl}/services/map-world/rest`,
  fallbackSceneService: `${iServerBaseUrl}/services/3D-CBD/rest`,

  displayRoadNetworkGeoJsonUrl: "data/local-wuhan-road-network-osm.geojson",
  routingRoadNetworkGeoJsonUrl: "data/local-wuhan-marathon-area-roads.geojson",
  constraintLayerUrls: {
    waterArea: "data/gis/constraint_water_area.geojson",
    waterLine: "data/gis/constraint_water_line.geojson",
    sensitiveHospital: "data/gis/constraint_sensitive_hospital_area.geojson",
    sensitiveSchool: "data/gis/constraint_sensitive_school_area.geojson",
    parks: "data/gis/park_green_osm.geojson",
    commercialPotential: "data/gis/poi_commercial_potential_area.geojson",
    trafficStation: "data/gis/poi_traffic_station_area.geojson"
  },

  mapCenter: [114.32, 30.58] as [number, number],
  mapZoom: 12,

  demDataPath: "E:\\SuperMap\\data\\GDEM\\ASTGTMV003_N30E114\\ASTGTMV003_N30E114_dem.tif",
  slopeDataPath: "E:\\SuperMap\\data\\dataset\\dataset\\武汉市_30米分辨率坡度数据",
  demMetadata: {
    name: "ASTGTMV003_N30E114 / Wuhan slope rasters",
    crs: "WGS 84 / EPSG:4326",
    size: "3601 x 3601 DEM plus local 30m slope rasters",
    bounds: "113.9999E-115.0001E, 29.9999N-31.0001N",
    elevationRange: "-135m 至 771m"
  }
} as const;
