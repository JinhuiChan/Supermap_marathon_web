import { computePoiAttractiveness, getElevation, haversineKm, turnAngle } from "../domain/roadAttributes";
import { summarizeMarathonSuitability } from "../domain/competitionSuitability";
import type { RoadEdge, RoadGraph, RoadLevel } from "../domain/roadNetwork";
import type { PoiPreferences } from "../domain/poiTypes";
import type { Coordinate, ElevationPoint, MarathonRoute, RouteMetrics } from "../domain/routeMetrics";
import { generateRoutes } from "../domain/routeGenerator";
import { pathToMarathonRoute } from "../domain/routeReconstruct";
import type { RouteConstraints } from "../domain/routeConstraints";
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
  endPoint?: Coordinate;
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

function filterGeoJsonByRouteEnvelope(geojson: unknown, options: OSMCandidateOptions | OSMRouteOptions): unknown {
  if (!isFeatureCollection(geojson)) return geojson;

  const points = [options.startPoint, "endPoint" in options ? options.endPoint : undefined]
    .filter((point): point is Coordinate => Boolean(point));
  const marginDegrees = Math.max(0.04, Math.min(0.18, options.targetDistanceKm / 100));
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

  return candidatePaths.map((path, index) => ({
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
  }));
}

function buildFallbackReviewPaths(graph: RoadGraph, constraints: RouteConstraints) {
  const connector = buildShortestConnectorPath(graph, constraints)
    .filter((path) => path.totalLengthKm > 0.5)
    .map((path) => extendPathTowardTarget(graph, path, constraints.targetDistanceKm));
  if (connector.length > 0) return connector;
  const bridge = buildBridgeReviewPath(graph, constraints);
  if (bridge.length > 0) return bridge;
  return buildReachableReviewPath(graph, constraints);
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
  const startNodeId = findNearestNodeId(graph, constraints.startPoint);
  const endNodeId = findNearestNodeId(graph, constraints.endPoint);
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

function buildBridgeReviewPath(graph: RoadGraph, constraints: RouteConstraints) {
  const startNodeId = findNearestNodeId(graph, constraints.startPoint);
  const endNodeId = findNearestNodeId(graph, constraints.endPoint);
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

  for (let cycle = 0; cycle < 80 && totalLengthKm < targetKm * 0.96; cycle++) {
    const remainingKm = targetKm - totalLengthKm;
    const outbound = buildOutboundWalk(graph, startNodeId, Math.max(0.25, remainingKm / 2), usedBaseIds);
    if (outbound.steps.length === 0) break;
    if (totalLengthKm > 0 && totalLengthKm + outbound.totalLengthKm * 2 > targetKm * 1.05) break;

    for (const step of outbound.steps) {
      edgeIds.push(step.edgeId);
      nodeIds.push(step.toNodeId);
      totalLengthKm += step.lengthKm;
    }
    for (let index = outbound.steps.length - 1; index >= 0; index--) {
      const step = outbound.steps[index];
      edgeIds.push(reverseEdgeId(step.edgeId));
      nodeIds.push(step.fromNodeId);
      totalLengthKm += step.lengthKm;
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
    .sort((a, b) => {
      const aBaseId = baseEdgeId(a.id);
      const bBaseId = baseEdgeId(b.id);
      const aImmediateBacktrack = aBaseId === previousBaseId ? 1 : 0;
      const bImmediateBacktrack = bBaseId === previousBaseId ? 1 : 0;
      const aReuse = usedBaseIds.has(aBaseId) ? 1 : 0;
      const bReuse = usedBaseIds.has(bBaseId) ? 1 : 0;
      return (
        aImmediateBacktrack - bImmediateBacktrack ||
        aReuse - bReuse ||
        roadLevelScore(b.roadLevel, "balanced") - roadLevelScore(a.roadLevel, "balanced") ||
        b.lengthKm - a.lengthKm ||
        a.id.localeCompare(b.id)
      );
    })[0] ?? null;
}

function reverseEdgeId(edgeId: string): string {
  return edgeId.endsWith("_rev") ? baseEdgeId(edgeId) : `${edgeId}_rev`;
}

function buildReachableReviewPath(graph: RoadGraph, constraints: RouteConstraints) {
  const startNodeId = findNearestNodeId(graph, constraints.startPoint);
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
      note: `从本地 OSM 道路网络生成的 ${options.name}，用于验证真实路网候选方案`
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

function getEdgeLengthKm(graph: RoadGraph, edgeId: string): number {
  return graph.edges.get(edgeId)?.lengthKm ?? graph.edges.get(baseEdgeId(edgeId))?.lengthKm ?? 0;
}
