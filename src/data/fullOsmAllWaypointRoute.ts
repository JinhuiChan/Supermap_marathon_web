import { buildRoadGraphFromGeoJson } from "./roadNetworkGeoJson";
import { waypointHitRadiusKm as defaultWaypointHitRadiusKm, type WaypointRoutePlan } from "./profileRoutePlanner";
import { summarizeMarathonSuitability } from "../domain/competitionSuitability";
import { baseEdgeId, type RoadEdge, type RoadGraph } from "../domain/roadNetwork";
import { getElevation, haversineKm, turnAngle, turnPenaltyFromAngle } from "../domain/roadAttributes";
import { analyzeRouteTopology, createsForbiddenTopologyStep } from "../domain/routeTopology";
import type { Coordinate, ElevationPoint, MarathonRoute, RouteMetrics } from "../domain/routeMetrics";

interface PathSegment {
  nodeIds: string[];
  edges: RoadEdge[];
  totalKm: number;
}

interface RouteAssembly {
  coordinates: Coordinate[];
  nodeIds: string[];
  edges: RoadEdge[];
  lengthKm: number;
  controlOrder: number[];
}

interface FillerContext {
  coordinates: Coordinate[];
  nodeIds: string[];
  usedEdges: Set<string>;
}

interface PathAvoidanceContext {
  coordinates: Coordinate[];
  nodeIds: string[];
}

interface ShortestPathOptions {
  avoidance?: PathAvoidanceContext;
  extraEdgePenalties?: Map<string, number>;
}

interface FillerState {
  nodeId: string;
  lengthKm: number;
  score: number;
  coordinates: Coordinate[];
  nodeIds: string[];
  edges: RoadEdge[];
  localUsedEdges: Set<string>;
  localVisitedNodes: Set<string>;
}

export interface FullOsmAllWaypointRouteOptions {
  waypointHitRadiusKm?: number;
  onProgress?: (event: FullOsmRouteProgressEvent) => void;
}

export type FullOsmRouteProgressStage = "graph" | "snap" | "controls" | "filler" | "metrics" | "complete";

export interface FullOsmRouteProgressEvent {
  stage: FullOsmRouteProgressStage;
  percent: number;
  message: string;
  current?: number;
  total?: number;
}

export interface WaypointHitDistance {
  label: string;
  distanceM: number;
  hit: boolean;
}

const graphCache = new WeakMap<object, RoadGraph>();

export function buildFullOsmAllWaypointRoute(
  geojson: unknown,
  plan: WaypointRoutePlan,
  options: FullOsmAllWaypointRouteOptions = {}
): MarathonRoute | null {
  const graph = getCachedGraph(geojson);
  const assembly = buildAllWaypointAssembly(graph, plan);
  if (!assembly) return null;

  return buildMarathonRoute(assembly, plan, options);
}

export async function buildFullOsmAllWaypointRouteAsync(
  geojson: unknown,
  plan: WaypointRoutePlan,
  options: FullOsmAllWaypointRouteOptions = {}
): Promise<MarathonRoute | null> {
  const graph = getCachedGraph(geojson);
  await reportProgress(options, {
    stage: "graph",
    percent: 12,
    message: "Full OSM road graph is ready"
  });

  const assembly = await buildAllWaypointAssemblyAsync(graph, plan, options);
  if (!assembly) return null;

  await reportProgress(options, {
    stage: "metrics",
    percent: 92,
    message: "Computing route metrics and waypoint hits"
  });
  const route = buildMarathonRoute(assembly, plan, options);

  await reportProgress(options, {
    stage: "complete",
    percent: 100,
    message: "Route generation complete"
  });

  return route;
}

function buildMarathonRoute(
  assembly: RouteAssembly,
  plan: WaypointRoutePlan,
  options: FullOsmAllWaypointRouteOptions
): MarathonRoute {
  const roundedLengthKm = round(assembly.lengthKm, 3);
  const hitDistances = getWaypointHitDistancesM({ coordinates: assembly.coordinates }, plan, options.waypointHitRadiusKm);
  const hitCount = hitDistances.filter((item) => item.hit).length;
  const metrics = buildMetrics(assembly.coordinates, assembly.nodeIds, assembly.edges, roundedLengthKm);

  return {
    id: plan.id,
    name: plan.name,
    color: plan.color,
    lengthKm: roundedLengthKm,
    targetDistanceKm: plan.targetDistanceKm,
    closedLoop: false,
    coordinates: assembly.coordinates,
    elevationProfile: buildElevationProfile(assembly.coordinates),
    metrics: {
      ...metrics,
      landmarkCoverageScore: round((hitCount / Math.max(plan.waypoints.length, 1)) * 100, 1),
      landmarkPassedCount: hitCount
    },
    lineage: {
      source: "osm-generated",
      roadAligned: true,
      note: `Full OSM experimental all-control route; hit ${hitCount}/${plan.waypoints.length} control points within ${(options.waypointHitRadiusKm ?? defaultWaypointHitRadiusKm).toFixed(1)} km.`
    }
  };
}

function getCachedGraph(geojson: unknown): RoadGraph {
  if (!geojson || typeof geojson !== "object") return buildRoadGraphFromGeoJson(geojson);
  const cached = graphCache.get(geojson);
  if (cached) return cached;
  const graph = buildRoadGraphFromGeoJson(geojson);
  graphCache.set(geojson, graph);
  return graph;
}

async function reportProgress(
  options: FullOsmAllWaypointRouteOptions,
  event: FullOsmRouteProgressEvent
): Promise<void> {
  options.onProgress?.(event);
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
}

