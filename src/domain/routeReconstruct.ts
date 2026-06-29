import type { Coordinate, ElevationPoint, MarathonRoute, RouteMetrics } from "./routeMetrics";
import type { GeneratedPath } from "./routeGenerator";
import type { RoadGraph } from "./roadNetwork";
import { getElevation, haversineKm, slopePercent, turnAngle } from "./roadAttributes";

const COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"];

export function pathToMarathonRoute(
  path: GeneratedPath,
  graph: RoadGraph,
  index: number
): MarathonRoute {
  const coordinates = extractCoordinates(path, graph);
  const lengthKm = path.totalLengthKm;
  const closedLoop =
    coordinates.length >= 2 &&
    haversineKm(coordinates[0], coordinates[coordinates.length - 1]) < 0.5;
  const elevationProfile = buildElevationProfile(coordinates, lengthKm);
  const metrics = computeMetrics(path, graph, elevationProfile);

  return {
    id: `gen-${index}`,
    name: autoName(path, graph, index),
    color: COLORS[index % COLORS.length],
    lengthKm: Math.round(lengthKm * 1000) / 1000,
    closedLoop,
    coordinates,
    elevationProfile,
    metrics
  };
}

function extractCoordinates(
  path: GeneratedPath,
  graph: RoadGraph
): Coordinate[] {
  const coords: Coordinate[] = [];
  for (let i = 0; i < path.nodeIds.length; i++) {
    const node = graph.nodes.get(path.nodeIds[i]);
    if (node) coords.push(node.coordinate);
  }
  return coords;
}

function buildElevationProfile(
  coordinates: Coordinate[],
  totalKm: number
): ElevationPoint[] {
  if (coordinates.length < 2) return [];

  const stepCount = Math.min(15, coordinates.length);
  const stepSize = (coordinates.length - 1) / stepCount;
  const profile: ElevationPoint[] = [];

  let cumulativeKm = 0;
  for (let i = 0; i <= stepCount; i++) {
    const idx = Math.min(Math.round(i * stepSize), coordinates.length - 1);
    const prevIdx = idx > 0 ? idx - 1 : 0;
    const segmentKm =
      i > 0 ? haversineKm(coordinates[prevIdx], coordinates[idx]) : 0;
    cumulativeKm += segmentKm;
    const elevation = getElevation(coordinates[idx]);
    const slope =
      i > 0 && segmentKm > 0.001
        ? (getElevation(coordinates[idx]) - getElevation(coordinates[prevIdx])) /
          (segmentKm * 1000) *
          100
        : 0;

    profile.push({
      km: Math.round(Math.min(cumulativeKm, totalKm) * 100) / 100,
      elevation,
      slope: Math.round(slope * 10) / 10
    });
  }

  return profile;
}

