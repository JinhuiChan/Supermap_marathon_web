import type { Coordinate } from "../../domain/routeMetrics";

type GeoJsonFeature = {
  properties?: Record<string, unknown> | null;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
};

export type PoiLabelKind = "hospital" | "traffic" | "park" | "commercial";

export interface MapPoiLabel {
  id: string;
  name: string;
  kind: PoiLabelKind;
  coordinate: Coordinate;
  minZoom?: number;
  priority?: number;
  source?: "iserver" | "local";
}

type SuperMapFeatureRecord = {
  fieldNames?: unknown;
  fieldValues?: unknown;
  geometry?: {
    center?: { x?: unknown; y?: unknown } | null;
    points?: Array<{ x?: unknown; y?: unknown }> | null;
  } | null;
}

export function extractPoiLabelsFromGeoJson(
  geojson: unknown,
  kind: PoiLabelKind,
  maxLabels = 180
): MapPoiLabel[] {
  const labels: MapPoiLabel[] = [];
  const seen = new Set<string>();

  for (const [index, feature] of getFeatures(geojson).entries()) {
    const name = normalizeName(feature.properties);
    if (!name) continue;
    const coordinate = featureCenter(feature.geometry);
    if (!coordinate) continue;

    const key = `${kind}:${name.toLocaleLowerCase()}:${coordinate[0].toFixed(4)},${coordinate[1].toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push({
      id: `${kind}-${index}`,
      name,
      kind,
      coordinate,
      source: "local"
    });
    if (labels.length >= maxLabels) break;
  }

  return labels;
}

export function extractPoiLabelsFromSuperMapFeatures(
  features: unknown[],
  kind: PoiLabelKind,
  options: { minZoom?: number; maxLabels?: number } = {}
): MapPoiLabel[] {
  const labels: MapPoiLabel[] = [];
  const seen = new Set<string>();
  const maxLabels = options.maxLabels ?? 240;

  for (const feature of features) {
    const record = feature as SuperMapFeatureRecord;
    const properties = superMapFeatureProperties(record);
    const name = normalizeName(properties) || fallbackNameForKind(kind);
    const coordinate = superMapFeatureCenter(record);
    if (!coordinate) continue;

    const idValue = firstTextValue(properties, ["SMID", "FID", "ID", "POINT_ID"]) || String(labels.length);
    const key = `${kind}:${name.toLocaleLowerCase()}:${coordinate[0].toFixed(4)},${coordinate[1].toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push({
      id: `${kind}-${idValue}`,
      name,
      kind,
      coordinate,
      minZoom: options.minZoom,
      priority: priorityForKind(kind),
      source: "iserver"
    });
    if (labels.length >= maxLabels) break;
  }

  return labels;
}

export function shouldShowPoiLabelAtZoom(poi: MapPoiLabel, zoom: number): boolean {
  if ((poi.priority ?? 0) >= 95) return zoom >= Math.max(10, (poi.minZoom ?? 10) - 2);
  return zoom >= (poi.minZoom ?? defaultMinZoomForKind(poi.kind));
}

export function toPoiLeafletLatLng(poi: MapPoiLabel): [number, number] {
  return [poi.coordinate[1], poi.coordinate[0]];
}

export function poiLabelVisual(kind: PoiLabelKind): { symbol: string; color: string; className: string } {
  if (kind === "hospital") return { symbol: "医", color: "#d94b42", className: "hospital" };
  if (kind === "traffic") return { symbol: "铁", color: "#2f6fd6", className: "traffic" };
  if (kind === "park") return { symbol: "园", color: "#2f8f54", className: "park" };
  return { symbol: "商", color: "#d07a1c", className: "commercial" };
}

export function formatPoiLabel(poi: MapPoiLabel): string {
  const visual = poiLabelVisual(poi.kind);
  return [
    `<span class="map-poi-symbol ${visual.className}" style="background:${visual.color}">${visual.symbol}</span>`,
    `<span class="map-poi-name">${escapeHtml(poi.name)}</span>`
  ].join("");
}

export function formatPoiPopup(poi: MapPoiLabel): string {
  return [
    `<strong>${escapeHtml(poi.name)}</strong>`,
    `类型：${poiKindLabel(poi.kind)}`,
    `坐标：${poi.coordinate[0].toFixed(5)}, ${poi.coordinate[1].toFixed(5)}`
  ].join("<br>");
}

function getFeatures(geojson: unknown): GeoJsonFeature[] {
  if (!geojson || typeof geojson !== "object") return [];
  const collection = geojson as { features?: unknown };
  if (!Array.isArray(collection.features)) return [];
  return collection.features.filter((feature): feature is GeoJsonFeature =>
    Boolean(feature && typeof feature === "object")
  );
}

function normalizeName(properties: Record<string, unknown> | null | undefined): string {
  const candidates = [
    properties?.name,
    properties?.NAME,
    properties?.point_name,
    properties?.POINT_NAME,
    properties?.Level2_CN,
    properties?.LEVEL2_CN,
    properties?.Level1_CN,
    properties?.LEVEL1_CN,
    properties?.fclass_cn,
    properties?.FCLASS_CN,
    properties?.type
  ];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed && trimmed !== "null" && trimmed !== "undefined") return trimmed;
  }
  return "";
}

