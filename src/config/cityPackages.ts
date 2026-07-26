import type { MapPoiLabel } from "../map/layers/PoiLabelLayer";
import { recommendAutoControlPointRoutePlan } from "../data/controlPointRecommender";
import type { WaypointRoutePlan } from "../data/profileRoutePlanner";
import { waypointRoutePlans } from "../data/profileRoutePlanner";
import type { SupportPoint } from "../data/supportPoints";
import { supportPoints } from "../data/supportPoints";
import { wuhanLandmarkPoiLabels } from "../data/wuhanLandmarks";
import { wuhanRoutingProfile, type CityRoutingProfile } from "./cityRoutingProfiles";

export type BasemapMode = "supermapDem";

export interface SuperMapCityConfig {
  version: string;
  iServerBaseUrl: string;
  leafletJsUrl: string;
  leafletCssUrl: string;
  defaultBasemap: BasemapMode;
  serviceUrls: {
    roadMapWms: string;
    roadMapRest: string;
    roadDataRest: string;
    poiDataRest: string;
    constraintMapRest: string;
    constraintMapWms: string;
    demSlopeMapRest: string;
    demSlopeMapWms: string;
  };
  wmsMapUrl: string;
  wmsLayerName: string;
  iClientJavaScriptUrl: string;
  expectedMapServiceUrl: string;
  basemapPolicy: string;
  displayRoadNetworkGeoJsonUrl: string;
  routingRoadNetworkGeoJsonUrl: string;
  routingRoadNetworkGeoJsonUrls: {
    area: string;
    fullOsm: string;
  };
  constraintLayerUrls: {
    waterArea: string;
    waterLine: string;
    sensitiveHospital: string;
    sensitiveSchool: string;
    parks: string;
    commercialPotential: string;
    trafficStation: string;
  };
  demDataPath: string;
  slopeDataPath: string;
  demMetadata: {
    name: string;
    crs: string;
    size: string;
    bounds: string;
    elevationRange: string;
  };
}

export interface CityPackage {
  id: string;
  name: string;
  displayName: string;
  marathonName: string;
  mapCenter: [number, number];
  mapZoom: number;
  superMap: SuperMapCityConfig;
  routePlans: WaypointRoutePlan[];
  supportPoints: SupportPoint[];
  landmarks: MapPoiLabel[];
  routingProfile: CityRoutingProfile;
}

const iServerBaseUrl = "http://127.0.0.1:8090/iserver";

export const wuhanRoutePlans: WaypointRoutePlan[] = [
  ...waypointRoutePlans,
  recommendAutoControlPointRoutePlan({
    cityId: "wuhan",
    manualRoutePlans: waypointRoutePlans,
    landmarks: wuhanLandmarkPoiLabels,
    supportPoints,
    routingProfile: wuhanRoutingProfile
  })
];

export const wuhanCityPackage: CityPackage = {
  id: "wuhan",
  name: "武汉",
  displayName: "武汉马拉松",
  marathonName: "马拉松赛道空间选线平台",
  mapCenter: [114.32, 30.58],
  mapZoom: 12,
  routePlans: wuhanRoutePlans,
  supportPoints,
  landmarks: wuhanLandmarkPoiLabels,
  routingProfile: wuhanRoutingProfile,
  superMap: {
    version: "SuperMap GIS 2025 Update1 / V12.0.1.0",
    iServerBaseUrl,

    leafletJsUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    leafletCssUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",

    defaultBasemap: "supermapDem",

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

    wmsMapUrl: `${iServerBaseUrl}/services/map-wuhan-road-network/wms111`,
    wmsLayerName: "0",

    iClientJavaScriptUrl: `${iServerBaseUrl}/iClient/forJavaScript/web/index.html`,

    expectedMapServiceUrl: `${iServerBaseUrl}/services/map-wuhan-road-network/rest/maps/road_network_osm%40wuhan_marathon_base`,
    basemapPolicy: "比赛底图严格使用 iDesktopX 制图后发布到 iServer 的 WMS 服务。",

    displayRoadNetworkGeoJsonUrl: "data/local-wuhan-road-network-osm.geojson",
    routingRoadNetworkGeoJsonUrl: "data/local-wuhan-marathon-area-roads.geojson",
    routingRoadNetworkGeoJsonUrls: {
      area: "data/local-wuhan-marathon-area-roads.geojson",
      fullOsm: "data/local-wuhan-road-network-osm.geojson"
    },
    constraintLayerUrls: {
      waterArea: "data/gis/constraint_water_area.geojson",
      waterLine: "data/gis/constraint_water_line.geojson",
      sensitiveHospital: "data/gis/constraint_sensitive_hospital_area.geojson",
      sensitiveSchool: "data/gis/constraint_sensitive_school_area.geojson",
      parks: "data/gis/park_green_osm.geojson",
      commercialPotential: "data/gis/poi_commercial_potential_area.geojson",
      trafficStation: "data/gis/poi_traffic_station_area.geojson"
    },

    demDataPath: "E:\\SuperMap\\data\\GDEM\\ASTGTMV003_N30E114\\ASTGTMV003_N30E114_dem.tif",
    slopeDataPath: "E:\\SuperMap\\data\\dataset\\dataset\\武汉市_30米分辨率坡度数据",
    demMetadata: {
      name: "ASTGTMV003_N30E114 / Wuhan slope rasters",
      crs: "WGS 84 / EPSG:4326",
      size: "3601 x 3601 DEM plus local 30m slope rasters",
      bounds: "113.9999E-115.0001E, 29.9999N-31.0001N",
      elevationRange: "-135m 至 771m"
    }
  }
};

export const cityPackages = [wuhanCityPackage] as const;
export const activeCityPackage = wuhanCityPackage;
