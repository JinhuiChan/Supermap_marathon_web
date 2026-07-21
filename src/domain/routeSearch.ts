import { haversineKm } from "./roadAttributes";
import { isFullMarathonRoadEdge, type RoadEdge, type RoadGraph } from "./roadNetwork";
import type { Coordinate } from "./routeMetrics";
import { marathonQualityThresholds } from "./routeQuality";
import { createsForbiddenTopologyStep } from "./routeTopology";

export type MarathonSearchObjective = "race-fast" | "operations" | "city-experience";

export interface MarathonSearchRequest {
  startPoint: Coordinate;
  endPoint?: Coordinate;
  targetDistanceKm?: number;
  waypointGuidance?: MarathonWaypointGuidance;
  objective: MarathonSearchObjective;
  maxRoutes?: number;
  maxExpandedStates?: number;
}

export interface MarathonWaypointGuidance {
  points: Coordinate[];
  hitRadiusKm?: number;
  influenceRadiusKm?: number;
  minHits?: number;
}

export interface SearchedPath {
  nodeIds: string[];
  edgeIds: string[];
  physicalEdgeIds: string[];
  totalLengthKm: number;
  terminalEdgeFraction?: number;
  waypointHitCount?: number;
}

export type MarathonSearchResult =
  | { ok: true; routes: SearchedPath[]; expandedStates: number }
  | {
      ok: false;
      code: "snap-distance" | "no-compliant-route";
      message: string;
      expandedStates: number;
      diagnostics?: { maxReachedKm: number; maxReachedNodeId: string };
    };

interface SearchState extends SearchedPath {
  currentNodeId: string;
  usedPhysicalEdges: Set<string>;
  visitedNodeIds: Set<string>;
  coordinates: Coordinate[];
  objectiveScore: number;
  waypointHitMask: number;
  waypointHitCount: number;
  nextWaypointDistanceKm: number;
}

const DEFAULT_MAX_EXPANDED_STATES = 60_000;
const DEFAULT_MAX_ROUTES = 3;
const BEAM_WIDTH = 140;
const MAX_SNAP_DISTANCE_KM = 1.5;

