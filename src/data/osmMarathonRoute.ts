import { computePoiAttractiveness, getElevation, haversineKm, turnAngle } from "../domain/roadAttributes";
import { summarizeMarathonSuitability } from "../domain/competitionSuitability";
import type { RoadEdge, RoadGraph, RoadLevel } from "../domain/roadNetwork";
import type { PoiPreferences } from "../domain/poiTypes";
import type { Coordinate, ElevationPoint, MarathonRoute, RouteMetrics } from "../domain/routeMetrics";
import { augmentGraphWithSupportPois } from "./poiData";
import { buildRoadGraphFromGeoJson } from "./roadNetworkGeoJson";

interface OSMRouteOptions {
  id: string;
  name: string;
  targetDistanceKm: number;
  startPoint: Coordinate;
}

interface OSMCandidateOptions {
  targetDistanceKm: number;
  startPoint: Coordinate;
}

type RoutePreference = "balanced" | "main-road" | "scenic";

const candidateProfiles: Array<{
  id: string;
  name: string;
  color: string;
  preference: RoutePreference;
}> = [
  {
    id: "osm-balanced",
    name: "OSM 综合平衡候选线",
    color: "#7c3aed",
    preference: "balanced"
  },
  {
    id: "osm-main-road",
    name: "OSM 主干道优先候选线",
    color: "#0f766e",
    preference: "main-road"
  },
  {
    id: "osm-scenic",
    name: "OSM 景观绿道优先候选线",
    color: "#16a34a",
    preference: "scenic"
  }
];

export function buildOsmMarathonTestRoute(
  geojson: unknown,
  options: OSMRouteOptions
): MarathonRoute | null {
  const graph = buildRoadGraphFromGeoJson(geojson);
  augmentGraphWithSupportPois(graph);
  return buildRouteFromGraph(graph, {
    ...options,
    color: "#7c3aed",
    preference: "balanced",
    salt: 0
  });
}

export function buildOsmMarathonCandidateRoutes(
  geojson: unknown,
  options: OSMCandidateOptions
): MarathonRoute[] {
  const graph = buildRoadGraphFromGeoJson(geojson);
  augmentGraphWithSupportPois(graph);
  return candidateProfiles
    .map((profile, index) =>
      buildRouteFromGraph(graph, {
        id: profile.id,
        name: profile.name,
        color: profile.color,
        targetDistanceKm: options.targetDistanceKm,
        startPoint: options.startPoint,
        preference: profile.preference,
        salt: index
      })
    )
    .filter((route): route is MarathonRoute => route !== null);
}

function buildRouteFromGraph(
  graph: RoadGraph,
  options: OSMRouteOptions & { color: string; preference: RoutePreference; salt: number }
): MarathonRoute | null {
  const startNodeId = findNearestNodeId(graph, options.startPoint);
  if (!startNodeId) return null;

  const walk = walkGraphToDistance(graph, startNodeId, options.targetDistanceKm, options.preference, options.salt);
  if (walk.coordinates.length < 2 || walk.totalKm < options.targetDistanceKm * 0.8) return null;
  const metrics = computeRouteMetrics(walk.coordinates, walk.edges, walk.totalKm);
  if (!isAcceptableGeneratedRoute(metrics)) return null;

  return {
    id: options.id,
    name: options.name,
    color: options.color,
    lengthKm: Math.round(walk.totalKm * 1000) / 1000,
    closedLoop: haversineKm(walk.coordinates[0], walk.coordinates.at(-1) ?? walk.coordinates[0]) < 0.5,
    coordinates: walk.coordinates,
    elevationProfile: buildElevationProfile(walk.coordinates, walk.totalKm),
    metrics,
    lineage: {
      source: "osm-generated",
      roadAligned: true,
      note: `从本地 OSM 道路走廊生成的${options.name}，用于验证真实路网候选方案`
    }
  };
}

