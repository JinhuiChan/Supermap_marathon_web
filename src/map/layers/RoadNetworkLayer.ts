type GeoJsonFeature = {
  properties?: Record<string, unknown> | null;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
};

type RoadLine = [number, number][];

export const DEFAULT_ROAD_NETWORK_LINE_LIMIT = 60000;
export const DEFAULT_ROAD_LABEL_LIMIT = 180;

export interface RoadNetworkFeature {
  id: string;
  line: RoadLine;
  label: string;
  highway: string;
  fclass: string;
  name: string;
  isBridge: boolean;
  isTunnel: boolean;
  impedance: number | null;
  suitability: number | null;
  priority: number;
}

export function extractRoadNetworkLines(geojson: unknown, maxLines = DEFAULT_ROAD_NETWORK_LINE_LIMIT): RoadLine[] {
  return extractRoadNetworkFeatures(geojson, maxLines).map((road) => road.line);
}

export function extractRoadNetworkFeatures(
  geojson: unknown,
  maxLines = DEFAULT_ROAD_NETWORK_LINE_LIMIT
): RoadNetworkFeature[] {
  const features = getFeatures(geojson)
    .map((feature, index) => ({ feature, index, priority: roadPriority(feature.properties?.highway) }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index);

  const roads: RoadNetworkFeature[] = [];
  for (const item of features) {
    const properties = item.feature.properties ?? {};
    const highway = normalizeText(properties.highway ?? properties.road_level ?? properties.fclass, "road");
    const fclass = normalizeText(properties.fclass ?? properties.highway ?? properties.road_level, highway);
    const name = normalizeText(properties.name, "");

    for (const [lineIndex, line] of extractFeatureLines(item.feature).entries()) {
      roads.push({
        id: `road-${item.index}-${lineIndex}`,
        line,
        label: name || roadClassLabel(highway),
        highway,
        fclass,
        name,
        isBridge: isOsmTagTrue(properties.bridge ?? properties.is_bridge),
        isTunnel: isOsmTagTrue(properties.tunnel ?? properties.is_tunnel),
        impedance: normalizeNumber(properties.impedance),
        suitability: normalizeNumber(properties.suitability),
        priority: item.priority
      });
      if (roads.length >= maxLines) return roads;
    }
  }
  return roads;
}

export function roadNetworkStyle(road?: Pick<RoadNetworkFeature, "highway">): Record<string, unknown> {
  const highway = road?.highway;
  if (highway === "motorway" || highway === "trunk") {
    return { color: "#fff2bf", weight: 5.4, opacity: 0.94, interactive: true };
  }
  if (highway === "primary") {
    return { color: "#f2f4f7", weight: 4.2, opacity: 0.9, interactive: true };
  }
  if (highway === "secondary") {
    return { color: "#ffffff", weight: 3.2, opacity: 0.84, interactive: true };
  }
  if (highway === "tertiary") {
    return { color: "#e8edf2", weight: 2.4, opacity: 0.72, interactive: true };
  }
  if (highway === "cycleway" || highway === "footway" || highway === "path" || highway === "pedestrian" || highway === "greenway") {
    return { color: "#77b989", weight: 2.1, opacity: 0.78, interactive: true, dashArray: "4 3" };
  }
  return {
    color: "#c8d0d8",
    weight: 1.2,
    opacity: 0.42,
    interactive: true
  };
}

export function shouldShowRoadLabel(road: RoadNetworkFeature, labelCount: number, maxLabels = DEFAULT_ROAD_LABEL_LIMIT): boolean {
  if (!road.name) return false;
  if (labelCount >= maxLabels) return false;
  if (road.name.length < 2) return false;
  return road.priority >= 90;
}

export function roadLabelKey(road: RoadNetworkFeature): string | null {
  if (!road.name) return null;
  return road.name.trim().toLocaleLowerCase();
}

export function formatRoadNetworkPopup(road: RoadNetworkFeature): string {
  const parts = [
    `<strong>${escapeHtml(road.label)}</strong>`,
    `等级：${escapeHtml(road.highway || road.fclass || "未知")}`
  ];
  if (road.isBridge) parts.push("桥梁：是");
  if (road.isTunnel) parts.push("隧道：是");
  if (road.impedance !== null) parts.push(`阻力值：${road.impedance}`);
  if (road.suitability !== null) parts.push(`适宜性：${road.suitability}`);
  return parts.join("<br>");
}

function getFeatures(geojson: unknown): GeoJsonFeature[] {
  if (!geojson || typeof geojson !== "object") return [];
  const collection = geojson as { features?: unknown };
  if (!Array.isArray(collection.features)) return [];
  return collection.features.filter((feature): feature is GeoJsonFeature =>
    Boolean(feature && typeof feature === "object")
  );
}

function extractFeatureLines(feature: GeoJsonFeature): RoadLine[] {
  const geometry = feature.geometry;
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];

  if (geometry.type === "LineString") {
    const line = toLeafletLine(geometry.coordinates);
    return line.length > 1 ? [line] : [];
  }

  if (geometry.type === "MultiLineString") {
    return geometry.coordinates
      .filter(Array.isArray)
      .map((line) => toLeafletLine(line))
      .filter((line) => line.length > 1);
  }

  return [];
}

function toLeafletLine(rawCoordinates: unknown[]): RoadLine {
  return rawCoordinates
    .map((coordinate) => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
      const lon = coordinate[0];
      const lat = coordinate[1];
      if (typeof lon !== "number" || typeof lat !== "number") return null;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      return [lat, lon] as [number, number];
    })
    .filter((coordinate): coordinate is [number, number] => coordinate !== null);
}

function roadPriority(highway: unknown): number {
  switch (highway) {
    case "motorway":
      return 100;
    case "trunk":
      return 95;
    case "primary":
      return 90;
    case "secondary":
      return 80;
    case "tertiary":
      return 70;
    case "cycleway":
    case "pedestrian":
    case "footway":
    case "path":
      return 60;
    case "residential":
      return 40;
    case "service":
      return 20;
    default:
      return 30;
  }
}

function roadClassLabel(highway: string): string {
  switch (highway) {
    case "motorway":
      return "高速路";
    case "trunk":
      return "快速路";
    case "primary":
      return "主干路";
    case "secondary":
      return "次干路";
    case "tertiary":
      return "支路";
    case "cycleway":
    case "footway":
    case "path":
    case "pedestrian":
    case "greenway":
      return "绿道/慢行路";
    default:
      return "道路";
  }
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isOsmTagTrue(value: unknown): boolean {
  return value === true || value === "yes" || value === "true" || value === "1" || value === 1;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
