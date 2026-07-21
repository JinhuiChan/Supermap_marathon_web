import { computePoiAttractiveness, getElevation, haversineKm, turnAngle, turnPenaltyFromAngle } from "../domain/roadAttributes";
import { summarizeMarathonSuitability } from "../domain/competitionSuitability";
import { baseEdgeId, type RoadEdge, type RoadGraph, type RoadLevel } from "../domain/roadNetwork";
import type { PoiPreferences } from "../domain/poiTypes";
import type { Coordinate, ElevationPoint, MarathonRoute, RouteMetrics } from "../domain/routeMetrics";
import { generateRoutes } from "../domain/routeGenerator";
import { pathToMarathonRoute } from "../domain/routeReconstruct";
import { evaluateRouteQuality } from "../domain/routeQuality";
import { searchMarathonRoutes, type MarathonSearchObjective } from "../domain/routeSearch";
import type { RouteConstraints } from "../domain/routeConstraints";
import { augmentGraphWithSupportPois } from "./poiData";
import { buildRoadGraphFromGeoJson } from "./roadNetworkGeoJson";
import { wuhanLandmarkPoiLabels } from "./wuhanLandmarks";

interface OSMRouteOptions {
  id: string;
  name: string;
  targetDistanceKm: number;
  startPoint: Coordinate;
}

interface OSMCandidateOptions {
  targetDistanceKm: number;
  startPoint: Coordinate;
  endPoint?: Coordinate;
  maxRoutes?: number;
  profileIds?: string[];
  waypointGuidance?: {
    points: Coordinate[];
    hitRadiusKm?: number;
    minHits?: number;
  };
}

type RoutePreference = "balanced" | "main-road" | "scenic" | "river-scenic";
type TerrainRequirementMetrics = {
  totalClimbM: number;
  startFinishElevationDiffM: number;
  maxSingleClimbM: number;
  maxContinuousSteepKm: number;
  slopes: number[];
};

const landmarkInfluenceRadiusKm = 0.45;
const marathonDistanceToleranceRatio = 0.001;
const maxStartFinishElevationDiffM = 42;
const maxTotalClimbM = 80;
const maxSingleClimbM = 25;
const maxContinuousSteepKm = 4;
const longSteepSlopePercent = 5;

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
  },
  {
    id: "osm-river-scenic",
    name: "OSM 跨江风景优先候选线",
    color: "#0891b2",
    preference: "river-scenic"
  }
];

export function buildOsmMarathonTestRoute(
  geojson: unknown,
  options: OSMRouteOptions
): MarathonRoute | null {
  const graph = buildRoadGraphFromGeoJson(filterGeoJsonByRouteEnvelope(geojson, options));
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
  const graph = buildRoadGraphFromGeoJson(filterGeoJsonByRouteEnvelope(geojson, options));
  augmentGraphWithSupportPois(graph);
  if (options.endPoint) {
    return buildUserConstrainedRoutes(graph, { ...options, endPoint: options.endPoint });
  }
  const compliantRoutes = buildCompliantDistanceRoutes(graph, options);
  if (compliantRoutes.length > 0 || options.targetDistanceKm >= 10) return compliantRoutes;
  return buildLegacyGeneratedDistanceRoutes(graph, options);
}

function buildCompliantDistanceRoutes(graph: RoadGraph, options: OSMCandidateOptions): MarathonRoute[] {
  const activeProfiles = selectCandidateProfiles(options.profileIds);
  const routeLimit = Math.max(1, Math.min(activeProfiles.length, options.maxRoutes ?? activeProfiles.length));
  const routes: MarathonRoute[] = [];

  for (const profile of activeProfiles) {
    const result = searchMarathonRoutes(graph, {
      startPoint: options.startPoint,
      ...(options.endPoint ? { endPoint: options.endPoint } : {}),
      targetDistanceKm: options.targetDistanceKm,
      waypointGuidance: options.waypointGuidance,
      objective: preferenceToSearchObjective(profile.preference),
      maxRoutes: 1,
      maxExpandedStates: 550_000
    });
    if (result.ok) {
      const route = pathToMarathonRoute(result.routes[0], graph, routes.length);
      const candidate: MarathonRoute = {
        ...route,
        id: profile.id,
        name: profile.name,
        color: profile.color,
        targetDistanceKm: options.targetDistanceKm,
        lineage: {
          source: "osm-generated",
          roadAligned: true,
          note: "由约束感知路网搜索生成，并通过马拉松距离、地形、连续性和拓扑质量检查"
        }
      };
      if (evaluateRouteQuality(candidate, { targetDistanceKm: options.targetDistanceKm }).passed) {
        routes.push(candidate);
        if (routes.length >= routeLimit) break;
      }
    }
  }

  return routes;
}

function buildLegacyGeneratedDistanceRoutes(graph: RoadGraph, options: OSMCandidateOptions): MarathonRoute[] {
  const activeProfiles = selectCandidateProfiles(options.profileIds);
  const routeLimit = Math.max(1, Math.min(activeProfiles.length, options.maxRoutes ?? activeProfiles.length));
  const routes: MarathonRoute[] = [];

  for (const [index, profile] of activeProfiles.entries()) {
    const route = buildFirstAcceptableProfileRoute(graph, profile, index, options);
    if (!route) continue;
    routes.push(route);
    if (routes.length >= routeLimit) break;
  }

  return routes;
}

export function buildWaypointMarathonRoute(
  geojson: unknown,
  options: {
    waypoints: Coordinate[];
    targetDistanceKm: number;
    salt: number;
    id: string;
    name: string;
    color: string;
    note: string;
  }
): MarathonRoute | null {
  const graph = buildRoadGraphFromGeoJson(geojson);
  augmentGraphWithSupportPois(graph);

  // === Phase 1: Build corridor spine via Dijkstra on ALL edges ===
  // Snap each waypoint to nearest node (any edge, not just suitable)
  const wpNodeIds: string[] = [];
  for (const wp of options.waypoints) {
    const nid = findNearestNodeId(graph, wp, false);
    if (nid && (wpNodeIds.length === 0 || nid !== wpNodeIds[wpNodeIds.length - 1])) {
      wpNodeIds.push(nid);
    }
  }
  if (wpNodeIds.length < 2) return null;

  // Connect consecutive waypoints with shortest paths on ALL edges
  const spineEdges: RoadEdge[] = [];
  const spineCoords: Coordinate[] = [];
  let spineKm = 0;
  let suitableKm = 0;
  const usedBaseIds = new Set<string>();

  for (let i = 0; i < wpNodeIds.length - 1; i++) {
    // First try coarse graph (major roads only) to avoid small winding streets
    let path = shortestPathOnMajorRoads(graph, wpNodeIds[i], wpNodeIds[i + 1], usedBaseIds);
    if (!path) {
      // Fallback: use all roads if major roads can't connect
      path = shortestPathOnAllEdges(graph, wpNodeIds[i], wpNodeIds[i + 1], usedBaseIds);
    }
    if (!path) return null;

    for (const eid of path.edgeIds) {
      const edge = graph.edges.get(eid) ?? graph.edges.get(eid.replace(/_rev$/, ""));
      if (!edge) continue;
      spineEdges.push(edge);
      spineKm += edge.lengthKm;
      if (edge.competitionSuitable || edge.slopeFiltered) suitableKm += edge.lengthKm;
      // Track so later segments prefer different roads
      usedBaseIds.add(eid.endsWith("_rev") ? eid.slice(0, -4) : eid);
    }

    // Extract coordinates from the path
    if (i === 0) {
      const firstNode = graph.nodes.get(wpNodeIds[0])!;
      spineCoords.push(firstNode.coordinate);
    }
    for (let j = 1; j < path.nodeIds.length; j++) {
      const node = graph.nodes.get(path.nodeIds[j]);
      if (node) spineCoords.push(node.coordinate);
    }
  }

  const spineSuitableRatio = spineKm > 0 ? suitableKm / spineKm : 0;

  // === Phase 2: Extend to target distance on competitionSuitable edges ===
  const remainingKm = options.targetDistanceKm - spineKm;
  if (remainingKm > 0.5) {
    const lastNodeId = wpNodeIds[wpNodeIds.length - 1];
    const extWalk = walkGraphToDistance(graph, lastNodeId, Math.min(remainingKm, 15), "balanced", options.salt);
    if (extWalk.edges.length > 0) {
      for (let i = 1; i < extWalk.coordinates.length; i++) {
        spineCoords.push(extWalk.coordinates[i]);
      }
      for (const edge of extWalk.edges) {
        spineEdges.push(edge);
        spineKm += edge.lengthKm;
        if (edge.competitionSuitable || edge.slopeFiltered) suitableKm += edge.lengthKm;
      }
    }
  }

  // === Phase 3: Validate and build route ===
  const lowerBound = options.targetDistanceKm < 25 ? 0.60 : 0.85;
  const upperBound = options.targetDistanceKm < 25 ? 1.40 : 1.15;
  if (spineCoords.length < 2 || spineEdges.length === 0) return null;
  if (spineKm < options.targetDistanceKm * lowerBound || spineKm > options.targetDistanceKm * upperBound) return null;
  if (spineSuitableRatio < 0.4) return null;

  const metrics = computeRouteMetrics(spineCoords, spineEdges, spineKm);
  const route: MarathonRoute = {
    id: options.id,
    name: options.name,
    color: options.color,
    targetDistanceKm: options.targetDistanceKm,
    lengthKm: Math.round(spineKm * 1000) / 1000,
    closedLoop: false,
    coordinates: spineCoords,
    elevationProfile: buildElevationProfile(spineCoords, spineKm),
    metrics,
    lineage: { source: "osm-generated", roadAligned: true, note: options.note }
  };

  if (isFullMarathonTarget(options.targetDistanceKm) && !evaluateRouteQuality(route).passed) return null;
  return route;
}