function isAcceptableGeneratedRoute(metrics: RouteMetrics): boolean {
  if ((metrics.selfIntersectionCount ?? 0) > 0) return false;
  if (metrics.sharpTurnRatio > 0.45) return false;
  if ((metrics.repeatedRoadRatio ?? 0) > 0) return false;
  if ((metrics.localBacktrackCount ?? 0) > 0) return false;
  return true;
}

function walkGraphToDistance(
  graph: RoadGraph,
  startNodeId: string,
  targetDistanceKm: number,
  preference: RoutePreference,
  salt: number
): { coordinates: Coordinate[]; edges: RoadEdge[]; totalKm: number } {
  const startNode = graph.nodes.get(startNodeId);
  if (!startNode) return { coordinates: [], edges: [], totalKm: 0 };

  const coordinates: Coordinate[] = [startNode.coordinate];
  const edges: RoadEdge[] = [];
  const used = new Map<string, number>();
  const visitedNodes = new Map<string, number>([[startNodeId, 1]]);
  let totalKm = 0;

  const stack: Array<{
    nodeId: string;
    previousNodeId: string;
    candidates: RoadEdge[];
    nextIndex: number;
  }> = [
    {
      nodeId: startNodeId,
      previousNodeId: "",
      candidates: [],
      nextIndex: 0
    }
  ];

  for (let step = 0; step < 80000 && stack.length > 0 && totalKm < targetDistanceKm; step++) {
    const frame = stack[stack.length - 1];
    const remainingKm = targetDistanceKm - totalKm;

    if (frame.candidates.length === 0) {
      frame.candidates = getCandidateEdges(
        graph,
        graph.adjacency.get(frame.nodeId) ?? [],
        frame.previousNodeId,
        used,
        visitedNodes,
        startNode.coordinate,
        coordinates,
        edges.slice(-20).map((edge) => baseEdgeId(edge.id)),
        preference,
        salt,
        step,
        remainingKm
      );
    }

    const candidate = frame.candidates[frame.nextIndex];
    frame.nextIndex += 1;

    if (!candidate) {
      if (edges.length === 0) break;
      stack.pop();
      const removed = edges.pop();
      coordinates.pop();
      if (removed) {
        totalKm -= removed.lengthKm;
        const baseId = baseEdgeId(removed.id);
        const nextCount = (used.get(baseId) ?? 1) - 1;
        if (nextCount <= 0) {
          used.delete(baseId);
        } else {
          used.set(baseId, nextCount);
        }
        const nextNodeCount = (visitedNodes.get(removed.toNodeId) ?? 1) - 1;
        if (nextNodeCount <= 0) {
          visitedNodes.delete(removed.toNodeId);
        } else {
          visitedNodes.set(removed.toNodeId, nextNodeCount);
        }
      }
      continue;
    }

    const nextNode = graph.nodes.get(candidate.toNodeId);
    if (!nextNode) continue;

    const remaining = targetDistanceKm - totalKm;
    if (candidate.lengthKm > remaining) {
      const currentNode = graph.nodes.get(frame.nodeId);
      if (currentNode) {
        coordinates.push(interpolateCoordinate(currentNode.coordinate, nextNode.coordinate, remaining / candidate.lengthKm));
      }
      totalKm = targetDistanceKm;
      edges.push({ ...candidate, lengthKm: remaining });
      break;
    }

    coordinates.push(nextNode.coordinate);
    edges.push(candidate);
    totalKm += candidate.lengthKm;

    const baseId = baseEdgeId(candidate.id);
    used.set(baseId, (used.get(baseId) ?? 0) + 1);
    visitedNodes.set(candidate.toNodeId, (visitedNodes.get(candidate.toNodeId) ?? 0) + 1);

    stack.push({
      nodeId: candidate.toNodeId,
      previousNodeId: candidate.fromNodeId,
      candidates: [],
      nextIndex: 0
    });
  }

  return { coordinates, edges, totalKm };
}