function computeMetrics(
  path: GeneratedPath,
  graph: RoadGraph,
  profile: ElevationPoint[]
): RouteMetrics {
  const edges = path.edgeIds
    .map((eid) => graph.edges.get(eid))
    .filter(Boolean) as import("./roadNetwork").RoadEdge[];

  // totalClimbM
  let totalClimb = 0;
  for (let i = 1; i < profile.length; i++) {
    const diff = profile[i].elevation - profile[i - 1].elevation;
    if (diff > 0) totalClimb += diff;
  }

  // avgSlopePercent (weighted by segment length)
  let avgSlope = 0;
  if (profile.length > 1) {
    const slopes = profile.slice(1).map((p) => Math.abs(p.slope));
    avgSlope = slopes.reduce((a, b) => a + b, 0) / slopes.length;
  }

  // maxSlopePercent
  const maxSlope = Math.max(...profile.map((p) => Math.abs(p.slope)), 0);

  // longSteepRatio: fraction where slope > 3% for continuous 200m+
  let steepDist = 0;
  for (let i = 1; i < profile.length; i++) {
    if (Math.abs(profile[i].slope) > 3) {
      const segKm = profile[i].km - profile[i - 1].km;
      steepDist += segKm;
    }
  }
  const longSteepRatio = profile.length > 1 ? steepDist / profile[profile.length - 1].km : 0;

  // sharpTurnRatio
  let sharpTurns = 0;
  const coords = edges.map((e, i) => {
    const node = graph.nodes.get(e.fromNodeId);
    if (i === 0 && node) return node.coordinate;
    return null;
  });
  const allCoords: Coordinate[] = [];
  for (const e of edges) {
    const from = graph.nodes.get(e.fromNodeId);
    if (from) allCoords.push(from.coordinate);
  }
  if (edges.length > 0) {
    const lastEdge = edges[edges.length - 1];
    const lastNode = graph.nodes.get(lastEdge.toNodeId);
    if (lastNode) allCoords.push(lastNode.coordinate);
  }

  for (let i = 2; i < allCoords.length; i++) {
    const angle = turnAngle(allCoords[i - 2], allCoords[i - 1], allCoords[i]);
    if (angle > 110) sharpTurns++;
  }
  const sharpTurnRatio = allCoords.length > 2 ? sharpTurns / (allCoords.length - 2) : 0;

  // narrowRoadRatio: service + track
  let narrowKm = 0;
  for (const e of edges) {
    if (e.roadLevel === "service" || e.roadLevel === "track") {
      narrowKm += e.lengthKm;
    }
  }
  const totalKm = path.totalLengthKm || 1;
  const narrowRoadRatio = narrowKm / totalKm;

  // STUB metrics
  let supplyCoverageSum = 0;
  let medicalIntervalSum = 0;
  let parkingSum = 0;
  let shadeSum = 0;

  for (const e of edges) {
    const w = e.lengthKm / totalKm;
    const lvl = e.roadLevel;
    // supply coverage: main roads = higher
    supplyCoverageSum +=
      w *
      (lvl === "trunk" || lvl === "primary"
        ? 0.9
        : lvl === "secondary"
          ? 0.8
          : lvl === "tertiary"
            ? 0.7
            : 0.5);
    // medical interval: inverse of road level quality
    medicalIntervalSum +=
      w *
      (lvl === "trunk" || lvl === "primary"
        ? 4
        : lvl === "secondary"
          ? 5.5
          : lvl === "tertiary"
            ? 7
            : 9);
    // parking: urban roads = high
    parkingSum +=
      w *
      (lvl === "trunk" || lvl === "primary"
        ? 88
        : lvl === "secondary"
          ? 78
          : lvl === "tertiary"
            ? 65
            : 50);
    // shade: greenway = best, otherwise based on road level
    const shade =
      e.roadLevel === "greenway"
        ? 0.8
        : lvl === "trunk" || lvl === "primary"
          ? 0.35
          : lvl === "secondary"
            ? 0.45
            : 0.55;
    shadeSum += w * shade;
  }

  return {
    totalClimbM: Math.round(totalClimb),
    avgSlopePercent: Math.round(avgSlope * 10) / 10,
    maxSlopePercent: Math.round(maxSlope * 10) / 10,
    longSteepRatio: Math.round(longSteepRatio * 100) / 100,
    sharpTurnRatio: Math.round(sharpTurnRatio * 100) / 100,
    narrowRoadRatio: Math.round(narrowRoadRatio * 100) / 100,
    supplyCoverageRatio: Math.round(supplyCoverageSum * 100) / 100,
    medicalAvgIntervalKm: Math.round(medicalIntervalSum * 10) / 10,
    parkingServiceScore: Math.round(parkingSum),
    shadeCoverageRatio: Math.round(shadeSum * 100) / 100
  };
}

export function autoName(
  path: GeneratedPath,
  graph: RoadGraph,
  index: number
): string {
  const edges = path.edgeIds
    .map((eid) => graph.edges.get(eid))
    .filter(Boolean) as import("./roadNetwork").RoadEdge[];

  const greenwayKm = edges
    .filter((e) => e.roadLevel === "greenway")
    .reduce((s, e) => s + e.lengthKm, 0);
  const bridgeKm = edges
    .filter((e) => e.isBridge)
    .reduce((s, e) => s + e.lengthKm, 0);

  const parts: string[] = [`候选路线 ${index + 1}`];
  if (greenwayKm > 1) parts.push("绿道型");
  else if (bridgeKm > 1) parts.push("跨江型");
  else parts.push("综合型");

  if (path.totalLengthKm < 41) parts.push("(偏短)");
  else if (path.totalLengthKm > 43) parts.push("(偏长)");

  return parts.join("");
}
