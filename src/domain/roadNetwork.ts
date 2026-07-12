import type { Coordinate } from "./routeMetrics";
import type { PoiScore } from "./poiTypes";

export type RoadLevel =
  | "motorway"
  | "trunk"
  | "primary"
  | "secondary"
  | "tertiary"
  | "residential"
  | "service"
  | "track"
  | "greenway";

export interface RoadNode {
  id: string;
  coordinate: Coordinate;
}

export interface RoadEdge {
  id: string;
  physicalEdgeId?: string;
  fromNodeId: string;
  toNodeId: string;
  lengthKm: number;
  roadLevel: RoadLevel;
  isBridge: boolean;
  isTunnel: boolean;
  isElevated?: boolean;
  isJunctionLink?: boolean;
  competitionSuitable: boolean;
  baselineCost: number;
  roadWidthM?: number;
  roadName?: string;
  suitabilityScore?: number;
  slopeMean?: number;
  slopeMax?: number;
  slopeFiltered?: boolean;
  isRequiredRiverBridge?: boolean;
  coordinates?: Coordinate[];
  surfaceSuitable?: boolean;
  terrainMeasured?: boolean;
  impedanceBreakdown?: {
    base: number;
    explicit: number;
    slope: number;
    constraint: number;
  };
  poiScores?: PoiScore;
}

export interface RoadGraph {
  nodes: Map<string, RoadNode>;
  edges: Map<string, RoadEdge>;
  adjacency: Map<string, RoadEdge[]>;
}

export function createEmptyGraph(): RoadGraph {
  return {
    nodes: new Map(),
    edges: new Map(),
    adjacency: new Map()
  };
}

export function addNode(graph: RoadGraph, node: RoadNode): void {
  graph.nodes.set(node.id, node);
  if (!graph.adjacency.has(node.id)) {
    graph.adjacency.set(node.id, []);
  }
}

export function addEdge(graph: RoadGraph, edge: RoadEdge): void {
  const normalized: RoadEdge = {
    ...edge,
    physicalEdgeId: edge.physicalEdgeId ?? edge.id.replace(/_rev$/, ""),
    surfaceSuitable: edge.surfaceSuitable ?? edge.competitionSuitable,
    terrainMeasured: edge.terrainMeasured ?? typeof edge.slopeMean === "number"
  };
  graph.edges.set(normalized.id, normalized);

  const from = graph.adjacency.get(normalized.fromNodeId);
  if (from) from.push(normalized);

  // bidirectional
  const to = graph.adjacency.get(normalized.toNodeId);
  if (to) {
    to.push({
      ...normalized,
      id: normalized.id + "_rev",
      fromNodeId: normalized.toNodeId,
      toNodeId: normalized.fromNodeId,
      coordinates: normalized.coordinates ? [...normalized.coordinates].reverse() : undefined
    });
  }
}

export function graphStats(graph: RoadGraph) {
  return {
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.size,
    totalKm: [...graph.edges.values()].reduce((s, e) => s + e.lengthKm, 0)
  };
}

export function isEventUsableRoadEdge(edge: RoadEdge): boolean {
  if (edge.competitionSuitable || edge.slopeFiltered === true) return true;
  return (
    edge.roadLevel === "residential" &&
    (edge.roadWidthM ?? 0) >= 5 &&
    edge.surfaceSuitable !== false &&
    edge.terrainMeasured === true &&
    edge.isElevated !== true &&
    edge.isTunnel !== true
  );
}

const fullMarathonRoadLevels = new Set<RoadLevel>([
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "greenway"
]);

export function isFullMarathonRoadEdge(edge: RoadEdge): boolean {
  return (
    (edge.competitionSuitable === true || edge.slopeFiltered === true) &&
    fullMarathonRoadLevels.has(edge.roadLevel) &&
    (edge.roadWidthM ?? 6) >= 6 &&
    edge.surfaceSuitable !== false &&
    edge.isElevated !== true &&
    edge.isTunnel !== true &&
    (edge.isJunctionLink !== true || edge.lengthKm <= 0.25)
  );
}

export function baseEdgeId(edgeId: string): string {
  return edgeId.endsWith("_rev") ? edgeId.slice(0, -4) : edgeId;
}
