import fs from "node:fs";
import path from "node:path";
import { buildRoadGraphFromGeoJson } from "../src/data/roadNetworkGeoJson";
import { waypointHitRadiusKm, waypointRoutePlans } from "../src/data/profileRoutePlanner";
import { baseEdgeId, type RoadEdge, type RoadGraph } from "../src/domain/roadNetwork";
import { haversineKm } from "../src/domain/roadAttributes";
import type { Coordinate } from "../src/domain/routeMetrics";

const fullRoadNetworkPath = "public/data/local-wuhan-road-network-osm.geojson";
const routeOutputPath = "public/data/experimental-full-osm-all-waypoint-routes.geojson";
const reportOutputPath = "artifacts/full-osm-all-waypoints/report.json";
const marathonTargetKm = 42.195;

interface PathSegment {
  nodeIds: string[];
  edges: RoadEdge[];
  totalKm: number;
}

interface GeneratedAllWaypointRoute {
  id: string;
  name: string;
  color: string;
  coordinates: Coordinate[];
  lengthKm: number;
  controlOrder: number[];
  hitDistancesM: number[];
  allControlPointsHit: boolean;
}

function main(): void {
  const roadGeoJson = JSON.parse(fs.readFileSync(fullRoadNetworkPath, "utf8"));
  const graph = buildRoadGraphFromGeoJson(roadGeoJson);
  const routes = waypointRoutePlans.map((plan) => buildAllWaypointRoute(graph, plan));

  fs.mkdirSync(path.dirname(reportOutputPath), { recursive: true });
  fs.writeFileSync(routeOutputPath, JSON.stringify(toRouteFeatureCollection(routes), null, 2), "utf8");
  fs.writeFileSync(reportOutputPath, JSON.stringify(toReport(routes), null, 2), "utf8");

  for (const route of routes) {
    const hits = route.hitDistancesM.filter((distanceM) => distanceM <= waypointHitRadiusKm * 1000).length;
    console.log(`${route.name} ${route.lengthKm.toFixed(3)}km hits=${hits}/${route.hitDistancesM.length} all=${route.allControlPointsHit}`);
    console.log(`  order: ${route.controlOrder.map((index) => index + 1).join(" -> ")}`);
    console.log(`  distances(m): ${route.hitDistancesM.join(", ")}`);
  }
  console.log(`GeoJSON: ${routeOutputPath}`);
  console.log(`Report: ${reportOutputPath}`);
}

function buildAllWaypointRoute(
  graph: RoadGraph,
  plan: typeof waypointRoutePlans[number]
): GeneratedAllWaypointRoute {
  const snapped = plan.waypoints.map((waypoint) => ({
    coordinate: waypoint.coordinate,
    nodeId: nearestNodeId(graph, waypoint.coordinate)
  }));
  const remainingControls = new Set(snapped.slice(1).map((_, index) => index + 1));
  const usedEdges = new Set<string>();
  const coordinates: Coordinate[] = [];
  const controlOrder = [0];
  let currentIndex = 0;
  let currentNodeId = snapped[0].nodeId;
  let lengthKm = 0;

  appendCoordinate(coordinates, graph.nodes.get(currentNodeId)?.coordinate ?? snapped[0].coordinate);

  while (remainingControls.size > 0) {
    const next = shortestPathToNearestTarget(graph, currentNodeId, [...remainingControls].map((index) => snapped[index].nodeId), usedEdges);
    if (!next) throw new Error(`${plan.id}: cannot connect remaining control points`);
    const targetIndex = [...remainingControls].find((index) => snapped[index].nodeId === next.nodeIds.at(-1)) ?? -1;
    if (targetIndex < 0) throw new Error(`${plan.id}: nearest target was not in the remaining waypoint set`);
    appendSegment(coordinates, next);
    rememberUsedEdges(usedEdges, next.edges);
    lengthKm += next.totalKm;
    currentIndex = targetIndex;
    currentNodeId = snapped[currentIndex].nodeId;
    remainingControls.delete(currentIndex);
    controlOrder.push(currentIndex);
  }

  if (lengthKm < marathonTargetKm) {
    const filler = buildOutAndBackFiller(graph, currentNodeId, (marathonTargetKm - lengthKm) / 2, usedEdges);
    appendCoordinates(coordinates, filler.outCoordinates.slice(1));
    appendCoordinates(coordinates, [...filler.outCoordinates].reverse().slice(1));
    lengthKm += filler.totalKm * 2;
  }

  const roundedLengthKm = Math.round(lengthKm * 1000) / 1000;
  const hitDistancesM = plan.waypoints.map((waypoint) =>
    Math.round(distanceFromPointToPolylineKm(waypoint.coordinate, coordinates) * 1000)
  );

  return {
    id: plan.id,
    name: plan.name,
    color: plan.color,
    coordinates,
    lengthKm: roundedLengthKm,
    controlOrder,
    hitDistancesM,
    allControlPointsHit: hitDistancesM.every((distanceM) => distanceM <= waypointHitRadiusKm * 1000)
  };
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
  if (!nearest) throw new Error("Could not snap control point to the full OSM road graph");
  return nearest;
}

