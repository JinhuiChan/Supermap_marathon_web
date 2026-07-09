type GeoJsonFeature = {
  properties?: Record<string, unknown> | null;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
};

type LatLng = [number, number];
type VectorCoordinates = LatLng[] | LatLng[][];

export type VectorBasemapKind = "waterArea" | "waterLine" | "park" | "commercial" | "trafficStation";

export interface VectorBasemapFeature {
  id: string;
  kind: VectorBasemapKind;
  label: string;
  geometryType: "polygon" | "polyline";
  coordinates: VectorCoordinates;
}

export function extractVectorBasemapFeatures(
  geojson: unknown,
  kind: VectorBasemapKind,
  maxFeatures = 8000
): VectorBasemapFeature[] {
  const output: VectorBasemapFeature[] = [];
  for (const [featureIndex, feature] of getFeatures(geojson).entries()) {
    const label = normalizeText(feature.properties?.name, "");
    const geometries = extractGeometries(feature);

    for (const [geometryIndex, geometry] of geometries.entries()) {
      output.push({
        id: `${kind}-${featureIndex}-${geometryIndex}`,
        kind,
        label,
        geometryType: geometry.geometryType,
        coordinates: geometry.coordinates
      });
      if (output.length >= maxFeatures) return output;
    }
  }
  return output;
}

export function vectorBasemapStyle(kind: VectorBasemapKind): Record<string, unknown> {
  if (kind === "waterArea") {
    return {
      color: "#9fcbe6",
      weight: 0.8,
      opacity: 0.78,
      fillColor: "#b9def4",
      fillOpacity: 0.72,
      interactive: false
    };
  }

  if (kind === "waterLine") {
    return {
      color: "#93c5e8",
      weight: 2.4,
      opacity: 0.82,
      interactive: false
    };
  }

  if (kind === "park") {
    return {
      color: "#9fcf9f",
      weight: 0.7,
      opacity: 0.64,
      fillColor: "#cfead3",
      fillOpacity: 0.7,
      interactive: false
    };
  }

  if (kind === "commercial") {
    return {
      color: "#e4d2a9",
      weight: 0.7,
      opacity: 0.45,
      fillColor: "#f4ead1",
      fillOpacity: 0.34,
      interactive: false
    };
  }

  return {
    color: "#93a8c4",
    weight: 0.7,
    opacity: 0.52,
    fillColor: "#d8e3ef",
    fillOpacity: 0.4,
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

function extractGeometries(feature: GeoJsonFeature): Array<{
  geometryType: VectorBasemapFeature["geometryType"];
  coordinates: VectorCoordinates;
}> {
  const geometry = feature.geometry;
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];

  if (geometry.type === "Polygon") {
    const rings = normalizePolygon(geometry.coordinates);
    return rings.length > 0 ? [{ geometryType: "polygon", coordinates: rings }] : [];
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .filter(Array.isArray)
      .map((polygon) => normalizePolygon(polygon))
      .filter((rings) => rings.length > 0)
      .map((rings) => ({ geometryType: "polygon" as const, coordinates: rings }));
  }

  if (geometry.type === "LineString") {
    const line = normalizeLine(geometry.coordinates);
    return line.length > 1 ? [{ geometryType: "polyline", coordinates: line }] : [];
  }

  if (geometry.type === "MultiLineString") {
    return geometry.coordinates
      .filter(Array.isArray)
      .map((line) => normalizeLine(line))
      .filter((line) => line.length > 1)
      .map((line) => ({ geometryType: "polyline" as const, coordinates: line }));
  }

  return [];
}

function normalizePolygon(rawRings: unknown[]): LatLng[][] {
  return rawRings
    .filter(Array.isArray)
    .map((ring) => normalizeLine(ring))
    .filter((ring) => ring.length > 2);
}

function normalizeLine(rawCoordinates: unknown[]): LatLng[] {
  return rawCoordinates
    .map((coordinate) => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
      const lon = coordinate[0];
      const lat = coordinate[1];
      if (typeof lon !== "number" || typeof lat !== "number") return null;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      return [lat, lon] as LatLng;
    })
    .filter((coordinate): coordinate is LatLng => coordinate !== null);
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}
