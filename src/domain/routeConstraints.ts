import type { Coordinate } from "./routeMetrics";
import type { RoadGraph } from "./roadNetwork";
import { haversineKm } from "./roadAttributes";

export interface BoundingBox {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

export interface RouteConstraints {
  startPoint: Coordinate;
  endPoint: Coordinate;
  mustPassPoints: Coordinate[];
  avoidZones: BoundingBox[];
  targetDistanceKm: number;
}

export function snapToNearestNode(graph: RoadGraph, coord: Coordinate): string | null {
  let bestId: string | null = null;
  let bestDist = Infinity;

  for (const [id, node] of graph.nodes) {
    const d = haversineKm(coord, node.coordinate);
    if (d < bestDist) {
      bestDist = d;
      bestId = id;
    }
  }

  return bestId;
}

export function pointInZone(coord: Coordinate, zone: BoundingBox): boolean {
  return (
    coord[0] >= zone.minLon &&
    coord[0] <= zone.maxLon &&
    coord[1] >= zone.minLat &&
    coord[1] <= zone.maxLat
  );
}

export function edgeInZone(
  graph: RoadGraph,
  edgeId: string,
  zone: BoundingBox
): boolean {
  const edge = graph.edges.get(edgeId);
  if (!edge) return false;
  const fromNode = graph.nodes.get(edge.fromNodeId);
  const toNode = graph.nodes.get(edge.toNodeId);
  if (!fromNode || !toNode) return false;

  const mid: Coordinate = [
    (fromNode.coordinate[0] + toNode.coordinate[0]) / 2,
    (fromNode.coordinate[1] + toNode.coordinate[1]) / 2
  ];
  return pointInZone(mid, zone);
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateConstraints(
  graph: RoadGraph,
  constraints: RouteConstraints
): ValidationResult {
  const errors: string[] = [];

  if (!snapToNearestNode(graph, constraints.startPoint)) {
    errors.push("起点无法吸附到路网节点");
  }
  if (!snapToNearestNode(graph, constraints.endPoint)) {
    errors.push("终点无法吸附到路网节点");
  }
  for (let i = 0; i < constraints.mustPassPoints.length; i++) {
    if (!snapToNearestNode(graph, constraints.mustPassPoints[i])) {
      errors.push(`必经点 ${i + 1} 无法吸附`);
    }
  }
  if (constraints.targetDistanceKm <= 0) {
    errors.push("目标里程必须大于 0");
  }

  return { valid: errors.length === 0, errors };
}