function shortestPathToNearestTarget(
  graph: RoadGraph,
  fromNodeId: string,
  targetNodeIds: string[],
  usedEdges: Set<string>
): PathSegment | null {
  return shortestPath(graph, fromNodeId, new Set(targetNodeIds), usedEdges);
}

function shortestPathBetween(
  graph: RoadGraph,
  fromNodeId: string,
  toNodeId: string,
  usedEdges: Set<string>
): PathSegment | null {
  return shortestPath(graph, fromNodeId, new Set([toNodeId]), usedEdges);
}

function shortestPath(
  graph: RoadGraph,
  fromNodeId: string,
  targetNodeIds: Set<string>,
  usedEdges: Set<string>
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
      const reusePenalty = usedEdges.has(baseEdgeId(edge.id)) ? edge.lengthKm * 5 : 0;
      const nextDistance = current.distanceKm + edge.lengthKm + reusePenalty + roadLevelPenalty(edge);
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

function buildOutAndBackFiller(
  graph: RoadGraph,
  startNodeId: string,
  targetOutKm: number,
  usedEdges: Set<string>
): { outCoordinates: Coordinate[]; totalKm: number } {
  const start = graph.nodes.get(startNodeId);
  if (!start || targetOutKm <= 0) return { outCoordinates: [], totalKm: 0 };

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
      if (edge.surfaceSuitable === false) continue;
      const currentNode = graph.nodes.get(current.nodeId);
      const nextNode = graph.nodes.get(edge.toNodeId);
      if (!currentNode || !nextNode) continue;
      const nextDistance = current.distanceKm + edge.lengthKm;

      if (nextDistance >= targetOutKm) {
        const outCoordinates = reconstructCoordinates(graph, previous, startNodeId, current.nodeId);
        appendCoordinate(outCoordinates, interpolateCoordinate(currentNode.coordinate, nextNode.coordinate, (targetOutKm - current.distanceKm) / edge.lengthKm));
        return { outCoordinates, totalKm: targetOutKm };
      }

      const reusePenalty = usedEdges.has(baseEdgeId(edge.id)) ? edge.lengthKm * 0.6 : 0;
      const queueDistance = nextDistance + reusePenalty;
      if (queueDistance >= (distances.get(edge.toNodeId) ?? Number.POSITIVE_INFINITY)) continue;
      distances.set(edge.toNodeId, queueDistance);
      previous.set(edge.toNodeId, { nodeId: current.nodeId, edge });
      queue.push({ nodeId: edge.toNodeId, distanceKm: queueDistance });
    }
  }

  return {
    outCoordinates: reconstructCoordinates(graph, previous, startNodeId, bestNodeId),
    totalKm: distances.get(bestNodeId) ?? 0
  };
}

function isRoutableEdge(edge: RoadEdge): boolean {
  return edge.roadLevel !== "track" &&
    edge.isTunnel !== true &&
    edge.isElevated !== true &&
    edge.surfaceSuitable !== false;
}

function roadLevelPenalty(edge: RoadEdge): number {
  if (edge.roadLevel === "trunk" || edge.roadLevel === "primary") return 0;
  if (edge.roadLevel === "secondary" || edge.roadLevel === "tertiary") return edge.lengthKm * 0.04;
  if (edge.roadLevel === "greenway") return edge.lengthKm * 0.08;
  return edge.lengthKm * 0.16;
}