export function searchMarathonRoutes(graph: RoadGraph, request: MarathonSearchRequest): MarathonSearchResult {
  const hasFixedFinish = Boolean(request.endPoint);
  const distanceWindow = getSearchDistanceWindow(request.targetDistanceKm);
  const waypointGuidance = normalizeWaypointGuidance(request.waypointGuidance);
  const componentCapacityKm = hasFixedFinish ? undefined : computeEligibleComponentCapacityKm(graph);
  const start = snapToSuitableNode(
    graph,
    request.startPoint,
    componentCapacityKm,
    hasFixedFinish ? 0 : distanceWindow.minDistanceKm
  );
  const end = request.endPoint ? snapToSuitableNode(graph, request.endPoint) : start;
  const startTooFar = hasFixedFinish && (start?.distanceKm ?? Number.POSITIVE_INFINITY) > MAX_SNAP_DISTANCE_KM;
  const endTooFar = hasFixedFinish && (end?.distanceKm ?? Number.POSITIVE_INFINITY) > MAX_SNAP_DISTANCE_KM;
  if (!start || !end || startTooFar || endTooFar) {
    return failure("snap-distance", "起点或终点距离可比赛道路过远", 0);
  }

  const lowerBounds = hasFixedFinish ? shortestDistancesTo(graph, end.nodeId) : new Map<string, number>();
  const initialCoordinate = graph.nodes.get(start.nodeId)?.coordinate;
  if (!initialCoordinate) return failure("snap-distance", "起点无法吸附到路网节点", 0);

  const initialHits = initialWaypointHits(waypointGuidance, initialCoordinate);
  const initial: SearchState = {
    currentNodeId: start.nodeId,
    nodeIds: [start.nodeId],
    edgeIds: [],
    physicalEdgeIds: [],
    usedPhysicalEdges: new Set(),
    visitedNodeIds: new Set([start.nodeId]),
    coordinates: [initialCoordinate],
    totalLengthKm: 0,
    objectiveScore: 0,
    waypointHitMask: initialHits.mask,
    waypointHitCount: initialHits.count,
    nextWaypointDistanceKm: distanceToNearestUnhitWaypoint(waypointGuidance, initialHits.mask, initialCoordinate)
  };

  const maxExpandedStates = request.maxExpandedStates ?? DEFAULT_MAX_EXPANDED_STATES;
  const maxRoutes = Math.max(1, Math.min(5, request.maxRoutes ?? DEFAULT_MAX_ROUTES));
  const routes: SearchedPath[] = [];
  const routeKeys = new Set<string>();
  let beam: SearchState[] = [initial];
  let expandedStates = 0;
  let maxReachedKm = 0;
  let maxReachedNodeId = start.nodeId;

  while (beam.length > 0 && expandedStates < maxExpandedStates && routes.length < maxRoutes) {
    const nextStates: SearchState[] = [];

    for (const state of beam) {
      const outgoing = [...(graph.adjacency.get(state.currentNodeId) ?? [])]
        .sort((a, b) => a.id.localeCompare(b.id));

      for (const edge of outgoing) {
        if (expandedStates >= maxExpandedStates) break;
        expandedStates += 1;
        const physicalEdgeId = getPhysicalEdgeId(edge);
        if (state.usedPhysicalEdges.has(physicalEdgeId) || !edgeIsEligible(edge)) continue;

        const nextNodeId = edge.toNodeId;
        const nextLengthKm = state.totalLengthKm + edge.lengthKm;
        if (nextLengthKm > maxReachedKm) {
          maxReachedKm = nextLengthKm;
          maxReachedNodeId = nextNodeId;
        }
        const crossesDynamicFinish = !hasFixedFinish &&
          state.totalLengthKm < distanceWindow.minDistanceKm &&
          nextLengthKm >= distanceWindow.minDistanceKm;
        const terminalEdgeFraction = crossesDynamicFinish
          ? (distanceWindow.minDistanceKm - state.totalLengthKm) / edge.lengthKm
          : undefined;
        if (!crossesDynamicFinish && nextLengthKm > distanceWindow.maxDistanceKm) continue;
        const fullNextCoordinate = graph.nodes.get(nextNodeId)?.coordinate;
        const edgeForValidation = terminalEdgeFraction === undefined
          ? edge
          : { ...edge, coordinates: clipCoordinatesByFraction(edge.coordinates ?? [], terminalEdgeFraction) };
        const nextCoordinate = terminalEdgeFraction === undefined
          ? fullNextCoordinate
          : edgeForValidation.coordinates?.at(-1);
        const closesAtFinish = hasFixedFinish && nextNodeId === end.nodeId;
        if (state.visitedNodeIds.has(nextNodeId) && !closesAtFinish) continue;
        const nextCoordinates = nextCoordinate
          ? appendAndValidateEdgeGeometry(state.coordinates, edgeForValidation, nextCoordinate, closesAtFinish)
          : null;
        if (
          !nextCoordinate ||
          !nextCoordinates
        ) continue;
        const waypointUpdate = advanceWaypointProgress(
          waypointGuidance,
          state.waypointHitMask,
          state.waypointHitCount,
          edgeForValidation.coordinates?.length ? edgeForValidation.coordinates : [state.coordinates.at(-1)!, nextCoordinate]
        );

        if (crossesDynamicFinish && terminalEdgeFraction !== undefined) {
          if (!hasMinimumWaypointHits(waypointGuidance, waypointUpdate.count)) continue;
          const completed = toSearchedPath(
            state,
            edge,
            physicalEdgeId,
            distanceWindow.minDistanceKm,
            terminalEdgeFraction,
            waypointUpdate.count
          );
          const key = `${completed.physicalEdgeIds.join("|")}|${terminalEdgeFraction.toFixed(6)}`;
          if (!routeKeys.has(key)) {
            routeKeys.add(key);
            routes.push(completed);
          }
          continue;
        }

        const finishesDynamically = !hasFixedFinish &&
          nextLengthKm >= distanceWindow.minDistanceKm &&
          nextLengthKm <= distanceWindow.maxDistanceKm;
        if ((hasFixedFinish && nextNodeId === end.nodeId) || finishesDynamically) {
          if (nextLengthKm < distanceWindow.minDistanceKm) continue;
          if (!hasMinimumWaypointHits(waypointGuidance, waypointUpdate.count)) continue;
          const completed = toSearchedPath(state, edge, physicalEdgeId, nextLengthKm, undefined, waypointUpdate.count);
          const key = completed.physicalEdgeIds.join("|");
          if (!routeKeys.has(key)) {
            routeKeys.add(key);
            routes.push(completed);
          }
          continue;
        }

        const lowerBoundKm = hasFixedFinish ? lowerBounds.get(nextNodeId) : 0;
        if (lowerBoundKm === undefined) continue;
        if (nextLengthKm + lowerBoundKm > distanceWindow.maxDistanceKm) continue;

        const usedPhysicalEdges = new Set(state.usedPhysicalEdges);
        usedPhysicalEdges.add(physicalEdgeId);
        const visitedNodeIds = new Set(state.visitedNodeIds);
        visitedNodeIds.add(nextNodeId);
        nextStates.push({
          currentNodeId: nextNodeId,
          nodeIds: [...state.nodeIds, nextNodeId],
          edgeIds: [...state.edgeIds, edge.id],
          physicalEdgeIds: [...state.physicalEdgeIds, physicalEdgeId],
          usedPhysicalEdges,
          visitedNodeIds,
          coordinates: nextCoordinates,
          totalLengthKm: nextLengthKm,
          objectiveScore: state.objectiveScore + objectiveEdgeScore(edge, request.objective) + waypointUpdate.score,
          waypointHitMask: waypointUpdate.mask,
          waypointHitCount: waypointUpdate.count,
          nextWaypointDistanceKm: distanceToNearestUnhitWaypoint(waypointGuidance, waypointUpdate.mask, nextCoordinate)
        });
      }
    }

    beam = selectBeam(nextStates, lowerBounds, hasFixedFinish, distanceWindow, Boolean(waypointGuidance));
  }

  if (routes.length === 0) {
    return failure(
      "no-compliant-route",
      `可用道路网络无法在硬约束内形成 ${distanceWindow.minDistanceKm} km 简单路线`,
      expandedStates,
      { maxReachedKm: Math.round(maxReachedKm * 1000) / 1000, maxReachedNodeId }
    );
  }

  return {
    ok: true,
    routes: routes
      .sort((a, b) =>
        (b.waypointHitCount ?? 0) - (a.waypointHitCount ?? 0) ||
        Math.abs(a.totalLengthKm - distanceWindow.midpointKm) - Math.abs(b.totalLengthKm - distanceWindow.midpointKm) ||
        a.edgeIds.join("|").localeCompare(b.edgeIds.join("|"))
      )
      .slice(0, maxRoutes),
    expandedStates
  };
}

