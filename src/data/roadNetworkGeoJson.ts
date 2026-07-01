import { haversineKm } from "../domain/roadAttributes";
import {
  addEdge,
  addNode,
  createEmptyGraph,
  type RoadGraph,
  type RoadLevel
} from "../domain/roadNetwork";
import type { Coordinate } from "../domain/routeMetrics";

type GeoJsonFeature = {
  properties?: Record<string, unknown> | null;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
};

export function mapOsmHighwayToRoadLevel(value: unknown): RoadLevel {
  switch (value) {
    case "motorway":
      return "motorway";
    case "trunk":
      return "trunk";
    case "primary":
      return "primary";
    case "secondary":
      return "secondary";
    case "tertiary":
      return "tertiary";
    case "service":
      return "service";
    case "track":
      return "track";
    case "cycleway":
    case "footway":
    case "path":
    case "pedestrian":
      return "greenway";
    default:
      return "residential";
  }
}

export function buildRoadGraphFromGeoJson(geojson: unknown): RoadGraph {
  const graph = createEmptyGraph();
  const features = getFeatures(geojson);

  features.forEach((feature, featureIndex) => {
    const properties = feature.properties ?? {};
    const lines = extractLines(feature.geometry);

    lines.forEach((line, lineIndex) => {
      addLineToGraph(graph, line, properties, featureIndex, lineIndex);
    });
  });

  return graph;
}

function getFeatures(geojson: unknown): GeoJsonFeature[] {
  if (!geojson || typeof geojson !== "object") return [];
  const maybeCollection = geojson as { features?: unknown };
  if (!Array.isArray(maybeCollection.features)) return [];
  return maybeCollection.features.filter((feature): feature is GeoJsonFeature =>
    Boolean(feature && typeof feature === "object")
  );
}

function extractLines(geometry: GeoJsonFeature["geometry"]): Coordinate[][] {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];

  if (geometry.type === "LineString") {
    const line = normalizeLine(geometry.coordinates);
    return line.length > 1 ? [line] : [];
  }

  if (geometry.type === "MultiLineString") {
    return geometry.coordinates
      .filter(Array.isArray)
      .map((line) => normalizeLine(line))
      .filter((line) => line.length > 1);
  }

  return [];
}

function normalizeLine(rawCoordinates: unknown[]): Coordinate[] {
  return rawCoordinates
    .map((coordinate) => normalizeCoordinate(coordinate))
    .filter((coordinate): coordinate is Coordinate => coordinate !== null);
}

function normalizeCoordinate(value: unknown): Coordinate | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = value[0];
  const lat = value[1];
  if (typeof lon !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [lon, lat];
}

function addLineToGraph(
  graph: RoadGraph,
  line: Coordinate[],
  properties: Record<string, unknown>,
  featureIndex: number,
  lineIndex: number
): void {
  for (const coordinate of line) {
    const nodeId = nodeIdForCoordinate(coordinate);
    if (!graph.nodes.has(nodeId)) {
      addNode(graph, { id: nodeId, coordinate });
    }
  }

  for (let index = 0; index < line.length - 1; index++) {
    const from = line[index];
    const to = line[index + 1];
    const lengthKm = haversineKm(from, to);
    if (lengthKm <= 0) continue;

    const roadLevel = mapOsmHighwayToRoadLevel(properties.highway);
    const edgeId = `osm-${featureIndex}-${lineIndex}-${index}`;
    addEdge(graph, {
      id: edgeId,
      fromNodeId: nodeIdForCoordinate(from),
      toNodeId: nodeIdForCoordinate(to),
      lengthKm,
      roadLevel,
      isBridge: isOsmTagTrue(properties.bridge),
      isTunnel: isOsmTagTrue(properties.tunnel),
      baselineCost: lengthKm
    });
  }
}

function nodeIdForCoordinate(coordinate: Coordinate): string {
  return `${coordinate[0].toFixed(7)},${coordinate[1].toFixed(7)}`;
}

function isOsmTagTrue(value: unknown): boolean {
  return value === true || value === "yes" || value === "true" || value === "1";
}