export function getWaypointHitDistancesM(
  route: Pick<MarathonRoute, "coordinates">,
  plan: WaypointRoutePlan,
  hitRadiusKm = defaultWaypointHitRadiusKm
): WaypointHitDistance[] {
  return plan.waypoints.map((waypoint) => {
    const distanceM = Math.round(distanceFromPointToPolylineKm(waypoint.coordinate, route.coordinates) * 1000);
    return {
      label: waypoint.label,
      distanceM,
      hit: distanceM <= hitRadiusKm * 1000
    };
  });
}

export function buildFullOsmAllWaypointRouteFeatureCollection(routes: MarathonRoute[]) {
  return {
    type: "FeatureCollection",
    features: routes.map((route) => ({
      type: "Feature",
      properties: {
        route_id: route.id,
        route_name: route.name,
        color: route.color,
        length_km: route.lengthKm,
        target_km: route.targetDistanceKm,
        routing_network: "full-osm",
        note: route.lineage?.note ?? ""
      },
      geometry: {
        type: "LineString",
        coordinates: route.coordinates
      }
    }))
  };
}

function buildAllWaypointAssembly(graph: RoadGraph, plan: WaypointRoutePlan): RouteAssembly | null {
  const snapped = plan.waypoints.map((waypoint) => ({
    coordinate: waypoint.coordinate,
    nodeId: nearestNodeId(graph, waypoint.coordinate)
  }));
  if (snapped.some((item) => item.nodeId === "")) return null;

  const remainingControls = new Set(snapped.slice(1).map((_, index) => index + 1));
  const usedEdges = new Set<string>();
  const coordinates: Coordinate[] = [];
  const nodeIds: string[] = [];
  const edges: RoadEdge[] = [];
  const controlOrder = [0];
  let currentIndex = 0;
  let currentNodeId = snapped[0].nodeId;
  let lengthKm = 0;

  appendCoordinate(coordinates, graph.nodes.get(currentNodeId)?.coordinate ?? snapped[0].coordinate);
  appendNodeId(nodeIds, currentNodeId);

  while (remainingControls.size > 0) {
    const next = bestPathToRemainingControl(
      graph,
      currentNodeId,
      [...remainingControls],
      snapped.map((item) => item.nodeId),
      usedEdges,
      coordinates,
      nodeIds,
      lengthKm,
      plan.targetDistanceKm
    );
    if (!next) return null;

    const { targetIndex, path } = next;

    appendSegment(coordinates, path);
    appendNodeIds(nodeIds, path.nodeIds.slice(1));
    edges.push(...path.edges);
    rememberUsedEdges(usedEdges, path.edges);
    lengthKm += path.totalKm;
    currentIndex = targetIndex;
    currentNodeId = snapped[currentIndex].nodeId;
    remainingControls.delete(currentIndex);
    controlOrder.push(currentIndex);
  }

  const targetKm = plan.targetDistanceKm;
  if (lengthKm < targetKm) {
    const filler = buildForwardFiller(graph, currentNodeId, targetKm - lengthKm, {
      coordinates,
      nodeIds,
      usedEdges
    });
    appendCoordinates(coordinates, filler.outCoordinates.slice(1));
    appendNodeIds(nodeIds, filler.outNodeIds.slice(1));
    edges.push(...filler.outEdges);
    lengthKm += filler.totalKm;
  }

  return { coordinates, nodeIds, edges, lengthKm, controlOrder };
}

async function buildAllWaypointAssemblyAsync(
  graph: RoadGraph,
  plan: WaypointRoutePlan,
  options: FullOsmAllWaypointRouteOptions
): Promise<RouteAssembly | null> {
  const snapped = plan.waypoints.map((waypoint) => ({
    coordinate: waypoint.coordinate,
    nodeId: nearestNodeId(graph, waypoint.coordinate)
  }));
  if (snapped.some((item) => item.nodeId === "")) return null;

  await reportProgress(options, {
    stage: "snap",
    percent: 22,
    message: `Snapped ${snapped.length} control points to the Full OSM graph`,
    current: snapped.length,
    total: snapped.length
  });

  const remainingControls = new Set(snapped.slice(1).map((_, index) => index + 1));
  const totalControls = remainingControls.size;
  const usedEdges = new Set<string>();
  const coordinates: Coordinate[] = [];
  const nodeIds: string[] = [];
  const edges: RoadEdge[] = [];
  const controlOrder = [0];
  let currentIndex = 0;
  let currentNodeId = snapped[0].nodeId;
  let lengthKm = 0;

  appendCoordinate(coordinates, graph.nodes.get(currentNodeId)?.coordinate ?? snapped[0].coordinate);
  appendNodeId(nodeIds, currentNodeId);

  while (remainingControls.size > 0) {
    const next = bestPathToRemainingControl(
      graph,
      currentNodeId,
      [...remainingControls],
      snapped.map((item) => item.nodeId),
      usedEdges,
      coordinates,
      nodeIds,
      lengthKm,
      plan.targetDistanceKm
    );
    if (!next) return null;

    const { targetIndex, path } = next;

    appendSegment(coordinates, path);
    appendNodeIds(nodeIds, path.nodeIds.slice(1));
    edges.push(...path.edges);
    rememberUsedEdges(usedEdges, path.edges);
    lengthKm += path.totalKm;
    currentIndex = targetIndex;
    currentNodeId = snapped[currentIndex].nodeId;
    remainingControls.delete(currentIndex);
    controlOrder.push(currentIndex);

    const completedControls = totalControls - remainingControls.size;
    await reportProgress(options, {
      stage: "controls",
      percent: Math.round(25 + (completedControls / Math.max(totalControls, 1)) * 45),
      message: `Connected ${completedControls}/${totalControls} control-point legs`,
      current: completedControls,
      total: totalControls
    });
  }

  const targetKm = plan.targetDistanceKm;
  if (lengthKm < targetKm) {
    await reportProgress(options, {
      stage: "filler",
      percent: 78,
      message: `Extending remaining ${(targetKm - lengthKm).toFixed(1)} km to target distance`,
      current: Math.round(lengthKm * 1000),
      total: Math.round(targetKm * 1000)
    });

    const filler = buildForwardFiller(graph, currentNodeId, targetKm - lengthKm, {
      coordinates,
      nodeIds,
      usedEdges
    });
    appendCoordinates(coordinates, filler.outCoordinates.slice(1));
    appendNodeIds(nodeIds, filler.outNodeIds.slice(1));
    edges.push(...filler.outEdges);
    lengthKm += filler.totalKm;
  } else {
    await reportProgress(options, {
      stage: "filler",
      percent: 78,
      message: "Target distance already reached after control-point routing",
      current: Math.round(lengthKm * 1000),
      total: Math.round(targetKm * 1000)
    });
  }

  return { coordinates, nodeIds, edges, lengthKm, controlOrder };
}

