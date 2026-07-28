import type { CityPackage } from "./cityPackages";

export type CityPackageImportResult =
  | { ok: true; cityPackage: CityPackage; summary: string }
  | { ok: false; error: string };

export function parseCityPackageImportText(text: string, basePackage: CityPackage): CityPackageImportResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: "城市包 JSON 格式不正确" };
  }

  if (!value || typeof value !== "object") return { ok: false, error: "城市包必须是 JSON 对象" };
  const record = value as Record<string, unknown>;
  const name = readString(record.name);
  const displayName = readString(record.displayName) || (name ? `${name}马拉松` : "");
  const marathonName = readString(record.marathonName) || "马拉松赛道空间选线平台";
  const mapCenter = readCoordinate(record.mapCenter);
  const mapZoom = readNumber(record.mapZoom) ?? basePackage.mapZoom;

  if (!name) return { ok: false, error: "城市包缺少 name" };
  if (!mapCenter) return { ok: false, error: "城市包缺少 mapCenter，例如 [114.32, 30.58]" };

  const routingRoadNetworkGeoJsonUrl =
    readString(record.routingRoadNetworkGeoJsonUrl) ||
    readString(record.roadNetworkGeoJsonUrl) ||
    basePackage.superMap.routingRoadNetworkGeoJsonUrls.fullOsm;
  const displayRoadNetworkGeoJsonUrl =
    readString(record.displayRoadNetworkGeoJsonUrl) ||
    readString(record.roadNetworkGeoJsonUrl) ||
    routingRoadNetworkGeoJsonUrl;

  const iServerBaseUrl = readString(record.iServerBaseUrl) || basePackage.superMap.iServerBaseUrl;
  const iClientForJavaScriptBaseUrl = `${iServerBaseUrl}/iClient/forJavaScript`;
  const wmsMapUrl = readString(record.wmsMapUrl) || basePackage.superMap.wmsMapUrl;
  const wmsLayerName = readString(record.wmsLayerName) || basePackage.superMap.wmsLayerName;
  const supportPointsUrl = readString(record.supportPointsUrl);
  const landmarksUrl = readString(record.landmarksUrl);

  const cityPackage: CityPackage = {
    ...basePackage,
    id: readString(record.id) || slugify(name),
    name,
    displayName,
    marathonName,
    mapCenter,
    mapZoom,
    routePlans: [],
    supportPoints: [],
    landmarks: [],
    superMap: {
      ...basePackage.superMap,
      iServerBaseUrl,
      iClientJavaScriptUrl: `${iClientForJavaScriptBaseUrl}/web/index.html`,
      iClientLeafletScripts: [
        `${iClientForJavaScriptBaseUrl}/web/libs/leaflet/1.9.4/leaflet.js`,
        `${iClientForJavaScriptBaseUrl}/dist/leaflet/iclient-leaflet-es6.min.js`
      ],
      iClientLeafletStyleUrls: [
        `${iClientForJavaScriptBaseUrl}/web/libs/leaflet/1.9.4/leaflet.css`,
        `${iClientForJavaScriptBaseUrl}/dist/leaflet/iclient-leaflet.min.css`
      ],
      wmsMapUrl,
      wmsLayerName,
      displayRoadNetworkGeoJsonUrl,
      routingRoadNetworkGeoJsonUrl,
      routingRoadNetworkGeoJsonUrls: {
        ...basePackage.superMap.routingRoadNetworkGeoJsonUrls,
        fullOsm: routingRoadNetworkGeoJsonUrl
      },
      serviceUrls: {
        ...basePackage.superMap.serviceUrls,
        roadMapWms: wmsMapUrl
      },
      constraintLayerUrls: {
        ...basePackage.superMap.constraintLayerUrls,
        parks: landmarksUrl || basePackage.superMap.constraintLayerUrls.parks,
        commercialPotential: supportPointsUrl || basePackage.superMap.constraintLayerUrls.commercialPotential
      },
      basemapPolicy: `当前城市包使用 ${name} 的 SuperMap iServer REST/WMS 与本地 GeoJSON 路网配置。`
    }
  };

  return {
    ok: true,
    cityPackage,
    summary: `${name}城市包已导入：路网 ${routingRoadNetworkGeoJsonUrl}，底图 ${wmsMapUrl}`
  };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readCoordinate(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = value[0];
  const lat = value[1];
  return typeof lon === "number" && typeof lat === "number" && Number.isFinite(lon) && Number.isFinite(lat)
    ? [lon, lat]
    : null;
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-") || "imported-city";
}