function appendAndValidateEdgeGeometry(
  existing: Coordinate[],
  edge: RoadEdge,
  fallbackEnd: Coordinate,
  closesAtFinish: boolean
): Coordinate[] | null {
  const raw = edge.coordinates?.length ? edge.coordinates : [existing.at(-1)!, fallbackEnd];
  const additions = sameCoordinate(raw[0], existing.at(-1)!) ? raw.slice(1) : raw;
  const combined = [...existing];

  for (const coordinate of additions) {
    const closesOnThisCoordinate = closesAtFinish && sameCoordinate(coordinate, fallbackEnd);
    if (
      revisitsExistingCoordinate(combined, coordinate, closesOnThisCoordinate) ||
      createsForbiddenTopologyStep(combined, coordinate) ||
      createsSelfIntersection(combined, coordinate, closesOnThisCoordinate) ||
      createsLocalKnot(combined, coordinate, closesOnThisCoordinate)
    ) return null;
    if (!sameCoordinate(combined.at(-1)!, coordinate)) combined.push(coordinate);
  }

  return combined;
}

function revisitsExistingCoordinate(
  coordinates: Coordinate[],
  next: Coordinate,
  closesAtFinish: boolean
): boolean {
  const lastIndex = coordinates.length - 1;
  for (let index = 0; index < lastIndex; index++) {
    if (!sameCoordinate(coordinates[index], next)) continue;
    if (closesAtFinish && index === 0) return false;
    return true;
  }
  return false;
}