function superMapFeatureProperties(record: SuperMapFeatureRecord): Record<string, unknown> {
  if (!Array.isArray(record.fieldNames) || !Array.isArray(record.fieldValues)) return {};
  return record.fieldNames.reduce<Record<string, unknown>>((properties, fieldName, index) => {
    if (typeof fieldName === "string") {
      properties[fieldName] = (record.fieldValues as unknown[])[index];
    }
    return properties;
  }, {});
}

function superMapFeatureCenter(record: SuperMapFeatureRecord): Coordinate | null {
  const center = record.geometry?.center;
  if (center && typeof center.x === "number" && typeof center.y === "number") {
    return [center.x, center.y];
  }

  const points = record.geometry?.points;
  if (!Array.isArray(points) || points.length === 0) return null;
  const valid = points.filter((point): point is { x: number; y: number } =>
    typeof point.x === "number" && Number.isFinite(point.x) &&
    typeof point.y === "number" && Number.isFinite(point.y)
  );
  if (valid.length === 0) return null;
  return [
    Number((valid.reduce((sum, point) => sum + point.x, 0) / valid.length).toFixed(6)),
    Number((valid.reduce((sum, point) => sum + point.y, 0) / valid.length).toFixed(6))
  ];
}

function firstTextValue(properties: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function fallbackNameForKind(kind: PoiLabelKind): string {
  if (kind === "hospital") return "医院";
  if (kind === "traffic") return "交通站点";
  if (kind === "park") return "公园绿地";
  return "商圈补给";
}

function priorityForKind(kind: PoiLabelKind): number {
  if (kind === "hospital" || kind === "traffic") return 100;
  if (kind === "park") return 78;
  return 68;
}

function defaultMinZoomForKind(kind: PoiLabelKind): number {
  if (kind === "hospital" || kind === "traffic") return 10;
  if (kind === "park") return 12;
  return 13;
}

function featureCenter(geometry: GeoJsonFeature["geometry"]): Coordinate | null {
  const points = flattenCoordinates(geometry?.coordinates);
  if (points.length === 0) return null;

  const lonSum = points.reduce((sum, point) => sum + point[0], 0);
  const latSum = points.reduce((sum, point) => sum + point[1], 0);
  return [
    Number((lonSum / points.length).toFixed(6)),
    Number((latSum / points.length).toFixed(6))
  ];
}

function flattenCoordinates(value: unknown): Coordinate[] {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    const lon = value[0];
    const lat = value[1];
    return Number.isFinite(lon) && Number.isFinite(lat) ? [[lon, lat]] : [];
  }
  return value.flatMap((item) => flattenCoordinates(item));
}

function poiKindLabel(kind: PoiLabelKind): string {
  if (kind === "hospital") return "医院";
  if (kind === "traffic") return "地铁/交通站";
  if (kind === "park") return "公园";
  return "商圈/补给潜力点";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