function nearestNodeId(graph: RoadGraph, coordinate: Coordinate): string {
  let nearest = "";
  let nearestKm = Number.POSITIVE_INFINITY;
  for (const node of graph.nodes.values()) {
    const distanceKm = haversineKm(coordinate, node.coordinate);
    if (distanceKm < nearestKm) {
      nearest = node.id;
      nearestKm = distanceKm;
    }
  }
  return nearest;
}

function bestPathToRemainingControl(
  graph: RoadGraph,
  fromNodeId: string,
  remainingControlIndexes: number[],
  snappedNodeIds: string[],
  usedEdges: Set<string>,
  routeCoordinates: Coordinate[],
  routeNodeIds: string[],
  currentLengthKm: number,
  targetLengthKm: number
): { targetIndex: number; path: PathSegment } | null {
  const baselineCandidates: Array<{ targetIndex: number; path: PathSegment; score: number; topologyPenalty: number }> = [];
  let best: { targetIndex: number; path: PathSegment; score: number } | null = null;
  for (const targetIndex of remainingControlIndexes) {
    const targetNodeIds = new Set([snappedNodeIds[targetIndex]]);
    const path =
      shortestPath(graph, fromNodeId, targetNodeIds, usedEdges, { avoidance: { coordinates: routeCoordinates, nodeIds: routeNodeIds } }) ??
      shortestPath(graph, fromNodeId, targetNodeIds, usedEdges);
    if (!path) continue;
    const overshootKm = Math.max(0, currentLengthKm + path.totalKm - targetLengthKm);
    const topologyPenalty = scoreControlPathTopology(path, routeCoordinates, routeNodeIds, usedEdges);
    baselineCandidates.push({
      targetIndex,
      path,
      topologyPenalty,
      score: path.totalKm + overshootKm * 5000
    });
  }

  for (const baseline of baselineCandidates.sort((a, b) => a.score - b.score).slice(0, 1)) {
    const targetNodeIds = new Set([snappedNodeIds[baseline.targetIndex]]);
    const candidates = baseline.topologyPenalty > 0
      ? candidatePathsToTarget(
          graph,
          fromNodeId,
          targetNodeIds,
          usedEdges,
          { coordinates: routeCoordinates, nodeIds: routeNodeIds },
          baseline.path
        )
      : [baseline.path];
    for (const path of candidates) {
      if (path.totalKm > baseline.path.totalKm + 1.5) continue;
      const overshootKm = Math.max(0, currentLengthKm + path.totalKm - targetLengthKm);
      const score = path.totalKm + overshootKm * 5000 + scoreControlPathTopology(path, routeCoordinates, routeNodeIds, usedEdges);
      if (!best || score < best.score) best = { targetIndex: baseline.targetIndex, path, score };
    }
  }
  return best ? { targetIndex: best.targetIndex, path: best.path } : null;
}

function candidatePathsToTarget(
  graph: RoadGraph,
  fromNodeId: string,
  targetNodeIds: Set<string>,
  usedEdges: Set<string>,
  avoidance: PathAvoidanceContext,
  initialPath: PathSegment
): PathSegment[] {
  const candidates: PathSegment[] = [initialPath];
  const extraEdgePenalties = new Map<string, number>();

  for (const edge of initialPath.edges) {
    const baseId = baseEdgeId(edge.id);
    extraEdgePenalties.set(baseId, (extraEdgePenalties.get(baseId) ?? 0) + 80 + edge.lengthKm * 40);
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const path =
      shortestPath(graph, fromNodeId, targetNodeIds, usedEdges, { avoidance, extraEdgePenalties }) ??
      shortestPath(graph, fromNodeId, targetNodeIds, usedEdges, { extraEdgePenalties });
    if (!path) break;

    const signature = path.edges.map((edge) => baseEdgeId(edge.id)).join("|");
    if (!candidates.some((candidate) => candidate.edges.map((edge) => baseEdgeId(edge.id)).join("|") === signature)) {
      candidates.push(path);
    }

    for (const edge of path.edges) {
      const baseId = baseEdgeId(edge.id);
      extraEdgePenalties.set(baseId, (extraEdgePenalties.get(baseId) ?? 0) + 80 + edge.lengthKm * 40);
    }
  }

  return candidates;
}