function toSearchedPath(
  state: SearchState,
  edge: RoadEdge,
  physicalEdgeId: string,
  totalLengthKm: number,
  terminalEdgeFraction?: number,
  waypointHitCount = state.waypointHitCount
): SearchedPath {
  return {
    nodeIds: [...state.nodeIds, edge.toNodeId],
    edgeIds: [...state.edgeIds, edge.id],
    physicalEdgeIds: [...state.physicalEdgeIds, physicalEdgeId],
    totalLengthKm: Math.round(totalLengthKm * 1000) / 1000,
    waypointHitCount,
    ...(terminalEdgeFraction === undefined ? {} : { terminalEdgeFraction })
  };
}

function clipCoordinatesByFraction(coordinates: Coordinate[], fraction: number): Coordinate[] {
  if (coordinates.length < 2 || fraction >= 1) return [...coordinates];
  if (fraction <= 0) return coordinates.length ? [coordinates[0]] : [];
  const segmentLengths = coordinates.slice(1).map((coordinate, index) =>
    haversineKm(coordinates[index], coordinate)
  );
  const totalKm = segmentLengths.reduce((sum, length) => sum + length, 0);
  const targetKm = totalKm * fraction;
  const clipped: Coordinate[] = [coordinates[0]];
  let walkedKm = 0;

  for (let index = 0; index < segmentLengths.length; index++) {
    const segmentKm = segmentLengths[index];
    if (walkedKm + segmentKm < targetKm) {
      clipped.push(coordinates[index + 1]);
      walkedKm += segmentKm;
      continue;
    }
    const localFraction = segmentKm <= 0 ? 0 : (targetKm - walkedKm) / segmentKm;
    const from = coordinates[index];
    const to = coordinates[index + 1];
    clipped.push([
      from[0] + (to[0] - from[0]) * localFraction,
      from[1] + (to[1] - from[1]) * localFraction
    ]);
    break;
  }

  return clipped;
}

function selectBeam(
  states: SearchState[],
  lowerBounds: Map<string, number>,
  hasFixedFinish: boolean,
  distanceWindow: { midpointKm: number },
  hasWaypointGuidance: boolean
): SearchState[] {
  const midpointKm = distanceWindow.midpointKm;
  const unique = new Map<string, SearchState>();
  for (const state of states) {
    const key = `${state.currentNodeId}|${Math.floor(state.totalLengthKm * 10)}|${state.waypointHitMask}|${state.physicalEdgeIds.at(-1)}`;
    const existing = unique.get(key);
    if (!existing || compareState(state, existing, lowerBounds, midpointKm, hasFixedFinish, hasWaypointGuidance) < 0) unique.set(key, state);
  }
  const candidates = [...unique.values()];
  if (!hasWaypointGuidance) {
    return candidates
      .sort((a, b) => compareState(a, b, lowerBounds, midpointKm, hasFixedFinish, false))
      .slice(0, BEAM_WIDTH);
  }

  const guidedWidth = Math.round(BEAM_WIDTH * 0.65);
  const qualityWidth = BEAM_WIDTH - guidedWidth;
  const selected = new Map<string, SearchState>();
  const addSelected = (state: SearchState) => {
    selected.set(`${state.currentNodeId}|${state.physicalEdgeIds.join("|")}`, state);
  };

  candidates
    .sort((a, b) => compareState(a, b, lowerBounds, midpointKm, hasFixedFinish, true))
    .slice(0, guidedWidth)
    .forEach(addSelected);
  candidates
    .sort((a, b) => compareState(a, b, lowerBounds, midpointKm, hasFixedFinish, false))
    .slice(0, qualityWidth)
    .forEach(addSelected);

  return [...selected.values()]
    .sort((a, b) => compareState(a, b, lowerBounds, midpointKm, hasFixedFinish, true))
    .slice(0, BEAM_WIDTH);
}