function fillerEdgeScore(edge: RoadEdge, globalUsed: Set<string>, localUsed: Set<string>): number {
  const baseId = baseEdgeId(edge.id);
  const novelty = localUsed.has(baseId) ? -200 : globalUsed.has(baseId) ? -80 : 40;
  const level = edge.roadLevel === "primary" || edge.roadLevel === "secondary" ? 20 : edge.roadLevel === "greenway" ? 16 : 8;
  return novelty + level + Math.min(edge.lengthKm, 1) * 10;
}

function appendSegment(coordinates: Coordinate[], segment: PathSegment): void {
  for (const edge of segment.edges) {
    const edgeCoordinates = edge.coordinates?.length
      ? edge.coordinates
      : [
          coordinates.at(-1)!,
          edge.toNodeId ? undefined : undefined
        ].filter(Boolean) as Coordinate[];
    if (edgeCoordinates.length > 0) {
      appendCoordinates(coordinates, edgeCoordinates.slice(sameCoordinate(coordinates.at(-1), edgeCoordinates[0]) ? 1 : 0));
      continue;
    }
  }
}

function reconstructCoordinates(
  graph: RoadGraph,
  previous: Map<string, { nodeId: string; edge: RoadEdge }>,
  startNodeId: string,
  endNodeId: string
): Coordinate[] {
  const start = graph.nodes.get(startNodeId);
  const coordinates: Coordinate[] = start ? [start.coordinate] : [];
  const edges: RoadEdge[] = [];
  let cursor = endNodeId;

  while (cursor !== startNodeId) {
    const step = previous.get(cursor);
    if (!step) break;
    edges.unshift(step.edge);
    cursor = step.nodeId;
  }

  for (const edge of edges) {
    if (edge.coordinates?.length) {
      appendCoordinates(coordinates, edge.coordinates.slice(sameCoordinate(coordinates.at(-1), edge.coordinates[0]) ? 1 : 0));
      continue;
    }
    const to = graph.nodes.get(edge.toNodeId);
    if (to) appendCoordinate(coordinates, to.coordinate);
  }

  return coordinates;
}

function appendCoordinates(target: Coordinate[], coordinates: Coordinate[]): void {
  for (const coordinate of coordinates) appendCoordinate(target, coordinate);
}

function appendCoordinate(target: Coordinate[], coordinate: Coordinate): void {
  if (target.length === 0 || !sameCoordinate(target.at(-1), coordinate)) {
    target.push(coordinate);
  }
}

function sameCoordinate(a: Coordinate | undefined, b: Coordinate | undefined): boolean {
  return Boolean(a && b && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9);
}

function rememberUsedEdges(usedEdges: Set<string>, edges: RoadEdge[]): void {
  edges.forEach((edge) => usedEdges.add(baseEdgeId(edge.id)));
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

function toRouteFeatureCollection(routes: GeneratedAllWaypointRoute[]) {
  return {
    type: "FeatureCollection",
    features: routes.map((route) => ({
      type: "Feature",
      properties: {
        route_id: route.id,
        route_name: route.name,
        color: route.color,
        length_km: route.lengthKm,
        routing_network: "full-osm",
        control_hit_radius_km: waypointHitRadiusKm,
        control_hit_count: route.hitDistancesM.filter((distanceM) => distanceM <= waypointHitRadiusKm * 1000).length,
        control_total: route.hitDistancesM.length,
        all_control_points_hit: route.allControlPointsHit,
        control_order: route.controlOrder.map((index) => index + 1).join(">")
      },
      geometry: {
        type: "LineString",
        coordinates: route.coordinates
      }
    }))
  };
}

function toReport(routes: GeneratedAllWaypointRoute[]) {
  return routes.map((route) => ({
    routeId: route.id,
    routeName: route.name,
    lengthKm: route.lengthKm,
    allControlPointsHit: route.allControlPointsHit,
    controlOrder: route.controlOrder.map((index) => index + 1),
    hitDistancesM: route.hitDistancesM
  }));
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

main();