function scoreControlPathTopology(
  path: PathSegment,
  routeCoordinates: Coordinate[],
  routeNodeIds: string[],
  usedEdges: Set<string>
): number {
  const candidateCoordinates = coordinatesForPath(path, routeCoordinates.at(-1));
  const routeNodeSet = new Set(routeNodeIds);
  let penalty = countPolylineSelfIntersections(candidateCoordinates) * 600;
  const internalTopology = analyzeRouteTopology(candidateCoordinates, path.nodeIds, Math.max(path.totalKm, 0.001));
  penalty += internalTopology.parallelBacktrackCount * 650;
  penalty += internalTopology.hairpinTurnCount * 900;
  penalty += internalTopology.revisitedNodeCount * 180;
  penalty += Math.max(0, internalTopology.sharpTurnDensityPerKm - 1.5) * 220;

  for (let index = 1; index < candidateCoordinates.length; index++) {
    if (segmentIntersectsRoute(routeCoordinates, candidateCoordinates[index - 1], candidateCoordinates[index])) {
      penalty += 650;
    }
  }

  for (const nodeId of path.nodeIds.slice(1)) {
    if (routeNodeSet.has(nodeId)) penalty += 140;
  }

  for (const edge of path.edges) {
    if (usedEdges.has(baseEdgeId(edge.id))) penalty += 220 + edge.lengthKm * 80;
  }

  return penalty;
}

function shortestPath(
  graph: RoadGraph,
  fromNodeId: string,
  targetNodeIds: Set<string>,
  usedEdges: Set<string>,
  options: ShortestPathOptions = {}
): PathSegment | null {
  if (targetNodeIds.has(fromNodeId)) return { nodeIds: [fromNodeId], edges: [], totalKm: 0 };

  const distances = new Map<string, number>([[fromNodeId, 0]]);
  const previous = new Map<string, { nodeId: string; edge: RoadEdge }>();
  const queue = new MinHeap<{ nodeId: string; distanceKm: number }>((a, b) => a.distanceKm - b.distanceKm);
  queue.push({ nodeId: fromNodeId, distanceKm: 0 });
  let settledTarget = "";

  while (queue.size > 0) {
    const current = queue.pop()!;
    if (current.distanceKm !== distances.get(current.nodeId)) continue;
    if (targetNodeIds.has(current.nodeId)) {
      settledTarget = current.nodeId;
      break;
    }

    for (const edge of graph.adjacency.get(current.nodeId) ?? []) {
      if (!isRoutableEdge(edge)) continue;
      if (options.avoidance && !targetNodeIds.has(edge.toNodeId) && options.avoidance.nodeIds.includes(edge.toNodeId)) continue;
      if (options.avoidance) {
        const currentNode = graph.nodes.get(current.nodeId);
        const nextNode = graph.nodes.get(edge.toNodeId);
        const nextCoordinate = edge.coordinates?.at(-1) ?? nextNode?.coordinate;
        if (!currentNode || !nextCoordinate) continue;
        if (segmentIntersectsRoute(options.avoidance.coordinates, currentNode.coordinate, nextCoordinate)) continue;
      }
      const reusePenalty = usedEdges.has(baseEdgeId(edge.id)) ? edge.lengthKm * 5 : 0;
      const extraPenalty = options.extraEdgePenalties?.get(baseEdgeId(edge.id)) ?? 0;
      const nextDistance = current.distanceKm + edge.lengthKm + reusePenalty + roadLevelPenalty(edge) + extraPenalty;
      if (nextDistance >= (distances.get(edge.toNodeId) ?? Number.POSITIVE_INFINITY)) continue;
      distances.set(edge.toNodeId, nextDistance);
      previous.set(edge.toNodeId, { nodeId: current.nodeId, edge });
      queue.push({ nodeId: edge.toNodeId, distanceKm: nextDistance });
    }
  }

  if (!settledTarget) return null;

  const nodeIds: string[] = [settledTarget];
  const edges: RoadEdge[] = [];
  let cursor = settledTarget;
  while (cursor !== fromNodeId) {
    const step = previous.get(cursor);
    if (!step) return null;
    nodeIds.unshift(step.nodeId);
    edges.unshift(step.edge);
    cursor = step.nodeId;
  }

  return {
    nodeIds,
    edges,
    totalKm: edges.reduce((sum, edge) => sum + edge.lengthKm, 0)
  };
}

function buildForwardFiller(
  graph: RoadGraph,
  startNodeId: string,
  targetKm: number,
  context: FillerContext
): { outCoordinates: Coordinate[]; outNodeIds: string[]; outEdges: RoadEdge[]; totalKm: number } {
  const start = graph.nodes.get(startNodeId);
  if (!start || targetKm <= 0) {
    return { outCoordinates: start ? [start.coordinate] : [], outNodeIds: start ? [startNodeId] : [], outEdges: [], totalKm: 0 };
  }

  const strict = searchForwardFiller(graph, startNodeId, targetKm, context, true);
  if (strict && strict.totalKm >= targetKm * 0.999) return strict;

  const loose = searchForwardFiller(graph, startNodeId, targetKm, context, false);
  if (loose && loose.totalKm >= targetKm * 0.999) return loose;

  const best = longerFiller(strict, loose) ?? { outCoordinates: [start.coordinate], outNodeIds: [startNodeId], outEdges: [], totalKm: 0 };
  const remainingKm = targetKm - best.totalKm;
  if (remainingKm <= 0.05) return best;

  const completionStartNodeId = best.outNodeIds.at(-1)?.replace(/:partial$/, "") ?? startNodeId;
  const completionUsedEdges = new Set(context.usedEdges);
  best.outEdges.forEach((edge) => completionUsedEdges.add(baseEdgeId(edge.id)));
  const completion = buildMinimalBacktrackCompletion(graph, completionStartNodeId, remainingKm, completionUsedEdges);

  return {
    outCoordinates: best.outCoordinates.concat(completion.outCoordinates.slice(1)),
    outNodeIds: best.outNodeIds.concat(completion.outNodeIds.slice(1)),
    outEdges: best.outEdges.concat(completion.outEdges),
    totalKm: best.totalKm + completion.totalKm
  };
}