function selectCandidateProfiles(profileIds?: string[]) {
  if (!profileIds?.length) return candidateProfiles;
  const byId = new Map(candidateProfiles.map((profile) => [profile.id, profile]));
  return profileIds.flatMap((id) => {
    const profile = byId.get(id);
    return profile ? [profile] : [];
  });
}

function preferenceToSearchObjective(preference: RoutePreference): MarathonSearchObjective {
  if (preference === "main-road") return "race-fast";
  if (preference === "scenic" || preference === "river-scenic") return "city-experience";
  return "operations";
}

function buildFirstAcceptableProfileRoute(
  graph: RoadGraph,
  profile: (typeof candidateProfiles)[number],
  profileIndex: number,
  options: OSMCandidateOptions
): MarathonRoute | null {
  const maxAttempts = isFullMarathonTarget(options.targetDistanceKm)
    ? 4
    : 6;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const route = buildRouteFromGraph(graph, {
      id: profile.id,
      name: profile.name,
      color: profile.color,
      targetDistanceKm: options.targetDistanceKm,
      startPoint: options.startPoint,
      preference: profile.preference,
      salt: profileIndex * 100 + attempt
    });
    if (route) return route;
  }

  return null;
}

function filterGeoJsonByRouteEnvelope(geojson: unknown, options: OSMCandidateOptions | OSMRouteOptions): unknown {
  if (!isFeatureCollection(geojson)) return geojson;

  const points = [options.startPoint, "endPoint" in options ? options.endPoint : undefined]
    .filter((point): point is Coordinate => Boolean(point));
  const marginDegrees = isFullMarathonTarget(options.targetDistanceKm)
    ? 0.34
    : Math.max(0.04, Math.min(0.18, options.targetDistanceKm / 100));
  const bbox = points.reduce(
    (bounds, point) => ({
      minLon: Math.min(bounds.minLon, point[0] - marginDegrees),
      minLat: Math.min(bounds.minLat, point[1] - marginDegrees),
      maxLon: Math.max(bounds.maxLon, point[0] + marginDegrees),
      maxLat: Math.max(bounds.maxLat, point[1] + marginDegrees)
    }),
    { minLon: Infinity, minLat: Infinity, maxLon: -Infinity, maxLat: -Infinity }
  );
  const features = geojson.features.filter((feature) => featureTouchesBbox(feature, bbox));

  return features.length >= 20 ? { ...geojson, features } : geojson;
}

function isFeatureCollection(geojson: unknown): geojson is {
  type: "FeatureCollection";
  features: Array<{ geometry?: { coordinates?: unknown } }>;
} {
  return Boolean(
    geojson &&
      typeof geojson === "object" &&
      "type" in geojson &&
      geojson.type === "FeatureCollection" &&
      "features" in geojson &&
      Array.isArray(geojson.features)
  );
}

function featureTouchesBbox(
  feature: { geometry?: { coordinates?: unknown } },
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number }
): boolean {
  let touches = false;
  visitCoordinates(feature.geometry?.coordinates, (coordinate) => {
    if (
      coordinate[0] >= bbox.minLon &&
      coordinate[0] <= bbox.maxLon &&
      coordinate[1] >= bbox.minLat &&
      coordinate[1] <= bbox.maxLat
    ) {
      touches = true;
    }
  });
  return touches;
}

function visitCoordinates(value: unknown, visitor: (coordinate: Coordinate) => void): void {
  if (!Array.isArray(value) || value.length === 0) return;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    visitor([value[0], value[1]]);
    return;
  }
  value.forEach((child) => visitCoordinates(child, visitor));
}

function buildUserConstrainedRoutes(graph: RoadGraph, options: OSMCandidateOptions & { endPoint: Coordinate }): MarathonRoute[] {
  const constraints: RouteConstraints = {
    startPoint: options.startPoint,
    endPoint: options.endPoint,
    mustPassPoints: [],
    avoidZones: [],
    targetDistanceKm: options.targetDistanceKm
  };
  const reviewPaths = buildFallbackReviewPaths(graph, constraints);
  const useStableReviewFirst = graph.nodes.size > 1200 || graph.edges.size > 2500;
  const paths = useStableReviewFirst
    ? []
    : generateRoutes(graph, constraints, {
        count: 3,
        seed: 2026,
        maxIterations: 24,
        lengthToleranceKm: Math.max(0.8, Math.min(5, options.targetDistanceKm * 0.18))
      });

  const endpointAlignedPaths = paths.filter((path) => pathEndsNear(graph, path, options.endPoint, 0.35));
  const candidatePaths = endpointAlignedPaths.length > 0 ? endpointAlignedPaths : reviewPaths;
  const isGenerated = endpointAlignedPaths.length > 0;
  const usesBridgeReview = !isGenerated && candidatePaths.some((path) => pathUsesBridge(graph, path));

  return candidatePaths
    .map((path, index) => ({
      ...pathToMarathonRoute(path, graph, index),
      id: `user-osm-${index + 1}`,
      name: isGenerated ? `\u7528\u6237\u9009\u70b9\u5019\u9009\u8def\u7ebf ${index + 1}` : usesBridgeReview ? "\u8de8\u6865\u9053\u8def\u6821\u6838\u7ebf" : "\u8def\u7f51\u901a\u8fbe\u6821\u6838\u7ebf",
      color: candidateProfiles[index % candidateProfiles.length].color,
      lineage: {
        source: "osm-generated" as const,
        roadAligned: true,
        note: isGenerated
          ? "\u57fa\u4e8e\u7528\u6237\u5728 Web \u5730\u56fe\u8bbe\u7f6e\u7684\u8d77\u70b9\u3001\u7ec8\u70b9\u548c\u672c\u5730 OSM \u9053\u8def\u7f51\u7edc\u751f\u6210"
          : usesBridgeReview
            ? "\u672a\u547d\u4e2d\u76ee\u6807\u91cc\u7a0b\u5019\u9009\u65f6\u8fd4\u56de\u7684\u8de8\u6865\u9053\u8def\u6821\u6838\u7ebf\uff0c\u7528\u4e8e\u68c0\u67e5\u6865\u6881\u901a\u8fbe\u548c\u8def\u7f51\u62d3\u6251"
            : "\u672a\u547d\u4e2d\u76ee\u6807\u91cc\u7a0b\u5019\u9009\u65f6\u8fd4\u56de\u7684\u9053\u8def\u6821\u6838\u7ebf\uff0c\u7528\u4e8e\u68c0\u67e5\u8d77\u7ec8\u70b9\u5438\u9644\u3001\u8def\u7f51\u8fde\u901a\u6027\u548c\u53ef\u901a\u8fbe\u65b9\u5411",
      }
    }))
    .filter((route) => !isFullMarathonTarget(options.targetDistanceKm) || routeMeetsFullMarathonRequirements(route, options.targetDistanceKm));
}

function buildFallbackReviewPaths(graph: RoadGraph, constraints: RouteConstraints) {
  const connector = buildShortestConnectorPath(graph, constraints)
    .filter((path) => path.totalLengthKm > 0.5);
  if (connector.length > 0) return connector;
  const startNodeId = findNearestNodeId(graph, constraints.startPoint, true);
  const endNodeId = findNearestNodeId(graph, constraints.endPoint, true);
  if (startNodeId && startNodeId === endNodeId) return buildReachableReviewPath(graph, constraints);
  return [];
}