function getCandidateEdges(
  graph: RoadGraph,
  outgoing: RoadEdge[],
  previousNodeId: string,
  used: Map<string, number>,
  visitedNodes: Map<string, number>,
  startCoordinate: Coordinate,
  currentCoordinates: Coordinate[],
  recent: string[],
  preference: RoutePreference,
  salt: number,
  step: number,
  remainingKm: number
): RoadEdge[] {
  if (outgoing.length === 0) return [];
  const recentSet = new Set(recent);
  const usable = outgoing.filter((edge) => {
    const baseId = baseEdgeId(edge.id);
    const usedCount = used.get(baseId) ?? 0;
    if (!edge.competitionSuitable) return false;
    if (usedCount > 0) return false;
    if ((visitedNodes.get(edge.toNodeId) ?? 0) > 0) return false;
    return edge.toNodeId !== previousNodeId || outgoing.length === 1;
  });
  if (usable.length === 0) return [];

  const scored = usable.map((edge) => {
    const baseId = baseEdgeId(edge.id);
    const usedCount = used.get(baseId) ?? 0;
    const recentPenalty = recentSet.has(baseId) ? 100 : 0;
    const reusePenalty = usedCount * 40;
    const lengthBonus = Math.min(edge.lengthKm, 0.5) * 8;
    const onward = getOnwardCapacity(graph, edge, used);
    const nextNode = graph.nodes.get(edge.toNodeId);
    const explorationBonus = nextNode ? Math.min(haversineKm(startCoordinate, nextNode.coordinate), 10) * 7 : 0;
    const deadEndPenalty = onward.count === 0 && edge.lengthKm < remainingKm ? 180 : 0;
    const intersectionPenalty = wouldIntersectExistingRoute(graph, edge, currentCoordinates) ? 260 : 0;
    const poiBonus = computePoiAttractiveness(edge.poiScores, poiPreferencesForRoute(preference)) * 0.18;
    return {
      edge,
      score:
        roadLevelScore(edge.roadLevel, preference) +
        lengthBonus +
        explorationBonus +
        poiBonus +
        Math.min(onward.km, 2) * 12 +
        onward.count * 18 -
        reusePenalty -
        recentPenalty -
        intersectionPenalty -
        deadEndPenalty
    };
  });
  scored.sort((a, b) => b.score - a.score || a.edge.id.localeCompare(b.edge.id));
  const topCount = Math.min(5, scored.length);
  const head = scored.slice(0, topCount);
  const tail = scored.slice(topCount);
  const rotation = topCount <= 1 ? 0 : (salt + step) % topCount;
  const rotated = [...head.slice(rotation), ...head.slice(0, rotation), ...tail];
  return rotated.map((item) => item.edge);
}

function getOnwardCapacity(graph: RoadGraph, edge: RoadEdge, used: Map<string, number>): { count: number; km: number } {
  const nextOutgoing = graph.adjacency.get(edge.toNodeId) ?? [];
  let count = 0;
  let km = 0;

  for (const nextEdge of nextOutgoing) {
    const baseId = baseEdgeId(nextEdge.id);
    if (nextEdge.toNodeId === edge.fromNodeId) continue;
    if (!nextEdge.competitionSuitable) continue;
    if ((used.get(baseId) ?? 0) > 0) continue;
    if (baseId === baseEdgeId(edge.id)) continue;
    count += 1;
    km += nextEdge.lengthKm;
  }

  return { count, km };
}

function wouldIntersectExistingRoute(graph: RoadGraph, edge: RoadEdge, coordinates: Coordinate[]): boolean {
  if (coordinates.length < 3) return false;
  const from = graph.nodes.get(edge.fromNodeId)?.coordinate;
  const to = graph.nodes.get(edge.toNodeId)?.coordinate;
  if (!from || !to) return false;

  for (let index = 0; index < coordinates.length - 2; index++) {
    const a = coordinates[index];
    const b = coordinates[index + 1];
    if (segmentsShareEndpoint(a, b, from, to)) continue;
    if (segmentsIntersect(a, b, from, to)) return true;
  }

  return false;
}

function segmentsIntersect(a: Coordinate, b: Coordinate, c: Coordinate, d: Coordinate): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function orientation(a: Coordinate, b: Coordinate, c: Coordinate): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsShareEndpoint(a: Coordinate, b: Coordinate, c: Coordinate, d: Coordinate): boolean {
  return sameCoordinate(a, c) || sameCoordinate(a, d) || sameCoordinate(b, c) || sameCoordinate(b, d);
}