function longerFiller<T extends { totalKm: number }>(a: T | null, b: T | null): T | null {
  if (!a) return b;
  if (!b) return a;
  return a.totalKm >= b.totalKm ? a : b;
}

function searchForwardFiller(
  graph: RoadGraph,
  startNodeId: string,
  targetKm: number,
  context: FillerContext,
  strictTopology: boolean
): { outCoordinates: Coordinate[]; outNodeIds: string[]; outEdges: RoadEdge[]; totalKm: number } | null {
  const start = graph.nodes.get(startNodeId);
  if (!start) return null;

  const queue = new MinHeap<FillerState>((a, b) => {
    const aPriority = a.score + Math.abs(targetKm - a.lengthKm) * 0.08;
    const bPriority = b.score + Math.abs(targetKm - b.lengthKm) * 0.08;
    return aPriority - bPriority;
  });
  const startState: FillerState = {
    nodeId: startNodeId,
    lengthKm: 0,
    score: 0,
    coordinates: [start.coordinate],
    nodeIds: [startNodeId],
    edges: [],
    localUsedEdges: new Set<string>(),
    localVisitedNodes: new Set<string>([startNodeId])
  };
  queue.push(startState);

  const bestByNodeAndBucket = new Map<string, number>();
  let bestPartial = startState;
  let expansions = 0;
  const maxExpansions = strictTopology ? 30000 : 120000;

  while (queue.size > 0 && expansions < maxExpansions) {
    const current = queue.pop()!;
    expansions += 1;
    if (current.lengthKm > bestPartial.lengthKm) bestPartial = current;

    for (const edge of graph.adjacency.get(current.nodeId) ?? []) {
      if (!isRoutableEdge(edge)) continue;
      const currentNode = graph.nodes.get(current.nodeId);
      const nextNode = graph.nodes.get(edge.toNodeId);
      if (!currentNode || !nextNode) continue;
      const baseId = baseEdgeId(edge.id);
      const globallyUsed = context.usedEdges.has(baseId);
      const locallyUsed = current.localUsedEdges.has(baseId);
      const revisitsExistingNode = context.nodeIds.includes(edge.toNodeId);
      const revisitsLocalNode = current.localVisitedNodes.has(edge.toNodeId);
      if (strictTopology && (globallyUsed || locallyUsed || revisitsExistingNode || revisitsLocalNode)) continue;

      const nextCoordinate = edge.coordinates?.at(-1) ?? nextNode.coordinate;
      const fullCoordinates = context.coordinates.concat(current.coordinates.slice(1));
      const forbiddenStep = createsForbiddenTopologyStep(fullCoordinates, nextCoordinate);
      const crossesExistingRoute = segmentIntersectsRoute(fullCoordinates, currentNode.coordinate, nextCoordinate);
      if (strictTopology && (forbiddenStep || crossesExistingRoute)) continue;

      const nextDistance = current.lengthKm + edge.lengthKm;

      if (nextDistance >= targetKm) {
        const partialLengthKm = Math.max(0, targetKm - current.lengthKm);
        const completedCoordinates = [...current.coordinates];
        appendCoordinate(completedCoordinates, interpolateCoordinate(currentNode.coordinate, nextNode.coordinate, partialLengthKm / edge.lengthKm));
        const completedNodeIds = [...current.nodeIds, `${edge.toNodeId}:partial`];
        const completedEdges = [...current.edges, { ...edge, lengthKm: partialLengthKm }];
        return {
          outCoordinates: completedCoordinates,
          outNodeIds: completedNodeIds,
          outEdges: completedEdges,
          totalKm: targetKm
        };
      }

      const bucket = Math.floor(nextDistance * 4) / 4;
      const cacheKey = `${edge.toNodeId}:${bucket}`;
      const topologyPenalty =
        (globallyUsed ? 900 : 0) +
        (locallyUsed ? 1200 : 0) +
        (revisitsExistingNode ? 280 : 0) +
        (revisitsLocalNode ? 420 : 0) +
        (forbiddenStep ? 260 : 0) +
        (crossesExistingRoute ? 520 : 0);
      const score = current.score + edge.lengthKm + roadLevelPenalty(edge) + topologyPenalty;
      if (score >= (bestByNodeAndBucket.get(cacheKey) ?? Number.POSITIVE_INFINITY)) continue;
      bestByNodeAndBucket.set(cacheKey, score);

      const coordinates = [...current.coordinates];
      appendEdgeCoordinates(coordinates, edge);
      const nextUsedEdges = new Set(current.localUsedEdges);
      nextUsedEdges.add(baseId);
      const nextVisitedNodes = new Set(current.localVisitedNodes);
      nextVisitedNodes.add(edge.toNodeId);
      queue.push({
        nodeId: edge.toNodeId,
        lengthKm: nextDistance,
        score,
        coordinates,
        nodeIds: [...current.nodeIds, edge.toNodeId],
        edges: [...current.edges, edge],
        localUsedEdges: nextUsedEdges,
        localVisitedNodes: nextVisitedNodes
      });
    }
  }

  return bestPartial.lengthKm > 0
    ? {
        outCoordinates: bestPartial.coordinates,
        outNodeIds: bestPartial.nodeIds,
        outEdges: bestPartial.edges,
        totalKm: bestPartial.lengthKm
      }
    : null;
}