function compareState(
  a: SearchState,
  b: SearchState,
  lowerBounds: Map<string, number>,
  midpointKm: number,
  hasFixedFinish: boolean,
  hasWaypointGuidance: boolean
): number {
  const aProjected = a.totalLengthKm + (hasFixedFinish ? lowerBounds.get(a.currentNodeId) ?? 1_000 : 0);
  const bProjected = b.totalLengthKm + (hasFixedFinish ? lowerBounds.get(b.currentNodeId) ?? 1_000 : 0);
  const aQualityPerKm = a.objectiveScore / Math.max(a.totalLengthKm, 0.05);
  const bQualityPerKm = b.objectiveScore / Math.max(b.totalLengthKm, 0.05);
  return (
    (hasWaypointGuidance ? b.waypointHitCount - a.waypointHitCount : 0) ||
    (hasWaypointGuidance ? a.nextWaypointDistanceKm - b.nextWaypointDistanceKm : 0) ||
    (!hasFixedFinish ? bQualityPerKm - aQualityPerKm : 0) ||
    Math.abs(aProjected - midpointKm) - Math.abs(bProjected - midpointKm) ||
    b.objectiveScore - a.objectiveScore ||
    b.totalLengthKm - a.totalLengthKm ||
    a.edgeIds.join("|").localeCompare(b.edgeIds.join("|"))
  );
}

export function objectiveEdgeScore(edge: RoadEdge, objective: MarathonSearchObjective): number {
  const width = edge.roadWidthM ?? 6;
  const suitability = edge.suitabilityScore ?? 50;
  const slopePenalty = calibratedRaceGradePercent(edge.slopeMean ?? 0) * 8;
  if (objective === "race-fast") {
    return (width * 3 + suitability * 0.2 - slopePenalty) * edge.lengthKm - edge.baselineCost;
  }
  const poi = edge.poiScores;
  if (objective === "operations") {
    return (suitability * 0.25 + ((poi?.medical ?? 0) + (poi?.supply ?? 0) + (poi?.transit ?? 0)) * 18) * edge.lengthKm;
  }
  return (suitability * 0.18 + ((poi?.scenic ?? 0) + (poi?.park ?? 0)) * 24 + (edge.isBridge ? 8 : 0)) * edge.lengthKm;
}

function edgeIsEligible(edge: RoadEdge): boolean {
  return (
    isFullMarathonRoadEdge(edge) &&
    edge.surfaceSuitable !== false &&
    (edge.terrainMeasured === true || typeof edge.slopeMean === "number") &&
    calibratedRaceGradePercent(edge.slopeMean ?? Number.POSITIVE_INFINITY) <= marathonQualityThresholds.maxAbsGradePercent
  );
}

function getSearchDistanceWindow(targetDistanceKm?: number): { minDistanceKm: number; maxDistanceKm: number; midpointKm: number } {
  if (!targetDistanceKm || Math.abs(targetDistanceKm - marathonQualityThresholds.minDistanceKm) <= 0.25) {
    const minDistanceKm = marathonQualityThresholds.minDistanceKm;
    const maxDistanceKm = marathonQualityThresholds.maxDistanceKm;
    return {
      minDistanceKm,
      maxDistanceKm,
      midpointKm: (minDistanceKm + maxDistanceKm) / 2
    };
  }

  const minDistanceKm = targetDistanceKm;
  const maxDistanceKm = targetDistanceKm + Math.max(0.001, targetDistanceKm * 0.001);
  return {
    minDistanceKm,
    maxDistanceKm,
    midpointKm: (minDistanceKm + maxDistanceKm) / 2
  };
}

function normalizeWaypointGuidance(guidance: MarathonWaypointGuidance | undefined): Required<MarathonWaypointGuidance> | null {
  if (!guidance || guidance.points.length === 0) return null;
  return {
    points: guidance.points,
    hitRadiusKm: guidance.hitRadiusKm ?? 0.5,
    influenceRadiusKm: guidance.influenceRadiusKm ?? 3,
    minHits: guidance.minHits ?? 0
  };
}

function initialWaypointHits(
  guidance: Required<MarathonWaypointGuidance> | null,
  coordinate: Coordinate
): { mask: number; count: number } {
  if (!guidance) return { mask: 0, count: 0 };

  let mask = 0;
  let count = 0;
  for (let index = 0; index < guidance.points.length; index++) {
    if (haversineKm(coordinate, guidance.points[index]) > guidance.hitRadiusKm) continue;
    mask = addWaypointHit(mask, index);
    count += 1;
  }
  return { mask, count };
}