function extendPathTowardTarget(
  graph: RoadGraph,
  path: { nodeIds: string[]; edgeIds: string[]; totalLengthKm: number },
  targetDistanceKm: number
) {
  const remainingKm = targetDistanceKm - path.totalLengthKm;
  const endNodeId = path.nodeIds.at(-1);
  if (!endNodeId || remainingKm <= 0.25) return path;

  const extension = buildRoundTripExtension(
    graph,
    endNodeId,
    remainingKm,
    new Set(path.edgeIds.map((edgeId) => baseEdgeId(edgeId)))
  );
  if (extension.edgeIds.length === 0) return path;

  const totalLengthKm = path.totalLengthKm + extension.totalLengthKm;
  return {
    nodeIds: [...path.nodeIds, ...extension.nodeIds],
    edgeIds: [...path.edgeIds, ...extension.edgeIds],
    totalLengthKm: Math.round(totalLengthKm * 1000) / 1000
  };
}

function pathUsesBridge(graph: RoadGraph, path: { edgeIds: string[] }): boolean {
  return path.edgeIds.some((edgeId) => graph.edges.get(edgeId)?.isBridge || graph.edges.get(baseEdgeId(edgeId))?.isBridge);
}

function pathEndsNear(graph: RoadGraph, path: { nodeIds: string[] }, coordinate: Coordinate, maxDistanceKm: number): boolean {
  const lastNodeId = path.nodeIds.at(-1);
  const lastNode = lastNodeId ? graph.nodes.get(lastNodeId) : null;
  return Boolean(lastNode && haversineKm(lastNode.coordinate, coordinate) <= maxDistanceKm);
}

function buildShortestConnectorPath(graph: RoadGraph, constraints: RouteConstraints) {
  const startNodeId = findNearestNodeId(graph, constraints.startPoint, true);
  const endNodeId = findNearestNodeId(graph, constraints.endPoint, true);
  if (!startNodeId || !endNodeId) return [];

  const distances = new Map<string, number>([[startNodeId, 0]]);
  const previous = new Map<string, { nodeId: string; edgeId: string }>();
  const unsettled = new Set<string>([startNodeId]);

  while (unsettled.size > 0) {
    let current = "";
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const nodeId of unsettled) {
      const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) {
        current = nodeId;
        currentDistance = distance;
      }
    }

    if (!current) break;
    unsettled.delete(current);
    if (current === endNodeId) break;

    for (const edge of graph.adjacency.get(current) ?? []) {
      if (!edge.competitionSuitable) continue;
      const nextDistance = currentDistance + edge.lengthKm;
      if (nextDistance < (distances.get(edge.toNodeId) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.toNodeId, nextDistance);
        previous.set(edge.toNodeId, { nodeId: current, edgeId: edge.id });
        unsettled.add(edge.toNodeId);
      }
    }
  }

  if (!previous.has(endNodeId) && startNodeId !== endNodeId) return [];

  const nodeIds: string[] = [endNodeId];
  const edgeIds: string[] = [];
  let cursor = endNodeId;
  while (cursor !== startNodeId) {
    const step = previous.get(cursor);
    if (!step) return [];
    edgeIds.unshift(step.edgeId);
    nodeIds.unshift(step.nodeId);
    cursor = step.nodeId;
  }

  const totalLengthKm = edgeIds.reduce((sum, edgeId) => sum + getEdgeLengthKm(graph, edgeId), 0);
  return [{
    nodeIds,
    edgeIds,
    totalLengthKm: Math.round(totalLengthKm * 1000) / 1000
  }];
}

// Dijkstra on ALL edges (not just competitionSuitable) — used for corridor spine between waypoints.
function shortestPathOnAllEdges(
  graph: RoadGraph,
  fromNodeId: string,
  toNodeId: string,
  usedBaseIds?: Set<string>
): { nodeIds: string[]; edgeIds: string[]; totalLengthKm: number } | null {
  if (fromNodeId === toNodeId) return { nodeIds: [fromNodeId], edgeIds: [], totalLengthKm: 0 };

  const distances = new Map<string, number>([[fromNodeId, 0]]);
  const previous = new Map<string, { nodeId: string; edgeId: string }>();
  const unsettled = new Set<string>([fromNodeId]);

  while (unsettled.size > 0) {
    let current = "";
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const nodeId of unsettled) {
      const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) { current = nodeId; currentDistance = distance; }
    }
    if (!current) break;
    unsettled.delete(current);
    if (current === toNodeId) break;

    for (const edge of graph.adjacency.get(current) ?? []) {
      const baseId = edge.id.endsWith("_rev") ? edge.id.slice(0, -4) : edge.id;
      const penalty = usedBaseIds?.has(baseId) ? edge.lengthKm * 2 : 0; // penalize used roads
      const nextDistance = currentDistance + edge.lengthKm + penalty;
      if (nextDistance < (distances.get(edge.toNodeId) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.toNodeId, nextDistance);
        previous.set(edge.toNodeId, { nodeId: current, edgeId: edge.id });
        unsettled.add(edge.toNodeId);
      }
    }
  }

  if (!previous.has(toNodeId)) return null;

  const nodeIds: string[] = [toNodeId];
  const edgeIds: string[] = [];
  let cursor = toNodeId;
  while (cursor !== fromNodeId) {
    const step = previous.get(cursor);
    if (!step) return null;
    edgeIds.unshift(step.edgeId);
    nodeIds.unshift(step.nodeId);
    cursor = step.nodeId;
  }

  const totalKm = edgeIds.reduce((sum, eid) => sum + getEdgeLengthKm(graph, eid), 0);
  return { nodeIds, edgeIds, totalLengthKm: Math.round(totalKm * 1000) / 1000 };
}

// Dijkstra on major roads only (trunk/primary/secondary/tertiary) — avoids residential alleys
const MAJOR_ROAD_LEVELS = new Set<RoadLevel>(["trunk", "primary", "secondary", "tertiary"]);
function shortestPathOnMajorRoads(
  graph: RoadGraph,
  fromNodeId: string,
  toNodeId: string,
  usedBaseIds?: Set<string>
): { nodeIds: string[]; edgeIds: string[]; totalLengthKm: number } | null {
  if (fromNodeId === toNodeId) return { nodeIds: [fromNodeId], edgeIds: [], totalLengthKm: 0 };

  const distances = new Map<string, number>([[fromNodeId, 0]]);
  const previous = new Map<string, { nodeId: string; edgeId: string }>();
  const unsettled = new Set<string>([fromNodeId]);

  while (unsettled.size > 0) {
    let current = "";
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const nodeId of unsettled) {
      const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) { current = nodeId; currentDistance = distance; }
    }
    if (!current) break;
    unsettled.delete(current);
    if (current === toNodeId) break;

    for (const edge of graph.adjacency.get(current) ?? []) {
      if (!MAJOR_ROAD_LEVELS.has(edge.roadLevel)) continue; // coarse: major roads only
      const baseId = edge.id.endsWith("_rev") ? edge.id.slice(0, -4) : edge.id;
      const penalty = usedBaseIds?.has(baseId) ? edge.lengthKm * 2 : 0;
      const nextDistance = currentDistance + edge.lengthKm + penalty;
      if (nextDistance < (distances.get(edge.toNodeId) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.toNodeId, nextDistance);
        previous.set(edge.toNodeId, { nodeId: current, edgeId: edge.id });
        unsettled.add(edge.toNodeId);
      }
    }
  }

  if (!previous.has(toNodeId)) return null;

  const nodeIds: string[] = [toNodeId];
  const edgeIds: string[] = [];
  let cursor = toNodeId;
  while (cursor !== fromNodeId) {
    const step = previous.get(cursor);
    if (!step) return null;
    edgeIds.unshift(step.edgeId);
    nodeIds.unshift(step.nodeId);
    cursor = step.nodeId;
  }

  const totalKm = edgeIds.reduce((sum, eid) => sum + getEdgeLengthKm(graph, eid), 0);
  return { nodeIds, edgeIds, totalLengthKm: Math.round(totalKm * 1000) / 1000 };
}

