import { getElevation, haversineKm, turnAngle } from "../domain/roadAttributes";
import type { RoadEdge, RoadGraph, RoadLevel } from "../domain/roadNetwork";
import type { Coordinate, ElevationPoint, MarathonRoute, RouteMetrics } from "../domain/routeMetrics";
import { buildRoadGraphFromGeoJson } from "./roadNetworkGeoJson";

interface OSMRouteOptions {
  id: string;
  name: string;
  targetDistanceKm: number;
  startPoint: Coordinate;
}

export function buildOsmMarathonTestRoute(
  geojson: unknown,
  options: OSMRouteOptions
): MarathonRoute | null {
  const graph = buildRoadGraphFromGeoJson(geojson);
  const startNodeId = findNearestNodeId(graph, options.startPoint);
  if (!startNodeId) return null;

  const walk = walkGraphToDistance(graph, startNodeId, options.targetDistanceKm);
  if (walk.coordinates.length < 2 || walk.totalKm < options.targetDistanceKm * 0.8) return null;

  return {
    id: options.id,
    name: options.name,
    color: "#7c3aed",
    lengthKm: Math.round(walk.totalKm * 1000) / 1000,
    closedLoop: haversineKm(walk.coordinates[0], walk.coordinates.at(-1) ?? walk.coordinates[0]) < 0.5,
    coordinates: walk.coordinates,
    elevationProfile: buildElevationProfile(walk.coordinates, walk.totalKm),
    metrics: computeRouteMetrics(walk.coordinates, walk.edges, walk.totalKm),
    lineage: {
      source: "osm-generated",
      roadAligned: true,
      note: "从本地 OSM 道路走廊生成的测试路线，用于验证真实路网流程"
    }
  };
}

function walkGraphToDistance(
  graph: RoadGraph,
  startNodeId: string,
  targetDistanceKm: number
): { coordinates: Coordinate[]; edges: RoadEdge[]; totalKm: number } {
  const startNode = graph.nodes.get(startNodeId);
  if (!startNode) return { coordinates: [], edges: [], totalKm: 0 };

  const coordinates: Coordinate[] = [startNode.coordinate];
  const edges: RoadEdge[] = [];
  const used = new Map<string, number>();
  const recent: string[] = [];
  let currentNodeId = startNodeId;
  let previousNodeId = "";
  let totalKm = 0;

  for (let step = 0; step < 20000 && totalKm < targetDistanceKm; step++) {
    const outgoing = graph.adjacency.get(currentNodeId) ?? [];
    const candidate = chooseNextEdge(outgoing, previousNodeId, used, recent);
    if (!candidate) break;

    const nextNode = graph.nodes.get(candidate.toNodeId);
    if (!nextNode) break;

    const remaining = targetDistanceKm - totalKm;
    if (candidate.lengthKm > remaining) {
      const currentNode = graph.nodes.get(currentNodeId);
      if (currentNode) coordinates.push(interpolateCoordinate(currentNode.coordinate, nextNode.coordinate, remaining / candidate.lengthKm));
      totalKm = targetDistanceKm;
      edges.push({ ...candidate, lengthKm: remaining });
      break;
    }

    coordinates.push(nextNode.coordinate);
    edges.push(candidate);
    totalKm += candidate.lengthKm;

    const baseId = baseEdgeId(candidate.id);
    used.set(baseId, (used.get(baseId) ?? 0) + 1);
    recent.push(baseId);
    if (recent.length > 20) recent.shift();

    previousNodeId = currentNodeId;
    currentNodeId = candidate.toNodeId;
  }

  return { coordinates, edges, totalKm };
}

function chooseNextEdge(
  outgoing: RoadEdge[],
  previousNodeId: string,
  used: Map<string, number>,
  recent: string[]
): RoadEdge | null {
  if (outgoing.length === 0) return null;
  const recentSet = new Set(recent);
  const usable = outgoing.filter((edge) => edge.toNodeId !== previousNodeId || outgoing.length === 1);
  const scored = usable.map((edge) => {
    const baseId = baseEdgeId(edge.id);
    const usedCount = used.get(baseId) ?? 0;
    const recentPenalty = recentSet.has(baseId) ? 100 : 0;
    const reusePenalty = usedCount * 40;
    const lengthBonus = Math.min(edge.lengthKm, 0.5) * 8;
    return {
      edge,
      score: roadLevelScore(edge.roadLevel) + lengthBonus - reusePenalty - recentPenalty
    };
  });
  scored.sort((a, b) => b.score - a.score || a.edge.id.localeCompare(b.edge.id));
  return scored[0]?.edge ?? null;
}

