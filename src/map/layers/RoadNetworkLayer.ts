type GeoJsonFeature = {
  properties?: Record<string, unknown> | null;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
};

type RoadLine = [number, number][];

export function extractRoadNetworkLines(geojson: unknown, maxLines = 1800): RoadLine[] {
  const features = getFeatures(geojson)
    .map((feature, index) => ({ feature, index, priority: roadPriority(feature.properties?.highway) }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index);

  const lines: RoadLine[] = [];
  for (const item of features) {
    for (const line of extractFeatureLines(item.feature)) {
      lines.push(line);
      if (lines.length >= maxLines) return lines;
    }
  }
  return lines;
}

export function roadNetworkStyle(): Record<string, unknown> {
  return {
    color: "#5f6f7f",
    weight: 1.2,
    opacity: 0.36,
    interactive: false
  };
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
