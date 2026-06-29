import type { Coordinate } from "./routeMetrics";

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
  fromNodeId: string;
  toNodeId: string;
  lengthKm: number;
  roadLevel: RoadLevel;
  isBridge: boolean;
  isTunnel: boolean;
  baselineCost: number;
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
  graph.edges.set(edge.id, edge);

  const from = graph.adjacency.get(edge.fromNodeId);
  if (from) from.push(edge);

  // bidirectional
  const to = graph.adjacency.get(edge.toNodeId);
  if (to) {
    to.push({
      ...edge,
      id: edge.id + "_rev",
      fromNodeId: edge.toNodeId,
      toNodeId: edge.fromNodeId
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