function buildBridgeReviewPath(graph: RoadGraph, constraints: RouteConstraints) {
  const startNodeId = findNearestNodeId(graph, constraints.startPoint, true);
  const endNodeId = findNearestNodeId(graph, constraints.endPoint, true);
  if (!startNodeId || !endNodeId || startNodeId === endNodeId) return [];

  const startNode = graph.nodes.get(startNodeId);
  const endNode = graph.nodes.get(endNodeId);
  if (!startNode || !endNode) return [];

  const bridgeChoice = [...graph.edges.values()]
    .filter((edge) => edge.isBridge && edge.competitionSuitable)
    .map((edge) => bestBridgeOrientation(graph, edge, startNode.coordinate, endNode.coordinate))
    .filter((choice): choice is NonNullable<typeof choice> => choice !== null)
    .sort((a, b) => a.score - b.score)[0];

  if (!bridgeChoice) return [];

  const connectorNodeIds = [
    startNodeId,
    bridgeChoice.fromNodeId,
    bridgeChoice.toNodeId
  ].filter((nodeId, index, all) => index === 0 || nodeId !== all[index - 1]);
  const approachKm = haversineKm(startNode.coordinate, graph.nodes.get(bridgeChoice.fromNodeId)?.coordinate ?? startNode.coordinate);
  const exitKm = haversineKm(graph.nodes.get(bridgeChoice.toNodeId)?.coordinate ?? endNode.coordinate, endNode.coordinate);
  const bridgeLengthKm = getEdgeLengthKm(graph, bridgeChoice.edgeId);
  const baseLengthKm = approachKm + bridgeLengthKm + exitKm;
  const extension = buildRoundTripExtension(
    graph,
    bridgeChoice.toNodeId,
    Math.max(0, constraints.targetDistanceKm - baseLengthKm),
    new Set([baseEdgeId(bridgeChoice.edgeId)])
  );
  const nodeIds = [
    ...connectorNodeIds,
    ...extension.nodeIds,
    endNodeId
  ].filter((nodeId, index, all) => index === 0 || nodeId !== all[index - 1]);
  const totalLengthKm = baseLengthKm + extension.totalLengthKm;

  return [{
    nodeIds,
    edgeIds: [bridgeChoice.edgeId, ...extension.edgeIds],
    totalLengthKm: Math.round(totalLengthKm * 1000) / 1000
  }];
}

function bestBridgeOrientation(
  graph: RoadGraph,
  edge: RoadEdge,
  start: Coordinate,
  end: Coordinate
): { edgeId: string; fromNodeId: string; toNodeId: string; score: number } | null {
  const fromNode = graph.nodes.get(edge.fromNodeId);
  const toNode = graph.nodes.get(edge.toNodeId);
  if (!fromNode || !toNode) return null;

  const forwardScore =
    bridgeNamePenalty(edge) +
    haversineKm(start, fromNode.coordinate) +
    edge.lengthKm * 0.15 +
    haversineKm(toNode.coordinate, end);
  const reverseScore =
    bridgeNamePenalty(edge) +
    haversineKm(start, toNode.coordinate) +
    edge.lengthKm * 0.15 +
    haversineKm(fromNode.coordinate, end);

  if (forwardScore <= reverseScore) {
    return { edgeId: edge.id, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId, score: forwardScore };
  }
  return { edgeId: edge.id, fromNodeId: edge.toNodeId, toNodeId: edge.fromNodeId, score: reverseScore };
}

function bridgeNamePenalty(edge: RoadEdge): number {
  const id = edge.id.toLocaleLowerCase();
  return id.includes("bridge") ? -1 : 0;
}

function buildRoundTripExtension(
  graph: RoadGraph,
  startNodeId: string,
  targetKm: number,
  usedBaseIds: Set<string>
): { nodeIds: string[]; edgeIds: string[]; totalLengthKm: number } {
  if (targetKm <= 0.25) return { nodeIds: [], edgeIds: [], totalLengthKm: 0 };

  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  let totalLengthKm = 0;
  let currentNodeId = startNodeId;

  for (let cycle = 0; cycle < 80 && totalLengthKm < targetKm * 0.96; cycle++) {
    const remainingKm = targetKm - totalLengthKm;
    const outbound = buildOutboundWalk(graph, currentNodeId, Math.max(0.25, remainingKm), usedBaseIds);
    if (outbound.steps.length === 0) break;
    if (totalLengthKm > 0 && totalLengthKm + outbound.totalLengthKm > targetKm * 1.05) break;

    for (const step of outbound.steps) {
      edgeIds.push(step.edgeId);
      nodeIds.push(step.toNodeId);
      totalLengthKm += step.lengthKm;
      currentNodeId = step.toNodeId;
    }
  }

  return {
    nodeIds,
    edgeIds,
    totalLengthKm: Math.round(totalLengthKm * 1000) / 1000
  };
}

function buildOutboundWalk(
  graph: RoadGraph,
  startNodeId: string,
  targetKm: number,
  usedBaseIds: Set<string>
): { steps: Array<{ edgeId: string; fromNodeId: string; toNodeId: string; lengthKm: number }>; totalLengthKm: number } {
  const steps: Array<{ edgeId: string; fromNodeId: string; toNodeId: string; lengthKm: number }> = [];
  let current = startNodeId;
  let totalLengthKm = 0;
  let previousBaseId = "";

  for (let stepIndex = 0; stepIndex < 400 && totalLengthKm < targetKm; stepIndex++) {
    const next = chooseExtensionEdge(graph, current, usedBaseIds, previousBaseId);
    if (!next) break;
    if (steps.length > 0 && totalLengthKm + next.lengthKm > targetKm * 1.05) break;

    const baseId = baseEdgeId(next.id);
    steps.push({
      edgeId: next.id,
      fromNodeId: next.fromNodeId,
      toNodeId: next.toNodeId,
      lengthKm: next.lengthKm
    });
    usedBaseIds.add(baseId);
    previousBaseId = baseId;
    current = next.toNodeId;
    totalLengthKm += next.lengthKm;
  }

  return { steps, totalLengthKm };
}

function chooseExtensionEdge(
  graph: RoadGraph,
  nodeId: string,
  usedBaseIds: Set<string>,
  previousBaseId: string
): RoadEdge | null {
  return (graph.adjacency.get(nodeId) ?? [])
    .filter((edge) => edge.competitionSuitable)
    .filter((edge) => !usedBaseIds.has(baseEdgeId(edge.id)))
    .filter((edge) => baseEdgeId(edge.id) !== previousBaseId)
    .sort((a, b) => {
      const aBaseId = baseEdgeId(a.id);
      const bBaseId = baseEdgeId(b.id);
      return (
        extensionEdgeScore(graph, b) - extensionEdgeScore(graph, a) ||
        b.lengthKm - a.lengthKm ||
        a.id.localeCompare(b.id)
      );
    })[0] ?? null;
}

function extensionEdgeScore(graph: RoadGraph, edge: RoadEdge): number {
  return roadLevelScore(edge.roadLevel, "balanced") + computeLandmarkEdgeBonus(graph, edge, [], "balanced") * 0.45;
}

function buildReachableReviewPath(graph: RoadGraph, constraints: RouteConstraints) {
  const startNodeId = findNearestNodeId(graph, constraints.startPoint, true);
  if (!startNodeId) return [];

  const targetKm = Math.max(1, Math.min(constraints.targetDistanceKm, 12));
  const nodeIds = [startNodeId];
  const edgeIds: string[] = [];
  const used = new Set<string>();
  let current = startNodeId;
  let totalLengthKm = 0;

  for (let step = 0; step < 400 && totalLengthKm < targetKm; step++) {
    const outgoing = (graph.adjacency.get(current) ?? [])
      .filter((edge) => edge.competitionSuitable)
      .filter((edge) => !used.has(baseEdgeId(edge.id)))
      .sort((a, b) =>
        roadLevelScore(b.roadLevel, "balanced") - roadLevelScore(a.roadLevel, "balanced") ||
        b.lengthKm - a.lengthKm ||
        a.id.localeCompare(b.id)
      );
    const next = outgoing[0];
    if (!next) break;

    used.add(baseEdgeId(next.id));
    edgeIds.push(next.id);
    nodeIds.push(next.toNodeId);
    totalLengthKm += next.lengthKm;
    current = next.toNodeId;
  }

  if (edgeIds.length === 0 || totalLengthKm <= 0) return [];
  return [{
    nodeIds,
    edgeIds,
    totalLengthKm: Math.round(totalLengthKm * 1000) / 1000
  }];
}

function buildRouteFromGraph(
  graph: RoadGraph,
  options: OSMRouteOptions & { color: string; preference: RoutePreference; salt: number }
): MarathonRoute | null {
  const primaryTargetKm = isFullMarathonTarget(options.targetDistanceKm)
    ? options.targetDistanceKm * 0.98
    : options.targetDistanceKm;
  if (options.preference === "river-scenic") {
    const requiredBridgeWalk = walkRequiredBridgeToDistance(graph, options.targetDistanceKm * 0.06, options.preference, options.salt);
    return routeFromGeneratedWalk(requiredBridgeWalk, options);
  }

  const startNodeId = findNearestNodeId(graph, options.startPoint, true);
  if (!startNodeId) return null;

  const primaryWalk = walkGraphToDistance(graph, startNodeId, primaryTargetKm, options.preference, options.salt);
  const strictGreedyWalk = walkGraphGreedyToDistance(graph, startNodeId, options.targetDistanceKm, options.preference, options.salt, false);
  const softGreedyWalk = walkGraphGreedyToDistance(graph, startNodeId, options.targetDistanceKm, options.preference, options.salt, true);
  const walk = chooseBestGeneratedWalk([primaryWalk, strictGreedyWalk, softGreedyWalk], options.targetDistanceKm);
  return routeFromGeneratedWalk(walk, options);
}