function advanceWaypointProgress(
  guidance: Required<MarathonWaypointGuidance> | null,
  currentMask: number,
  currentCount: number,
  coordinates: Coordinate[]
): { mask: number; count: number; score: number } {
  if (!guidance) return { mask: currentMask, count: currentCount, score: 0 };

  let mask = currentMask;
  let count = currentCount;
  let score = 0;
  let nearestUnhitKm = Number.POSITIVE_INFINITY;

  for (let index = 0; index < guidance.points.length; index++) {
    if (hasWaypointHit(mask, index)) continue;
    const distanceKm = distanceFromPointToPolylineKm(guidance.points[index], coordinates);
    if (distanceKm <= guidance.hitRadiusKm) {
      mask = addWaypointHit(mask, index);
      count += 1;
      score += 8_000;
      continue;
    }
    nearestUnhitKm = Math.min(nearestUnhitKm, distanceKm);
  }

  if (nearestUnhitKm < Number.POSITIVE_INFINITY) {
    score += Math.max(0, guidance.influenceRadiusKm - nearestUnhitKm) * 60;
  }

  return { mask, count, score };
}

function distanceToNearestUnhitWaypoint(
  guidance: Required<MarathonWaypointGuidance> | null,
  hitMask: number,
  coordinate: Coordinate
): number {
  if (!guidance) return 0;

  let nearestKm = Number.POSITIVE_INFINITY;
  for (let index = 0; index < guidance.points.length; index++) {
    if (hasWaypointHit(hitMask, index)) continue;
    nearestKm = Math.min(nearestKm, haversineKm(coordinate, guidance.points[index]));
  }
  return nearestKm === Number.POSITIVE_INFINITY ? 0 : nearestKm;
}

function hasMinimumWaypointHits(guidance: Required<MarathonWaypointGuidance> | null, hitCount: number): boolean {
  return !guidance || hitCount >= guidance.minHits;
}

function hasWaypointHit(mask: number, index: number): boolean {
  const bit = 2 ** index;
  return Math.floor(mask / bit) % 2 === 1;
}

function addWaypointHit(mask: number, index: number): number {
  return hasWaypointHit(mask, index) ? mask : mask + 2 ** index;
}

function distanceFromPointToPolylineKm(point: Coordinate, coordinates: Coordinate[]): number {
  if (coordinates.length === 0) return Number.POSITIVE_INFINITY;
  if (coordinates.length === 1) return haversineKm(point, coordinates[0]);

  let nearestKm = Number.POSITIVE_INFINITY;
  for (let index = 1; index < coordinates.length; index++) {
    const projected = projectPointToSegment(point, coordinates[index - 1], coordinates[index]);
    nearestKm = Math.min(nearestKm, haversineKm(point, projected));
  }
  return nearestKm;
}

function projectPointToSegment(point: Coordinate, from: Coordinate, to: Coordinate): Coordinate {
  const latitude = point[1];
  const pointKm = toPlanarKm(point, latitude);
  const fromKm = toPlanarKm(from, latitude);
  const toKm = toPlanarKm(to, latitude);
  const vectorX = toKm[0] - fromKm[0];
  const vectorY = toKm[1] - fromKm[1];
  const pointX = pointKm[0] - fromKm[0];
  const pointY = pointKm[1] - fromKm[1];
  const denominator = vectorX * vectorX + vectorY * vectorY;
  const fraction = denominator === 0
    ? 0
    : Math.max(0, Math.min(1, (pointX * vectorX + pointY * vectorY) / denominator));

  return [
    from[0] + (to[0] - from[0]) * fraction,
    from[1] + (to[1] - from[1]) * fraction
  ];
}

function toPlanarKm(coordinate: Coordinate, latitude: number): [number, number] {
  const kmPerDegree = 111.32;
  return [
    coordinate[0] * kmPerDegree * Math.cos(latitude * Math.PI / 180),
    coordinate[1] * kmPerDegree
  ];
}

function calibratedRaceGradePercent(rasterSlopePercent: number): number {
  return Math.abs(rasterSlopePercent) * 0.22;
}

function snapToSuitableNode(
  graph: RoadGraph,
  coordinate: Coordinate,
  componentCapacityKm?: Map<string, number>,
  minimumComponentKm = 0
) {
  let best: { nodeId: string; distanceKm: number } | null = null;
  for (const node of graph.nodes.values()) {
    if (!(graph.adjacency.get(node.id) ?? []).some(edgeIsEligible)) continue;
    if ((componentCapacityKm?.get(node.id) ?? Number.POSITIVE_INFINITY) < minimumComponentKm) continue;
    const distanceKm = haversineKm(coordinate, node.coordinate);
    if (!best || distanceKm < best.distanceKm) best = { nodeId: node.id, distanceKm };
  }
  return best;
}