function buildMinimalBacktrackCompletion(
  graph: RoadGraph,
  startNodeId: string,
  remainingKm: number,
  usedEdges: Set<string>
): { outCoordinates: Coordinate[]; outNodeIds: string[]; outEdges: RoadEdge[]; totalKm: number } {
  const start = graph.nodes.get(startNodeId);
  if (!start || remainingKm <= 0) {
    return { outCoordinates: start ? [start.coordinate] : [], outNodeIds: start ? [startNodeId] : [], outEdges: [], totalKm: 0 };
  }

  const targetOutKm = remainingKm / 2;
  const distances = new Map<string, number>([[startNodeId, 0]]);
  const previous = new Map<string, { nodeId: string; edge: RoadEdge }>();
  const queue = new MinHeap<{ nodeId: string; distanceKm: number }>((a, b) => a.distanceKm - b.distanceKm);
  queue.push({ nodeId: startNodeId, distanceKm: 0 });
  let bestNodeId = startNodeId;

  while (queue.size > 0) {
    const current = queue.pop()!;
    if (current.distanceKm !== distances.get(current.nodeId)) continue;
    bestNodeId = current.nodeId;

    for (const edge of graph.adjacency.get(current.nodeId) ?? []) {
      if (!isRoutableEdge(edge)) continue;
      const currentNode = graph.nodes.get(current.nodeId);
      const nextNode = graph.nodes.get(edge.toNodeId);
      if (!currentNode || !nextNode) continue;
      const nextDistance = current.distanceKm + edge.lengthKm;

      if (nextDistance >= targetOutKm) {
        const reconstructed = reconstructCompletionPath(graph, previous, startNodeId, current.nodeId);
        const partialLengthKm = Math.max(0, targetOutKm - current.distanceKm);
        appendCoordinate(
          reconstructed.coordinates,
          interpolateCoordinate(currentNode.coordinate, nextNode.coordinate, partialLengthKm / edge.lengthKm)
        );
        appendNodeId(reconstructed.nodeIds, `${edge.toNodeId}:partial`);
        reconstructed.edges.push({ ...edge, lengthKm: partialLengthKm });
        return completeOutAndBack(reconstructed, remainingKm);
      }

      const reusePenalty = usedEdges.has(baseEdgeId(edge.id)) ? edge.lengthKm * 1.8 : 0;
      const queueDistance = nextDistance + reusePenalty + roadLevelPenalty(edge) * 0.25;
      if (queueDistance >= (distances.get(edge.toNodeId) ?? Number.POSITIVE_INFINITY)) continue;
      distances.set(edge.toNodeId, queueDistance);
      previous.set(edge.toNodeId, { nodeId: current.nodeId, edge });
      queue.push({ nodeId: edge.toNodeId, distanceKm: queueDistance });
    }
  }

  const reconstructed = reconstructCompletionPath(graph, previous, startNodeId, bestNodeId);
  return completeOutAndBack(reconstructed, Math.min(remainingKm, (distances.get(bestNodeId) ?? 0) * 2));
}

function reconstructCompletionPath(
  graph: RoadGraph,
  previous: Map<string, { nodeId: string; edge: RoadEdge }>,
  startNodeId: string,
  endNodeId: string
): { coordinates: Coordinate[]; nodeIds: string[]; edges: RoadEdge[] } {
  const start = graph.nodes.get(startNodeId);
  const coordinates: Coordinate[] = start ? [start.coordinate] : [];
  const nodeIds = start ? [startNodeId] : [];
  const edges: RoadEdge[] = [];
  let cursor = endNodeId;

  while (cursor !== startNodeId) {
    const step = previous.get(cursor);
    if (!step) break;
    edges.unshift(step.edge);
    nodeIds.splice(1, 0, cursor);
    cursor = step.nodeId;
  }

  for (const edge of edges) appendEdgeCoordinates(coordinates, edge);
  return { coordinates, nodeIds, edges };
}

function completeOutAndBack(
  out: { coordinates: Coordinate[]; nodeIds: string[]; edges: RoadEdge[] },
  totalKm: number
): { outCoordinates: Coordinate[]; outNodeIds: string[]; outEdges: RoadEdge[]; totalKm: number } {
  return {
    outCoordinates: out.coordinates.concat([...out.coordinates].reverse().slice(1)),
    outNodeIds: out.nodeIds.concat([...out.nodeIds].reverse().slice(1)),
    outEdges: out.edges.concat(out.edges.map(reverseEdge).reverse()),
    totalKm
  };
}