function sameCoordinate(a: Coordinate, b: Coordinate): boolean {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
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
  const suitability = summarizeMarathonSuitability(coordinates, edges, totalKm);
  const narrowKm = edges
    .filter((edge) => edge.roadLevel === "service" || edge.roadLevel === "track")
    .reduce((sum, edge) => sum + edge.lengthKm, 0);

  const supplyCoverageRatio = weightedAverage(edges, totalKm, (edge) =>
    edge.roadLevel === "trunk" || edge.roadLevel === "primary" ? 0.9 :
      edge.roadLevel === "secondary" ? 0.82 :
        edge.roadLevel === "greenway" ? 0.72 : 0.62
  );
  const hasPoiData = edges.some((edge) => edge.poiScores);
  const poiSupplyCoverageRatio = weightedAverage(edges, totalKm, (edge) => edge.poiScores?.supply ?? 0);
  const poiMedicalCoverageRatio = weightedAverage(edges, totalKm, (edge) => edge.poiScores?.medical ?? 0);
  const poiTransitCoverageRatio = weightedAverage(edges, totalKm, (edge) => edge.poiScores?.transit ?? 0);
  const poiParkCoverageRatio = weightedAverage(edges, totalKm, (edge) => edge.poiScores?.park ?? 0);

  return {
    totalClimbM: Math.round(totalClimbM),
    avgSlopePercent: Math.round((average(slopes) || 0) * 10) / 10,
    maxSlopePercent: Math.round(Math.max(0, ...slopes) * 10) / 10,
    longSteepRatio: Math.round((slopes.filter((slope) => slope > 3).length / Math.max(1, slopes.length)) * 100) / 100,
    sharpTurnRatio,
    narrowRoadRatio: Math.round((narrowKm / Math.max(totalKm, 1)) * 100) / 100,
    competitionReadinessScore: suitability.score,
    mainRoadRatio: suitability.mainRoadRatio,
    unsuitableRoadRatio: suitability.unsuitableRoadRatio,
    repeatedRoadRatio: suitability.repeatedRoadRatio,
    selfIntersectionCount: suitability.selfIntersectionCount,
    localBacktrackCount: suitability.localBacktrackCount,
    supplyCoverageRatio: Math.round(Math.max(supplyCoverageRatio, poiSupplyCoverageRatio) * 100) / 100,
    medicalAvgIntervalKm: hasPoiData ? Math.round(Math.max(2.5, 6.5 - poiMedicalCoverageRatio * 4) * 10) / 10 : 4.8,
    parkingServiceScore: Math.round(Math.max(82, poiTransitCoverageRatio * 100)),
    shadeCoverageRatio: Math.round(Math.max(0.55, poiParkCoverageRatio) * 100) / 100
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

function roadLevelScore(level: RoadLevel, preference: RoutePreference): number {
  if (preference === "main-road") {
    switch (level) {
      case "trunk":
        return 115;
      case "primary":
        return 110;
      case "secondary":
        return 88;
      case "tertiary":
        return 65;
      case "greenway":
        return 42;
      case "residential":
        return 34;
      case "service":
        return 18;
      default:
        return 45;
    }
  }

  if (preference === "scenic") {
    switch (level) {
      case "greenway":
        return 118;
      case "secondary":
        return 82;
      case "tertiary":
        return 78;
      case "primary":
        return 68;
      case "trunk":
        return 58;
      case "residential":
        return 54;
      default:
        return 48;
    }
  }

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

function poiPreferencesForRoute(preference: RoutePreference): PoiPreferences {
  if (preference === "scenic") return { theme: "scenic" };
  if (preference === "main-road") return { theme: "transit-accessible" };
  return { theme: "balanced" };
}

function baseEdgeId(edgeId: string): string {
  return edgeId.endsWith("_rev") ? edgeId.slice(0, -4) : edgeId;
}
