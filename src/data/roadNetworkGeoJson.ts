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
  type?: string;
  properties?: Record<string, unknown> | null;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
};

export interface GeoJsonBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface RoadGeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export const WUHAN_MARATHON_AREA_BOUNDS: GeoJsonBounds = {
  minLon: 114.235,
  minLat: 30.525,
  maxLon: 114.475,
  maxLat: 30.652
};

export const WUHAN_MARATHON_ROUTE_CORRIDOR_KM = 1.5;

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

export function isCompetitionSuitableRoadLevel(roadLevel: RoadLevel): boolean {
  return roadLevel === "trunk" || roadLevel === "primary" || roadLevel === "secondary" || roadLevel === "tertiary";
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

export function filterRoadGeoJsonByBounds(
  geojson: unknown,
  bounds: GeoJsonBounds
): RoadGeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: getFeatures(geojson).filter((feature) =>
      extractLines(feature.geometry).some((line) =>
        line.some((coordinate) => coordinateInBounds(coordinate, bounds))
      )
    )
  };
}

export function filterRoadGeoJsonByRouteCorridor(
  geojson: unknown,
  routeCoordinates: Coordinate[],
  maxDistanceKm: number
): RoadGeoJsonFeatureCollection {
  if (routeCoordinates.length < 2 || maxDistanceKm <= 0) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: getFeatures(geojson).filter((feature) =>
      extractLines(feature.geometry).some((line) =>
        line.some((coordinate) =>
          distanceToRouteKm(coordinate, routeCoordinates) <= maxDistanceKm
        )
      )
    )
  };
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

function coordinateInBounds(coordinate: Coordinate, bounds: GeoJsonBounds): boolean {
  const [lon, lat] = coordinate;
  return (
    lon >= bounds.minLon &&
    lon <= bounds.maxLon &&
    lat >= bounds.minLat &&
    lat <= bounds.maxLat
  );
}

function distanceToRouteKm(coordinate: Coordinate, routeCoordinates: Coordinate[]): number {
  let shortest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < routeCoordinates.length - 1; index++) {
    shortest = Math.min(
      shortest,
      distanceToSegmentKm(coordinate, routeCoordinates[index], routeCoordinates[index + 1])
    );
  }
  return shortest;
}

function distanceToSegmentKm(point: Coordinate, start: Coordinate, end: Coordinate): number {
  const originLat = point[1];
  const p = projectToLocalKm(point, originLat);
  const a = projectToLocalKm(start, originLat);
  const b = projectToLocalKm(end, originLat);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  const nearest = {
    x: a.x + t * dx,
    y: a.y + t * dy
  };

  return Math.hypot(p.x - nearest.x, p.y - nearest.y);
}

function projectToLocalKm(coordinate: Coordinate, originLat: number): { x: number; y: number } {
  const kmPerDegreeLat = 110.574;
  const kmPerDegreeLon = 111.32 * Math.cos((originLat * Math.PI) / 180);
  return {
    x: coordinate[0] * kmPerDegreeLon,
    y: coordinate[1] * kmPerDegreeLat
  };
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
      competitionSuitable: isCompetitionSuitableRoadLevel(roadLevel),
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