function buildMetrics(
  coordinates: Coordinate[],
  nodeIds: string[],
  edges: RoadEdge[],
  totalKm: number
): RouteMetrics {
  const elevationProfile = buildElevationProfile(coordinates);
  const climb = computeClimb(elevationProfile);
  const turns = computeTurnMetrics(coordinates, totalKm);
  const suitability = summarizeMarathonSuitability(coordinates, edges, totalKm);
  const topology = analyzeRouteTopology(coordinates, nodeIds, totalKm);
  const bridgeEdges = edges.filter((edge) => edge.isBridge);
  const bridgeDistanceKm = bridgeEdges.reduce((sum, edge) => sum + edge.lengthKm, 0);
  const narrowKm = edges.filter((edge) => (edge.roadWidthM ?? 6) < 6).reduce((sum, edge) => sum + edge.lengthKm, 0);

  return {
    totalClimbM: Math.round(climb.totalClimbM),
    startFinishElevationDiffM: Math.round((elevationProfile.at(-1)?.elevation ?? 0) - (elevationProfile[0]?.elevation ?? 0)),
    netElevationDropM: Math.max(0, Math.round((elevationProfile[0]?.elevation ?? 0) - (elevationProfile.at(-1)?.elevation ?? 0))),
    maxSingleClimbM: Math.round(climb.maxSingleClimbM),
    maxContinuousSteepKm: round(climb.maxContinuousSteepKm, 2),
    terrainCoverageRatio: 1,
    maxContinuityGapM: 0,
    unsuitableEdgeCount: edges.filter((edge) => !edge.competitionSuitable).length,
    roadAlignedRatio: 1,
    avgSlopePercent: round(climb.avgSlopePercent, 2),
    maxSlopePercent: round(climb.maxSlopePercent, 2),
    longSteepRatio: round(climb.longSteepRatio, 3),
    sharpTurnRatio: round(turns.sharpTurnRatio, 3),
    turnPenaltyScore: Math.round(turns.turnPenaltyScore),
    narrowRoadRatio: round(narrowKm / Math.max(totalKm, 0.001), 3),
    competitionReadinessScore: suitability.score,
    mainRoadRatio: suitability.mainRoadRatio,
    unsuitableRoadRatio: suitability.unsuitableRoadRatio,
    repeatedRoadRatio: suitability.repeatedRoadRatio,
    selfIntersectionCount: suitability.selfIntersectionCount,
    localBacktrackCount: suitability.localBacktrackCount,
    localKnotCount: suitability.localKnotCount,
    revisitedNodeCount: topology.revisitedNodeCount,
    parallelBacktrackCount: topology.parallelBacktrackCount,
    hairpinTurnCount: topology.hairpinTurnCount,
    sharpTurnDensityPerKm: topology.sharpTurnDensityPerKm,
    supplyCoverageRatio: 0.78,
    medicalAvgIntervalKm: 4.5,
    parkingServiceScore: 70,
    shadeCoverageRatio: 0.46,
    bridgeDistanceKm: round(bridgeDistanceKm, 2),
    bridgeSegmentCount: bridgeEdges.length,
    riverCrossingScore: Math.min(100, Math.round(bridgeDistanceKm * 30 + bridgeEdges.length * 10)),
    yangtzeBridgeDistanceKm: round(bridgeDistanceKm, 2),
    yangtzeBridgeNames: [...new Set(bridgeEdges.map((edge) => edge.roadName).filter(Boolean) as string[])],
    wuhanYangtzeBridgePassed: bridgeEdges.some((edge) => /武汉长江大桥|姝︽眽闀挎睙澶фˉ/.test(edge.roadName ?? ""))
  };
}

function buildElevationProfile(coordinates: Coordinate[]): ElevationPoint[] {
  let km = 0;
  return coordinates.map((coordinate, index) => {
    if (index > 0) km += haversineKm(coordinates[index - 1], coordinate);
    const previousElevation = index > 0 ? getElevation(coordinates[index - 1]) : getElevation(coordinate);
    const elevation = getElevation(coordinate);
    const segmentKm = index > 0 ? haversineKm(coordinates[index - 1], coordinate) : 0;
    const slope = segmentKm <= 0 ? 0 : ((elevation - previousElevation) / (segmentKm * 1000)) * 100;
    return {
      km: round(km, 2),
      elevation,
      slope: round(slope, 2)
    };
  });
}

function computeClimb(profile: ElevationPoint[]) {
  let totalClimbM = 0;
  let maxSingleClimbM = 0;
  let maxSlopePercent = 0;
  let steepKm = 0;
  let currentSteepKm = 0;
  let maxContinuousSteepKm = 0;

  for (let index = 1; index < profile.length; index++) {
    const gain = profile[index].elevation - profile[index - 1].elevation;
    const segmentKm = Math.max(0, profile[index].km - profile[index - 1].km);
    if (gain > 0) {
      totalClimbM += gain;
      maxSingleClimbM = Math.max(maxSingleClimbM, gain);
    }
    const absSlope = Math.abs(profile[index].slope);
    maxSlopePercent = Math.max(maxSlopePercent, absSlope);
    if (absSlope >= 3) {
      steepKm += segmentKm;
      currentSteepKm += segmentKm;
      maxContinuousSteepKm = Math.max(maxContinuousSteepKm, currentSteepKm);
    } else {
      currentSteepKm = 0;
    }
  }

  const totalKm = Math.max(profile.at(-1)?.km ?? 0, 0.001);
  return {
    totalClimbM,
    maxSingleClimbM,
    maxContinuousSteepKm,
    avgSlopePercent: totalClimbM / (totalKm * 1000) * 100,
    maxSlopePercent,
    longSteepRatio: steepKm / totalKm
  };
}