function computeEligibleComponentCapacityKm(graph: RoadGraph): Map<string, number> {
  const capacities = new Map<string, number>();
  const visited = new Set<string>();

  for (const node of graph.nodes.values()) {
    if (visited.has(node.id)) continue;
    const queue = [node.id];
    const componentNodes: string[] = [];
    const physicalEdges = new Map<string, number>();
    visited.add(node.id);

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      componentNodes.push(nodeId);
      for (const edge of graph.adjacency.get(nodeId) ?? []) {
        if (!edgeIsEligible(edge)) continue;
        physicalEdges.set(getPhysicalEdgeId(edge), edge.lengthKm);
        if (visited.has(edge.toNodeId)) continue;
        visited.add(edge.toNodeId);
        queue.push(edge.toNodeId);
      }
    }

    const capacityKm = [...physicalEdges.values()].reduce((sum, lengthKm) => sum + lengthKm, 0);
    componentNodes.forEach((nodeId) => capacities.set(nodeId, capacityKm));
  }

  return capacities;
}

function shortestDistancesTo(graph: RoadGraph, destinationNodeId: string): Map<string, number> {
  const distances = new Map<string, number>([[destinationNodeId, 0]]);
  const queue: Array<{ nodeId: string; distanceKm: number }> = [{ nodeId: destinationNodeId, distanceKm: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.distanceKm - b.distanceKm || a.nodeId.localeCompare(b.nodeId));
    const current = queue.shift()!;
    if (current.distanceKm !== distances.get(current.nodeId)) continue;

    for (const edge of graph.adjacency.get(current.nodeId) ?? []) {
      if (!edgeIsEligible(edge)) continue;
      const distanceKm = current.distanceKm + edge.lengthKm;
      if (distanceKm >= (distances.get(edge.toNodeId) ?? Number.POSITIVE_INFINITY)) continue;
      distances.set(edge.toNodeId, distanceKm);
      queue.push({ nodeId: edge.toNodeId, distanceKm });
    }
  }
  return distances;
}

function createsSelfIntersection(coordinates: Coordinate[], next: Coordinate, closesAtStart: boolean): boolean {
  if (coordinates.length < 3) return false;
  const from = coordinates.at(-1)!;
  for (let index = 0; index < coordinates.length - 2; index++) {
    const a = coordinates[index];
    const b = coordinates[index + 1];
    if (closesAtStart && index === 0 && sameCoordinate(next, a)) continue;
    if (segmentsShareEndpoint(from, next, a, b)) continue;
    if (segmentsIntersect(from, next, a, b)) return true;
  }
  return false;
}

function createsLocalKnot(coordinates: Coordinate[], next: Coordinate, closesAtFinish: boolean): boolean {
  if (coordinates.length < 3) return false;
  let walkedKm = haversineKm(coordinates.at(-1)!, next);

  for (let index = coordinates.length - 2; index >= 0; index--) {
    walkedKm += haversineKm(coordinates[index], coordinates[index + 1]);
    if (walkedKm > 1.5) break;
    if (walkedKm < 0.2 || (closesAtFinish && index === 0)) continue;

    const anchor = coordinates[index];
    if (haversineKm(anchor, next) >= 0.2) continue;
    const excursionKm = [...coordinates.slice(index + 1), next]
      .reduce((maximum, coordinate) => Math.max(maximum, haversineKm(anchor, coordinate)), 0);
    if (excursionKm > 0.14) return true;
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

function getPhysicalEdgeId(edge: RoadEdge): string {
  return edge.physicalEdgeId ?? edge.id.replace(/_rev$/, "");
}

function failure(
  code: "snap-distance" | "no-compliant-route",
  message: string,
  expandedStates: number,
  diagnostics?: { maxReachedKm: number; maxReachedNodeId: string }
): MarathonSearchResult {
  return { ok: false, code, message, expandedStates, ...(diagnostics ? { diagnostics } : {}) };
}