function routeFromGeneratedWalk(
  walk: { coordinates: Coordinate[]; edges: RoadEdge[]; totalKm: number },
  options: OSMRouteOptions & { color: string; preference: RoutePreference; salt: number }
): MarathonRoute | null {
  if (walk.coordinates.length < 2) return null;
  const measuredWalk = isWithinDistanceTolerance(walk.totalKm, options.targetDistanceKm) || canProjectWalkToTargetDistance(walk, options.targetDistanceKm)
    ? walk
    : null;
  if (!measuredWalk) return null;
  const displayCoordinates = coordinatesFromEdges(measuredWalk.edges, measuredWalk.coordinates);
  const metrics = computeRouteMetrics(displayCoordinates, measuredWalk.edges, measuredWalk.totalKm);
  if (!isAcceptableGeneratedRoute(metrics, options.preference)) return null;
  const roundedLengthKm = Math.round(measuredWalk.totalKm * 1000) / 1000;

  return {
    id: options.id,
    name: options.name,
    color: options.color,
    targetDistanceKm: options.targetDistanceKm,
    lengthKm: roundedLengthKm,
    closedLoop: haversineKm(displayCoordinates[0], displayCoordinates.at(-1) ?? displayCoordinates[0]) < 0.5,
    coordinates: displayCoordinates,
    elevationProfile: buildElevationProfile(displayCoordinates, measuredWalk.totalKm),
    metrics,
    lineage: {
      source: "osm-generated",
      roadAligned: true,
      note: `从本地 OSM 道路网络生成的 ${options.name}，用于验证真实路网候选方案`
    }
  };
}

function canProjectWalkToTargetDistance(
  walk: { coordinates: Coordinate[]; edges: RoadEdge[]; totalKm: number },
  targetDistanceKm: number
): boolean {
  // For marathon-length routes: accept walks that reach at least 85% of target.
  // The actual (not projected) distance is displayed to the user.
  if (!isFullMarathonTarget(targetDistanceKm)) return false;
  return walk.totalKm >= targetDistanceKm * 0.85 && walk.totalKm <= targetDistanceKm * 1.08;
}

function coordinatesFromEdges(edges: RoadEdge[], fallback: Coordinate[]): Coordinate[] {
  const coordinates: Coordinate[] = [];
  for (const edge of edges) {
    const edgeCoordinates = edge.coordinates ?? [];
    if (edgeCoordinates.length >= 2) {
      appendCoordinates(coordinates, edgeCoordinates);
    }
  }

  if (coordinates.length < 2) {
    console.warn(
      "coordinatesFromEdges: falling back to walk node coordinates, some edges lack geometry data"
    );
    return fallback;
  }
  return coordinates;
}

function appendCoordinates(target: Coordinate[], coordinates: Coordinate[]): void {
  for (const coordinate of coordinates) {
    if (target.length === 0 || !sameCoordinate(target[target.length - 1], coordinate)) {
      target.push(coordinate);
    }
  }
}

function chooseBestGeneratedWalk(
  walks: Array<{ coordinates: Coordinate[]; edges: RoadEdge[]; totalKm: number }>,
  targetKm: number
): { coordinates: Coordinate[]; edges: RoadEdge[]; totalKm: number } {
  const usable = walks.filter((walk) => walk.coordinates.length >= 2 && walk.edges.length > 0);
  if (usable.length === 0) return { coordinates: [], edges: [], totalKm: 0 };
  const exact = usable.find((walk) => isWithinDistanceTolerance(walk.totalKm, targetKm));
  if (exact) return exact;
  return usable.sort((a, b) => b.totalKm - a.totalKm)[0];
}

function walkRequiredBridgeToDistance(
  graph: RoadGraph,
  targetDistanceKm: number,
  preference: RoutePreference,
  salt: number
): { coordinates: Coordinate[]; edges: RoadEdge[]; totalKm: number } {
  const bridgeEdges = [...graph.edges.values()]
    .filter((edge) => edge.isRequiredRiverBridge && edge.competitionSuitable)
    .sort((a, b) => b.lengthKm - a.lengthKm || a.id.localeCompare(b.id))
    .slice(0, 3);
  const walks = bridgeEdges.flatMap((edge, index) => {
    const forward = getDirectedEdge(graph, edge.id, false);
    const reverse = getDirectedEdge(graph, edge.id, true);
    return [forward, reverse]
      .filter((directed): directed is RoadEdge => Boolean(directed))
      .map((directed) => extendGreedyWalkFromSeed(graph, directed, targetDistanceKm, preference, salt + index, true));
  });
  return chooseBestGeneratedWalk(walks, targetDistanceKm);
}

function getDirectedEdge(graph: RoadGraph, edgeId: string, reversed: boolean): RoadEdge | null {
  const edge = graph.edges.get(edgeId);
  if (!edge) return null;
  if (!reversed) return edge;
  return (graph.adjacency.get(edge.toNodeId) ?? []).find((candidate) => candidate.id === `${edgeId}_rev`) ?? null;
}

function extendGreedyWalkFromSeed(
  graph: RoadGraph,
  seedEdge: RoadEdge,
  targetDistanceKm: number,
  preference: RoutePreference,
  salt: number,
  allowSlopeFilteredEdges: boolean
): { coordinates: Coordinate[]; edges: RoadEdge[]; totalKm: number } {
  const fromNode = graph.nodes.get(seedEdge.fromNodeId);
  const toNode = graph.nodes.get(seedEdge.toNodeId);
  if (!fromNode || !toNode) return { coordinates: [], edges: [], totalKm: 0 };

  const coordinates: Coordinate[] = [fromNode.coordinate, toNode.coordinate];
  const edges: RoadEdge[] = [seedEdge];
  const used = new Map<string, number>([[baseEdgeId(seedEdge.id), 1]]);
  let currentNodeId = seedEdge.toNodeId;
  let previousNodeId = seedEdge.fromNodeId;
  let totalKm = seedEdge.lengthKm;

  for (let step = 0; step < 900 && totalKm < targetDistanceKm; step++) {
    const remainingKm = targetDistanceKm - totalKm;
    const outgoing = graph.adjacency.get(currentNodeId) ?? [];
    const candidates = outgoing
      .filter((edge) => isUsableGeneratedEdge(edge, allowSlopeFilteredEdges))
      .filter((edge) => !used.has(baseEdgeId(edge.id)))
      .filter((edge) => edge.toNodeId !== previousNodeId || outgoing.length === 1)
      .filter((edge) => !wouldCreateLocalKnot(graph, edge, coordinates))
      .map((edge) => ({
        edge,
        score: bridgeExtensionEdgeScore(graph, edge, coordinates, preference)
      }))
      .sort((a, b) => b.score - a.score || a.edge.id.localeCompare(b.edge.id));

    if (candidates.length === 0) break;
    const topCount = 1;
    const choice = candidates[(salt + step) % topCount].edge;
    const nextNode = graph.nodes.get(choice.toNodeId);
    const currentNode = graph.nodes.get(currentNodeId);
    if (!nextNode || !currentNode) break;

    if (choice.lengthKm > remainingKm) {
      coordinates.push(interpolateCoordinate(currentNode.coordinate, nextNode.coordinate, remainingKm / choice.lengthKm));
      edges.push({ ...choice, lengthKm: remainingKm });
      totalKm = targetDistanceKm;
      break;
    }

    coordinates.push(nextNode.coordinate);
    edges.push(choice);
    used.set(baseEdgeId(choice.id), 1);
    previousNodeId = currentNodeId;
    currentNodeId = choice.toNodeId;
    totalKm += choice.lengthKm;
  }

  return {
    coordinates,
    edges,
    totalKm: Math.round(totalKm * 1000) / 1000
  };
}

function bridgeExtensionEdgeScore(
  graph: RoadGraph,
  edge: RoadEdge,
  currentCoordinates: Coordinate[],
  preference: RoutePreference
): number {
  const toCoordinate = graph.nodes.get(edge.toNodeId)?.coordinate;
  const turnPenalty = computeCandidateTurnPenalty(currentCoordinates, toCoordinate);
  const slopePenalty = Math.max(0, effectiveRaceSlopePercent(edge.slopeMean ?? 0) - 1.6) * 20;
  const slopeFilteredPenalty = edge.slopeFiltered ? 90 : 0;
  return (
    roadLevelScore(edge.roadLevel, preference) +
    computeBridgeEdgeBonus(edge, preference) +
    computeLandmarkEdgeBonus(graph, edge, currentCoordinates, preference) +
    Math.min(edge.lengthKm, 1.2) * 26 -
    turnPenalty -
    slopePenalty -
    slopeFilteredPenalty
  );
}

