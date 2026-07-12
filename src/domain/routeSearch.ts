import { haversineKm } from "./roadAttributes";
import { isFullMarathonRoadEdge, type RoadEdge, type RoadGraph } from "./roadNetwork";
import type { Coordinate } from "./routeMetrics";
import { marathonQualityThresholds } from "./routeQuality";
import { createsForbiddenTopologyStep } from "./routeTopology";

export type MarathonSearchObjective = "race-fast" | "operations" | "city-experience";

export interface MarathonSearchRequest {
  startPoint: Coordinate;
  endPoint?: Coordinate;
  objective: MarathonSearchObjective;
  maxRoutes?: number;
  maxExpandedStates?: number;
}

export interface SearchedPath {
  nodeIds: string[];
  edgeIds: string[];
  physicalEdgeIds: string[];
  totalLengthKm: number;
  terminalEdgeFraction?: number;
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
}

const DEFAULT_MAX_EXPANDED_STATES = 60_000;
const DEFAULT_MAX_ROUTES = 3;
const BEAM_WIDTH = 140;
const MAX_SNAP_DISTANCE_KM = 1.5;

export function searchMarathonRoutes(graph: RoadGraph, request: MarathonSearchRequest): MarathonSearchResult {
  const hasFixedFinish = Boolean(request.endPoint);
  const componentCapacityKm = hasFixedFinish ? undefined : computeEligibleComponentCapacityKm(graph);
  const start = snapToSuitableNode(
    graph,
    request.startPoint,
    componentCapacityKm,
    hasFixedFinish ? 0 : marathonQualityThresholds.minDistanceKm
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

  const initial: SearchState = {
    currentNodeId: start.nodeId,
    nodeIds: [start.nodeId],
    edgeIds: [],
    physicalEdgeIds: [],
    usedPhysicalEdges: new Set(),
    visitedNodeIds: new Set([start.nodeId]),
    coordinates: [initialCoordinate],
    totalLengthKm: 0,
    objectiveScore: 0
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
          state.totalLengthKm < marathonQualityThresholds.minDistanceKm &&
          nextLengthKm >= marathonQualityThresholds.minDistanceKm;
        const terminalEdgeFraction = crossesDynamicFinish
          ? (marathonQualityThresholds.minDistanceKm - state.totalLengthKm) / edge.lengthKm
          : undefined;
        if (!crossesDynamicFinish && nextLengthKm > marathonQualityThresholds.maxDistanceKm) continue;
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

        if (crossesDynamicFinish && terminalEdgeFraction !== undefined) {
          const completed = toSearchedPath(
            state,
            edge,
            physicalEdgeId,
            marathonQualityThresholds.minDistanceKm,
            terminalEdgeFraction
          );
          const key = `${completed.physicalEdgeIds.join("|")}|${terminalEdgeFraction.toFixed(6)}`;
          if (!routeKeys.has(key)) {
            routeKeys.add(key);
            routes.push(completed);
          }
          continue;
        }

        const finishesDynamically = !hasFixedFinish &&
          nextLengthKm >= marathonQualityThresholds.minDistanceKm &&
          nextLengthKm <= marathonQualityThresholds.maxDistanceKm;
        if ((hasFixedFinish && nextNodeId === end.nodeId) || finishesDynamically) {
          if (nextLengthKm < marathonQualityThresholds.minDistanceKm) continue;
          const completed = toSearchedPath(state, edge, physicalEdgeId, nextLengthKm);
          const key = completed.physicalEdgeIds.join("|");
          if (!routeKeys.has(key)) {
            routeKeys.add(key);
            routes.push(completed);
          }
          continue;
        }

        const lowerBoundKm = hasFixedFinish ? lowerBounds.get(nextNodeId) : 0;
        if (lowerBoundKm === undefined) continue;
        if (nextLengthKm + lowerBoundKm > marathonQualityThresholds.maxDistanceKm) continue;

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
          objectiveScore: state.objectiveScore + objectiveEdgeScore(edge, request.objective)
        });
      }
    }

    beam = selectBeam(nextStates, lowerBounds, hasFixedFinish);
  }

  if (routes.length === 0) {
    return failure(
      "no-compliant-route",
      "可用道路网络无法在硬约束内形成 42.195 km 简单路线",
      expandedStates,
      { maxReachedKm: Math.round(maxReachedKm * 1000) / 1000, maxReachedNodeId }
    );
  }

  return {
    ok: true,
    routes: routes
      .sort((a, b) =>
        Math.abs(a.totalLengthKm - 42.216) - Math.abs(b.totalLengthKm - 42.216) ||
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
  terminalEdgeFraction?: number
): SearchedPath {
  return {
    nodeIds: [...state.nodeIds, edge.toNodeId],
    edgeIds: [...state.edgeIds, edge.id],
    physicalEdgeIds: [...state.physicalEdgeIds, physicalEdgeId],
    totalLengthKm: Math.round(totalLengthKm * 1000) / 1000,
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

function selectBeam(states: SearchState[], lowerBounds: Map<string, number>, hasFixedFinish: boolean): SearchState[] {
  const midpointKm = (marathonQualityThresholds.minDistanceKm + marathonQualityThresholds.maxDistanceKm) / 2;
  const unique = new Map<string, SearchState>();
  for (const state of states) {
    const key = `${state.currentNodeId}|${Math.floor(state.totalLengthKm * 10)}|${state.physicalEdgeIds.at(-1)}`;
    const existing = unique.get(key);
    if (!existing || compareState(state, existing, lowerBounds, midpointKm, hasFixedFinish) < 0) unique.set(key, state);
  }
  return [...unique.values()]
    .sort((a, b) => compareState(a, b, lowerBounds, midpointKm, hasFixedFinish))
    .slice(0, BEAM_WIDTH);
}

function compareState(
  a: SearchState,
  b: SearchState,
  lowerBounds: Map<string, number>,
  midpointKm: number,
  hasFixedFinish: boolean
): number {
  const aProjected = a.totalLengthKm + (hasFixedFinish ? lowerBounds.get(a.currentNodeId) ?? 1_000 : 0);
  const bProjected = b.totalLengthKm + (hasFixedFinish ? lowerBounds.get(b.currentNodeId) ?? 1_000 : 0);
  const aQualityPerKm = a.objectiveScore / Math.max(a.totalLengthKm, 0.05);
  const bQualityPerKm = b.objectiveScore / Math.max(b.totalLengthKm, 0.05);
  return (
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
    if (walkedKm > 1.25) break;
    if (walkedKm < 0.25 || (closesAtFinish && index === 0)) continue;

    const anchor = coordinates[index];
    if (haversineKm(anchor, next) >= 0.16) continue;
    const excursionKm = [...coordinates.slice(index + 1), next]
      .reduce((maximum, coordinate) => Math.max(maximum, haversineKm(anchor, coordinate)), 0);
    if (excursionKm > 0.18) return true;
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