function findNearestNodeId(graph: RoadGraph, coordinate: Coordinate): string | null {
  let nearestId: string | null = null;
  let nearestKm = Number.POSITIVE_INFINITY;
  for (const node of graph.nodes.values()) {
    const distanceKm = haversineKm(coordinate, node.coordinate);
    if (distanceKm < nearestKm) {
      nearestKm = distanceKm;
      nearestId = node.id;
    }
  }
  return nearestId;
}

function interpolateCoordinate(from: Coordinate, to: Coordinate, ratio: number): Coordinate {
  const clamped = Math.max(0, Math.min(1, ratio));
  return [
    Number((from[0] + (to[0] - from[0]) * clamped).toFixed(6)),
    Number((from[1] + (to[1] - from[1]) * clamped).toFixed(6))
  ];
}

function buildElevationProfile(coordinates: Coordinate[], totalKm: number): ElevationPoint[] {
  if (coordinates.length < 2) return [];
  const steps = Math.min(12, coordinates.length - 1);
  const profile: ElevationPoint[] = [];

  for (let index = 0; index <= steps; index++) {
    const coordIndex = Math.min(Math.round((index / steps) * (coordinates.length - 1)), coordinates.length - 1);
    const coordinate = coordinates[coordIndex];
    profile.push({
      km: Math.round((totalKm * index / steps) * 100) / 100,
      elevation: getElevation(coordinate),
      slope: index === 0 ? 0 : estimateSlope(coordinates[Math.max(0, coordIndex - 1)], coordinate)
    });
  }

  return profile;
}

function computeRouteMetrics(coordinates: Coordinate[], edges: RoadEdge[], totalKm: number): RouteMetrics {
  const elevationProfile = buildElevationProfile(coordinates, totalKm);
  let totalClimbM = 0;
  for (let index = 1; index < elevationProfile.length; index++) {
    const climb = elevationProfile[index].elevation - elevationProfile[index - 1].elevation;
    if (climb > 0) totalClimbM += climb;
  }

  const slopes = elevationProfile.slice(1).map((point) => Math.abs(point.slope));
  const sharpTurnRatio = computeSharpTurnRatio(coordinates);
  const narrowKm = edges
    .filter((edge) => edge.roadLevel === "service" || edge.roadLevel === "track")
    .reduce((sum, edge) => sum + edge.lengthKm, 0);

  const supplyCoverageRatio = weightedAverage(edges, totalKm, (edge) =>
    edge.roadLevel === "trunk" || edge.roadLevel === "primary" ? 0.9 :
      edge.roadLevel === "secondary" ? 0.82 :
        edge.roadLevel === "greenway" ? 0.72 : 0.62
  );

  return {
    totalClimbM: Math.round(totalClimbM),
    avgSlopePercent: Math.round((average(slopes) || 0) * 10) / 10,
    maxSlopePercent: Math.round(Math.max(0, ...slopes) * 10) / 10,
    longSteepRatio: Math.round((slopes.filter((slope) => slope > 3).length / Math.max(1, slopes.length)) * 100) / 100,
    sharpTurnRatio,
    narrowRoadRatio: Math.round((narrowKm / Math.max(totalKm, 1)) * 100) / 100,
    supplyCoverageRatio: Math.round(supplyCoverageRatio * 100) / 100,
    medicalAvgIntervalKm: 4.8,
    parkingServiceScore: 82,
    shadeCoverageRatio: 0.55
  };
}

function estimateSlope(from: Coordinate, to: Coordinate): number {
  const distanceM = Math.max(haversineKm(from, to) * 1000, 1);
  return Math.round(((getElevation(to) - getElevation(from)) / distanceM) * 1000) / 10;
}

function computeSharpTurnRatio(coordinates: Coordinate[]): number {
  if (coordinates.length < 3) return 0;
  let sharpTurns = 0;
  for (let index = 2; index < coordinates.length; index++) {
    if (turnAngle(coordinates[index - 2], coordinates[index - 1], coordinates[index]) > 110) {
      sharpTurns += 1;
    }
  }
  return Math.round((sharpTurns / (coordinates.length - 2)) * 100) / 100;
}

function weightedAverage(edges: RoadEdge[], totalKm: number, value: (edge: RoadEdge) => number): number {
  if (edges.length === 0 || totalKm <= 0) return 0;
  return edges.reduce((sum, edge) => sum + value(edge) * (edge.lengthKm / totalKm), 0);
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roadLevelScore(level: RoadLevel): number {
  switch (level) {
    case "trunk":
      return 95;
    case "primary":
      return 90;
    case "secondary":
      return 80;
    case "tertiary":
      return 70;
    case "greenway":
      return 65;
    case "residential":
      return 45;
    case "service":
      return 25;
    case "track":
      return 15;
    default:
      return 50;
  }
}

function baseEdgeId(edgeId: string): string {
  return edgeId.endsWith("_rev") ? edgeId.slice(0, -4) : edgeId;
}