function isAcceptableGeneratedRoute(metrics: RouteMetrics, preference: RoutePreference = "balanced"): boolean {
  const isRequiredRiverRoute = preference === "river-scenic" && metrics.wuhanYangtzeBridgePassed === true;
  if (metrics.sharpTurnRatio > (isRequiredRiverRoute ? 0.55 : 0.60)) return false;
  if ((metrics.sharpTurnDensityPerKm ?? 0) > 4.0) return false;
  if ((metrics.repeatedRoadRatio ?? 0) > 0.35) return false;
  if ((metrics.localKnotCount ?? 0) > 40) return false;
  if ((metrics.hairpinTurnCount ?? 0) > 20) return false;
  if ((metrics.startFinishElevationDiffM ?? 0) > maxStartFinishElevationDiffM) return false;
  if (metrics.totalClimbM >= maxTotalClimbM) return false;
  if ((metrics.maxSingleClimbM ?? 0) >= maxSingleClimbM) return false;
  if ((metrics.maxContinuousSteepKm ?? 0) > maxContinuousSteepKm) return false;
  if (metrics.avgSlopePercent >= 2) return false;
  if (metrics.maxSlopePercent > 3) return false;
  if (preference === "river-scenic" && metrics.wuhanYangtzeBridgePassed !== true) return false;
  return true;
}

function isWithinDistanceTolerance(actualKm: number, targetKm: number): boolean {
  return Math.abs(actualKm - targetKm) <= Math.max(0.001, targetKm * marathonDistanceToleranceRatio);
}

function isFullMarathonTarget(targetKm: number): boolean {
  return Math.abs(targetKm - 42.195) <= 0.25;
}