function computeTurnMetrics(coordinates: Coordinate[], totalKm: number) {
  let sharpTurnCount = 0;
  let turnPenaltyScore = 0;
  for (let index = 1; index < coordinates.length - 1; index++) {
    const angle = turnAngle(coordinates[index - 1], coordinates[index], coordinates[index + 1]);
    if (angle >= 75) sharpTurnCount += 1;
    turnPenaltyScore += turnPenaltyFromAngle(angle);
  }
  return {
    sharpTurnRatio: sharpTurnCount / Math.max(coordinates.length - 2, 1),
    turnPenaltyScore: Math.min(100, turnPenaltyScore / Math.max(totalKm, 1))
  };
}

function isRoutableEdge(edge: RoadEdge): boolean {
  return (
    edge.roadLevel !== "track" &&
    edge.isTunnel !== true &&
    edge.isElevated !== true &&
    edge.surfaceSuitable !== false
  );
}

function roadLevelPenalty(edge: RoadEdge): number {
  if (edge.roadLevel === "trunk" || edge.roadLevel === "primary") return 0;
  if (edge.roadLevel === "secondary" || edge.roadLevel === "tertiary") return edge.lengthKm * 0.04;
  if (edge.roadLevel === "greenway") return edge.lengthKm * 0.08;
  return edge.lengthKm * 0.16;
}

function appendSegment(coordinates: Coordinate[], segment: PathSegment): void {
  for (const edge of segment.edges) appendEdgeCoordinates(coordinates, edge);
}

function coordinatesForPath(path: PathSegment, startCoordinate: Coordinate | undefined): Coordinate[] {
  const coordinates: Coordinate[] = [];
  if (startCoordinate) appendCoordinate(coordinates, startCoordinate);
  for (const edge of path.edges) appendEdgeCoordinates(coordinates, edge);
  return coordinates;
}

function appendEdgeCoordinates(coordinates: Coordinate[], edge: RoadEdge): void {
  if (edge.coordinates?.length) {
    appendCoordinates(coordinates, edge.coordinates.slice(sameCoordinate(coordinates.at(-1), edge.coordinates[0]) ? 1 : 0));
    return;
  }
  appendCoordinate(coordinates, edge.coordinates?.at(-1) ?? coordinates.at(-1)!);
}

function appendCoordinates(target: Coordinate[], coordinates: Coordinate[]): void {
  for (const coordinate of coordinates) appendCoordinate(target, coordinate);
}

function appendCoordinate(target: Coordinate[], coordinate: Coordinate): void {
  if (target.length === 0 || !sameCoordinate(target.at(-1), coordinate)) {
    target.push(coordinate);
  }
}

function appendNodeIds(target: string[], nodeIds: string[]): void {
  for (const nodeId of nodeIds) appendNodeId(target, nodeId);
}

function appendNodeId(target: string[], nodeId: string): void {
  if (target.at(-1) !== nodeId) target.push(nodeId);
}

function sameCoordinate(a: Coordinate | undefined, b: Coordinate | undefined): boolean {
  return Boolean(a && b && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9);
}

function countPolylineSelfIntersections(coordinates: Coordinate[]): number {
  let count = 0;
  for (let first = 0; first < coordinates.length - 1; first++) {
    for (let second = first + 2; second < coordinates.length - 1; second++) {
      if (segmentsShareEndpoint(coordinates[first], coordinates[first + 1], coordinates[second], coordinates[second + 1])) {
        continue;
      }
      if (segmentsIntersect(coordinates[first], coordinates[first + 1], coordinates[second], coordinates[second + 1])) {
        count += 1;
      }
    }
  }
  return count;
}

function segmentIntersectsRoute(routeCoordinates: Coordinate[], from: Coordinate, to: Coordinate): boolean {
  if (routeCoordinates.length < 3) return false;
  for (let index = 0; index < routeCoordinates.length - 1; index++) {
    const a = routeCoordinates[index];
    const b = routeCoordinates[index + 1];
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

function rememberUsedEdges(usedEdges: Set<string>, edges: RoadEdge[]): void {
  edges.forEach((edge) => usedEdges.add(baseEdgeId(edge.id)));
}

function reverseEdge(edge: RoadEdge): RoadEdge {
  return {
    ...edge,
    id: edge.id.endsWith("_rev") ? edge.id.slice(0, -4) : `${edge.id}_rev`,
    fromNodeId: edge.toNodeId,
    toNodeId: edge.fromNodeId,
    coordinates: edge.coordinates ? [...edge.coordinates].reverse() : undefined
  };
}

function interpolateCoordinate(from: Coordinate, to: Coordinate, ratio: number): Coordinate {
  const clamped = Math.max(0, Math.min(1, ratio));
  return [
    Number((from[0] + (to[0] - from[0]) * clamped).toFixed(6)),
    Number((from[1] + (to[1] - from[1]) * clamped).toFixed(6))
  ];
}

function distanceFromPointToPolylineKm(point: Coordinate, coordinates: Coordinate[]): number {
  let nearestKm = Number.POSITIVE_INFINITY;
  for (let index = 1; index < coordinates.length; index++) {
    nearestKm = Math.min(nearestKm, pointToSegmentDistanceKm(point, coordinates[index - 1], coordinates[index]));
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
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

class MinHeap<T> {
  private items: T[] = [];
  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const first = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return first;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.items[index], this.items[parent]) >= 0) break;
      [this.items[index], this.items[parent]] = [this.items[parent], this.items[index]];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.items.length && this.compare(this.items[left], this.items[smallest]) < 0) smallest = left;
      if (right < this.items.length && this.compare(this.items[right], this.items[smallest]) < 0) smallest = right;
      if (smallest === index) break;
      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }
  }
}