function routeMeetsFullMarathonRequirements(route: MarathonRoute, targetKm: number): boolean {
  return isWithinDistanceTolerance(route.lengthKm, targetKm) && isAcceptableGeneratedRoute(route.metrics);
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

  const maxSearchSteps = targetDistanceKm > 30 ? 120000 : 80000;
  for (let step = 0; step < maxSearchSteps && stack.length > 0 && totalKm < targetDistanceKm; step++) {
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

function walkGraphGreedyToDistance(
  graph: RoadGraph,
  startNodeId: string,
  targetDistanceKm: number,
  preference: RoutePreference,
  salt: number,
  allowSlopeFilteredEdges: boolean
): { coordinates: Coordinate[]; edges: RoadEdge[]; totalKm: number } {
  const startNode = graph.nodes.get(startNodeId);
  if (!startNode) return { coordinates: [], edges: [], totalKm: 0 };

  const coordinates: Coordinate[] = [startNode.coordinate];
  const edges: RoadEdge[] = [];
  const used = new Map<string, number>();
  let currentNodeId = startNodeId;
  let previousNodeId = "";
  let totalKm = 0;

  for (let step = 0; step < 5000 && totalKm < targetDistanceKm; step++) {
    const remainingKm = targetDistanceKm - totalKm;
    const outgoing = graph.adjacency.get(currentNodeId) ?? [];
    const candidates = outgoing
      .filter((edge) => isUsableGeneratedEdge(edge, allowSlopeFilteredEdges))
      .filter((edge) => !used.has(baseEdgeId(edge.id)))
      .filter((edge) => edge.toNodeId !== previousNodeId || outgoing.length === 1)
      .filter((edge) => !wouldCreateLocalKnot(graph, edge, coordinates))
      .map((edge) => ({
        edge,
        score: greedyEdgeScore(graph, edge, coordinates, preference, used, remainingKm, allowSlopeFilteredEdges)
      }))
      .sort((a, b) => b.score - a.score || a.edge.id.localeCompare(b.edge.id));

    if (candidates.length === 0) break;
    const topCount = Math.min(4, candidates.length);
    const choice = candidates[(salt + step) % topCount].edge;
    const nextNode = graph.nodes.get(choice.toNodeId);
    const currentNode = graph.nodes.get(currentNodeId);
    if (!nextNode || !currentNode) break;

    if (choice.lengthKm > remainingKm) {
      coordinates.push(interpolateCoordinate(currentNode.coordinate, nextNode.coordinate, remainingKm / choice.lengthKm));
      edges.push({ ...choice, lengthKm: remainingKm });
      totalKm = targetDistanceKm;
      break;
    }

    coordinates.push(nextNode.coordinate);
    edges.push(choice);
    used.set(baseEdgeId(choice.id), 1);
    previousNodeId = currentNodeId;
    currentNodeId = choice.toNodeId;
    totalKm += choice.lengthKm;
  }

  return {
    coordinates,
    edges,
    totalKm: Math.round(totalKm * 1000) / 1000
  };
}

function greedyEdgeScore(
  graph: RoadGraph,
  edge: RoadEdge,
  currentCoordinates: Coordinate[],
  preference: RoutePreference,
  used: Map<string, number>,
  remainingKm: number,
  allowSlopeFilteredEdges: boolean
): number {
  const onward = getOnwardCapacity(graph, edge, used, allowSlopeFilteredEdges);
  const reachableKm = getReachableUnusedCapacityKm(graph, edge.toNodeId, used, baseEdgeId(edge.id), Math.max(remainingKm, 8), allowSlopeFilteredEdges);
  const toCoordinate = graph.nodes.get(edge.toNodeId)?.coordinate;
  const turnPenalty = computeCandidateTurnPenalty(currentCoordinates, toCoordinate);
  const slopePenalty = Math.max(0, effectiveRaceSlopePercent(edge.slopeMean ?? 0) - 1.6) * 28;
  const slopeFilteredPenalty = edge.slopeFiltered ? 240 : 0;
  const tooShortDeadEndPenalty = reachableKm + edge.lengthKm < remainingKm * 0.88 ? 900 : 0;

  return (
    roadLevelScore(edge.roadLevel, preference) +
    computeBridgeEdgeBonus(edge, preference) +
    computeLandmarkEdgeBonus(graph, edge, currentCoordinates, preference) +
    Math.min(edge.lengthKm, 1.2) * 16 +
    Math.min(reachableKm, 42) * 12 +
    Math.min(onward.km, 3) * 18 +
    onward.count * 24 -
    turnPenalty -
    slopePenalty -
    slopeFilteredPenalty -
    tooShortDeadEndPenalty
  );
}

function getReachableUnusedCapacityKm(
  graph: RoadGraph,
  startNodeId: string,
  used: Map<string, number>,
  justUsedBaseId: string,
  limitKm: number,
  allowSlopeFilteredEdges: boolean
): number {
  const visitedNodes = new Set<string>([startNodeId]);
  const visitedBaseEdges = new Set<string>([justUsedBaseId]);
  const queue = [startNodeId];
  let reachableKm = 0;

  while (queue.length > 0 && reachableKm < limitKm) {
    const nodeId = queue.shift()!;
    for (const edge of graph.adjacency.get(nodeId) ?? []) {
      if (!isUsableGeneratedEdge(edge, allowSlopeFilteredEdges)) continue;
      const baseId = baseEdgeId(edge.id);
      if (used.has(baseId) || visitedBaseEdges.has(baseId)) continue;
      visitedBaseEdges.add(baseId);
      reachableKm += edge.lengthKm;
      if (!visitedNodes.has(edge.toNodeId)) {
        visitedNodes.add(edge.toNodeId);
        queue.push(edge.toNodeId);
      }
      if (reachableKm >= limitKm) break;
    }
  }

  return reachableKm;
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
    if (!edge.competitionSuitable && !edge.slopeFiltered) return false;
    if (usedCount > 1) return false;
    if (wouldCreateLocalKnot(graph, edge, currentCoordinates)) return false;
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
    const fromCoordinate = graph.nodes.get(edge.fromNodeId)?.coordinate;
    const toCoordinate = graph.nodes.get(edge.toNodeId)?.coordinate;
    const directionalSlope = fromCoordinate && toCoordinate ? Math.abs(estimateSlope(fromCoordinate, toCoordinate)) : 0;
    const terrainPenalty = Math.max(0, directionalSlope - 3) * 42;
    const turnPenalty = computeCandidateTurnPenalty(currentCoordinates, toCoordinate);
    const deadEndPenalty = onward.count === 0 && edge.lengthKm < remainingKm ? 180 : 0;
    const intersectionPenalty = wouldIntersectExistingRoute(graph, edge, currentCoordinates) ? 260 : 0;
    const poiBonus = computePoiAttractiveness(edge.poiScores, poiPreferencesForRoute(preference)) * 0.18;
    const landmarkBonus = computeLandmarkEdgeBonus(graph, edge, currentCoordinates, preference);
    const bridgeBonus = computeBridgeEdgeBonus(edge, preference);
    return {
      edge,
      score:
        roadLevelScore(edge.roadLevel, preference) +
        lengthBonus +
        explorationBonus +
        poiBonus +
        landmarkBonus +
        bridgeBonus +
        Math.min(onward.km, 2) * 12 +
        onward.count * 18 -
        reusePenalty -
        recentPenalty -
        turnPenalty -
        terrainPenalty -
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

function computeCandidateTurnPenalty(currentCoordinates: Coordinate[], nextCoordinate: Coordinate | undefined): number {
  if (!nextCoordinate || currentCoordinates.length < 2) return 0;
  const a = currentCoordinates[currentCoordinates.length - 2];
  const b = currentCoordinates[currentCoordinates.length - 1];
  const angle = turnAngle(a, b, nextCoordinate);
  return turnPenaltyFromAngle(angle) * 3.0;
}

function computeBridgeEdgeBonus(edge: RoadEdge, preference: RoutePreference): number {
  if (!edge.isBridge) return 0;
  if (preference === "river-scenic") {
    if (edge.isRequiredRiverBridge) return 420 + Math.min(edge.lengthKm, 2) * 60;
    if (isYangtzeRiverBridgeEdge(edge)) return 160 + Math.min(edge.lengthKm, 2) * 28;
    return 24;
  }
  if (preference === "scenic") return 34 + Math.min(edge.lengthKm, 2) * 8;
  if (preference === "balanced") return 18;
  return 6;
}

function isYangtzeRiverBridgeEdge(edge: RoadEdge): boolean {
  return edge.isBridge && /长江.*桥|长江大桥/.test(edge.roadName ?? "");
}

function computeLandmarkEdgeBonus(
  graph: RoadGraph,
  edge: RoadEdge,
  currentCoordinates: Coordinate[],
  preference: RoutePreference
): number {
  const from = graph.nodes.get(edge.fromNodeId)?.coordinate;
  const to = graph.nodes.get(edge.toNodeId)?.coordinate;
  if (!from || !to) return 0;

  const coveredLandmarks = getCoveredLandmarkIds(currentCoordinates, landmarkInfluenceRadiusKm);
  const preferenceMultiplier = preference === "river-scenic" ? 1.65 : preference === "scenic" ? 1.45 : preference === "main-road" ? 0.72 : 1;
  let bonus = 0;

  for (const landmark of wuhanLandmarkPoiLabels) {
    if (coveredLandmarks.has(landmark.id)) continue;
    const distanceKm = pointToSegmentDistanceKm(landmark.coordinate, from, to);
    if (distanceKm > landmarkInfluenceRadiusKm) continue;

    const closeness = 1 - distanceKm / landmarkInfluenceRadiusKm;
    const priorityWeight = Math.max(0.7, (landmark.priority ?? 90) / 100);
    bonus += closeness * priorityWeight * 48;
  }

  return bonus * preferenceMultiplier;
}

function getOnwardCapacity(
  graph: RoadGraph,
  edge: RoadEdge,
  used: Map<string, number>,
  allowSlopeFilteredEdges = false
): { count: number; km: number } {
  const nextOutgoing = graph.adjacency.get(edge.toNodeId) ?? [];
  let count = 0;
  let km = 0;

  for (const nextEdge of nextOutgoing) {
    const baseId = baseEdgeId(nextEdge.id);
    if (nextEdge.toNodeId === edge.fromNodeId) continue;
    if (!isUsableGeneratedEdge(nextEdge, allowSlopeFilteredEdges)) continue;
    if ((used.get(baseId) ?? 0) > 0) continue;
    if (baseId === baseEdgeId(edge.id)) continue;
    count += 1;
    km += nextEdge.lengthKm;
  }

  return { count, km };
}

function isUsableGeneratedEdge(edge: RoadEdge, allowSlopeFilteredEdges: boolean): boolean {
  return edge.competitionSuitable || (allowSlopeFilteredEdges && edge.slopeFiltered === true);
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

function wouldCreateLocalKnot(graph: RoadGraph, edge: RoadEdge, coordinates: Coordinate[]): boolean {
  if (coordinates.length < 4) return false;
  const to = graph.nodes.get(edge.toNodeId)?.coordinate;
  if (!to) return false;

  const routeEnd = coordinates[coordinates.length - 1];
  let walkedKm = edge.lengthKm;
  let maxDistanceFromAnchorKm = 0;

  for (let index = coordinates.length - 2; index >= 0; index--) {
    const anchor = coordinates[index];
    const next = coordinates[index + 1];
    walkedKm += haversineKm(anchor, next);
    if (walkedKm > 1.5) break;

    maxDistanceFromAnchorKm = Math.max(
      maxDistanceFromAnchorKm,
      haversineKm(anchor, routeEnd),
      haversineKm(anchor, to)
    );

    if (walkedKm >= 0.2 && haversineKm(anchor, to) < 0.2 && maxDistanceFromAnchorKm > 0.14) {
      return true;
    }
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

function findNearestNodeId(graph: RoadGraph, coordinate: Coordinate, requireSuitableOutgoing = false): string | null {
  let nearestId: string | null = null;
  let nearestKm = Number.POSITIVE_INFINITY;
  for (const node of graph.nodes.values()) {
    if (requireSuitableOutgoing && !hasSuitableOutgoingEdge(graph, node.id)) continue;
    const distanceKm = haversineKm(coordinate, node.coordinate);
    if (distanceKm < nearestKm) {
      nearestKm = distanceKm;
      nearestId = node.id;
    }
  }
  return nearestId;
}

function hasSuitableOutgoingEdge(graph: RoadGraph, nodeId: string): boolean {
  return (graph.adjacency.get(nodeId) ?? []).some((edge) => edge.competitionSuitable);
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
  const terrain = computeTerrainRequirementMetrics(edges, elevationProfile);
  const slopes = terrain.slopes;
  const sharpTurnRatio = computeSharpTurnRatio(coordinates);
  const sharpTurnDensityPerKm = totalKm > 0
    ? Math.round((computeSharpTurnCount(coordinates) / totalKm) * 100) / 100
    : 0;
  const hairpinTurnCount = computeHairpinTurnCount(coordinates);
  const turnPenaltyScore = computeTurnPenaltyScore(coordinates);
  const suitability = summarizeMarathonSuitability(coordinates, edges, totalKm);
  const narrowKm = edges
    .filter((edge) => edge.roadLevel === "service" || edge.roadLevel === "track")
    .reduce((sum, edge) => sum + edge.lengthKm, 0);
  const bridgeDistanceKm = edges
    .filter((edge) => edge.isBridge)
    .reduce((sum, edge) => sum + edge.lengthKm, 0);
  const bridgeSegmentCount = edges.filter((edge) => edge.isBridge).length;
  const yangtzeBridgeEdges = edges.filter((edge) => isYangtzeRiverBridgeEdge(edge));
  const yangtzeBridgeDistanceKm = yangtzeBridgeEdges.reduce((sum, edge) => sum + edge.lengthKm, 0);
  const yangtzeBridgeNames = [...new Set(yangtzeBridgeEdges.map((edge) => edge.roadName).filter((name): name is string => Boolean(name)))];
  const wuhanYangtzeBridgePassed = edges.some((edge) => edge.isRequiredRiverBridge);

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
  const landmarkCoverage = summarizeLandmarkCoverage(coordinates);

  return {
    totalClimbM: Math.round(terrain.totalClimbM),
    startFinishElevationDiffM: Math.round(terrain.startFinishElevationDiffM),
    maxSingleClimbM: Math.round(terrain.maxSingleClimbM),
    maxContinuousSteepKm: Math.round(terrain.maxContinuousSteepKm * 100) / 100,
    avgSlopePercent: Math.round((average(slopes) || 0) * 10) / 10,
    maxSlopePercent: Math.round(Math.max(0, ...slopes) * 10) / 10,
    longSteepRatio: Math.round((slopes.filter((slope) => slope > 3).length / Math.max(1, slopes.length)) * 100) / 100,
    sharpTurnRatio,
    sharpTurnDensityPerKm,
    turnPenaltyScore,
    narrowRoadRatio: Math.round((narrowKm / Math.max(totalKm, 1)) * 100) / 100,
    competitionReadinessScore: suitability.score,
    mainRoadRatio: suitability.mainRoadRatio,
    unsuitableRoadRatio: suitability.unsuitableRoadRatio,
    repeatedRoadRatio: suitability.repeatedRoadRatio,
    selfIntersectionCount: suitability.selfIntersectionCount,
    localBacktrackCount: suitability.localBacktrackCount,
    localKnotCount: suitability.localKnotCount,
    hairpinTurnCount,
    supplyCoverageRatio: Math.round(Math.max(supplyCoverageRatio, poiSupplyCoverageRatio) * 100) / 100,
    medicalAvgIntervalKm: hasPoiData ? Math.round(Math.max(2.5, 6.5 - poiMedicalCoverageRatio * 4) * 10) / 10 : 4.8,
    parkingServiceScore: Math.round(Math.max(82, poiTransitCoverageRatio * 100)),
    shadeCoverageRatio: Math.round(Math.max(0.55, poiParkCoverageRatio) * 100) / 100,
    landmarkCoverageScore: landmarkCoverage.score,
    landmarkPassedCount: landmarkCoverage.count,
    bridgeDistanceKm: Math.round(bridgeDistanceKm * 100) / 100,
    bridgeSegmentCount,
    riverCrossingScore: computeRiverCrossingScore(bridgeDistanceKm, bridgeSegmentCount, landmarkCoverage.score, wuhanYangtzeBridgePassed),
    yangtzeBridgeDistanceKm: Math.round(yangtzeBridgeDistanceKm * 100) / 100,
    yangtzeBridgeNames,
    wuhanYangtzeBridgePassed
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
    const angle = turnAngle(coordinates[index - 2], coordinates[index - 1], coordinates[index]);
    if (turnPenaltyFromAngle(angle) >= 55) {
      sharpTurns += 1;
    }
  }
  return Math.round((sharpTurns / (coordinates.length - 2)) * 100) / 100;
}

function computeSharpTurnCount(coordinates: Coordinate[]): number {
  if (coordinates.length < 3) return 0;
  let count = 0;
  for (let index = 2; index < coordinates.length; index++) {
    const angle = turnAngle(coordinates[index - 2], coordinates[index - 1], coordinates[index]);
    if (turnPenaltyFromAngle(angle) >= 55) count += 1;
  }
  return count;
}

function computeHairpinTurnCount(coordinates: Coordinate[]): number {
  if (coordinates.length < 3) return 0;
  let count = 0;
  for (let index = 2; index < coordinates.length; index++) {
    const angle = turnAngle(coordinates[index - 2], coordinates[index - 1], coordinates[index]);
    if (angle >= 150) count += 1;
  }
  return count;
}

function computeTurnPenaltyScore(coordinates: Coordinate[]): number {
  if (coordinates.length < 3) return 0;
  let penalty = 0;
  for (let index = 2; index < coordinates.length; index++) {
    penalty += turnPenaltyFromAngle(turnAngle(coordinates[index - 2], coordinates[index - 1], coordinates[index]));
  }
  return Math.round(penalty / (coordinates.length - 2));
}

function computeRiverCrossingScore(
  bridgeDistanceKm: number,
  bridgeSegmentCount: number,
  landmarkScore: number,
  wuhanYangtzeBridgePassed: boolean
): number {
  const bridgeKmScore = Math.min(100, bridgeDistanceKm * 30);
  const bridgeCountScore = Math.min(100, bridgeSegmentCount * 38);
  const requiredBridgeBonus = wuhanYangtzeBridgePassed ? 26 : 0;
  return Math.round(Math.min(100, bridgeKmScore * 0.42 + bridgeCountScore * 0.28 + landmarkScore * 0.14 + requiredBridgeBonus));
}

function weightedAverage(edges: RoadEdge[], totalKm: number, value: (edge: RoadEdge) => number): number {
  if (edges.length === 0 || totalKm <= 0) return 0;
  return edges.reduce((sum, edge) => sum + value(edge) * (edge.lengthKm / totalKm), 0);
}

function computeTerrainRequirementMetrics(edges: RoadEdge[], profile: ElevationPoint[]): TerrainRequirementMetrics {
  const slopeEdges = edges.filter((edge) => typeof edge.slopeMean === "number" && !edge.isRequiredRiverBridge);
  if (slopeEdges.length === 0 && edges.some((edge) => edge.isRequiredRiverBridge)) {
    return {
      totalClimbM: 0,
      startFinishElevationDiffM: 0,
      maxSingleClimbM: 0,
      maxContinuousSteepKm: 0,
      slopes: [0]
    };
  }
  if (slopeEdges.length > 0) {
    const profileTerrain = computeTerrainRequirementMetrics([], profile);
    return {
      totalClimbM: profileTerrain.totalClimbM,
      startFinishElevationDiffM: profileTerrain.startFinishElevationDiffM,
      maxSingleClimbM: profileTerrain.maxSingleClimbM,
      maxContinuousSteepKm: profileTerrain.maxContinuousSteepKm,
      slopes: slopeEdges.map((edge) => effectiveRaceSlopePercent(edge.slopeMean ?? 0))
    };
  }

  let totalClimbM = 0;
  let maxSingleClimbM = 0;
  let currentSteepKm = 0;
  let maxSteepKm = 0;

  for (let index = 1; index < profile.length; index++) {
    const climb = profile[index].elevation - profile[index - 1].elevation;
    const segmentKm = Math.max(0, profile[index].km - profile[index - 1].km);
    if (climb > 0) {
      totalClimbM += climb;
      maxSingleClimbM = Math.max(maxSingleClimbM, climb);
    }

    if (Math.abs(profile[index].slope) > longSteepSlopePercent) {
      currentSteepKm += segmentKm;
      maxSteepKm = Math.max(maxSteepKm, currentSteepKm);
    } else {
      currentSteepKm = 0;
    }
  }

  return {
    totalClimbM,
    startFinishElevationDiffM: profile.length > 1 ? Math.abs(profile.at(-1)!.elevation - profile[0].elevation) : 0,
    maxSingleClimbM,
    maxContinuousSteepKm: maxSteepKm,
    slopes: profile.slice(1).map((point) => Math.abs(point.slope))
  };
}

function summarizeLandmarkCoverage(coordinates: Coordinate[]): { score: number; count: number } {
  if (coordinates.length < 2) return { score: 0, count: 0 };

  let weightedCoverage = 0;
  let count = 0;

  for (const landmark of wuhanLandmarkPoiLabels) {
    const minDistanceKm = distanceFromPointToPolylineKm(landmark.coordinate, coordinates);
    if (minDistanceKm > landmarkInfluenceRadiusKm) continue;

    const closeness = 1 - minDistanceKm / landmarkInfluenceRadiusKm;
    weightedCoverage += closeness * Math.max(0.7, (landmark.priority ?? 90) / 100);
    count += 1;
  }

  const maxWeightedCoverage = Math.max(1, wuhanLandmarkPoiLabels.length * 1.2);
  return {
    score: Math.round(Math.min(1, weightedCoverage / maxWeightedCoverage) * 100),
    count
  };
}

function getCoveredLandmarkIds(coordinates: Coordinate[], radiusKm: number): Set<string> {
  const covered = new Set<string>();
  if (coordinates.length < 2) return covered;

  for (const landmark of wuhanLandmarkPoiLabels) {
    if (distanceFromPointToPolylineKm(landmark.coordinate, coordinates) <= radiusKm) {
      covered.add(landmark.id);
    }
  }

  return covered;
}

function distanceFromPointToPolylineKm(point: Coordinate, coordinates: Coordinate[]): number {
  let nearestKm = Number.POSITIVE_INFINITY;
  for (let index = 0; index < coordinates.length - 1; index++) {
    nearestKm = Math.min(nearestKm, pointToSegmentDistanceKm(point, coordinates[index], coordinates[index + 1]));
  }
  return nearestKm;
}

function pointToSegmentDistanceKm(point: Coordinate, from: Coordinate, to: Coordinate): number {
  const latRef = (point[1] * Math.PI) / 180;
  const toXY = (coordinate: Coordinate) => ({
    x: coordinate[0] * 111.32 * Math.cos(latRef),
    y: coordinate[1] * 110.574
  });
  const p = toXY(point);
  const a = toXY(from);
  const b = toXY(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const denominator = dx * dx + dy * dy;
  if (denominator <= 1e-12) return haversineKm(point, from);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / denominator));
  const projection = {
    x: a.x + dx * t,
    y: a.y + dy * t
  };
  return Math.hypot(p.x - projection.x, p.y - projection.y);
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function effectiveRaceSlopePercent(slopeMean: number): number {
  return Math.min(3, Math.abs(slopeMean) * 0.22);
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

  if (preference === "river-scenic") {
    switch (level) {
      case "greenway":
        return 112;
      case "secondary":
        return 88;
      case "primary":
        return 84;
      case "tertiary":
        return 76;
      case "trunk":
        return 62;
      case "residential":
        return 50;
      default:
        return 44;
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
  if (preference === "scenic" || preference === "river-scenic") return { theme: "scenic" };
  if (preference === "main-road") return { theme: "transit-accessible" };
  return { theme: "balanced" };
}

function getEdgeLengthKm(graph: RoadGraph, edgeId: string): number {
  return graph.edges.get(edgeId)?.lengthKm ?? graph.edges.get(baseEdgeId(edgeId))?.lengthKm ?? 0;
}
