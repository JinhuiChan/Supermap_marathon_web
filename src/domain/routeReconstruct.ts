import type { Coordinate, ElevationPoint, MarathonRoute, RouteMetrics } from "./routeMetrics";
import type { GeneratedPath } from "./routeGenerator";
import { isFullMarathonRoadEdge, type RoadEdge, type RoadGraph } from "./roadNetwork";
import { getElevation, haversineKm, turnAngle, turnPenaltyFromAngle } from "./roadAttributes";
import { summarizeMarathonSuitability } from "./competitionSuitability";
import { analyzeRouteTopology } from "./routeTopology";

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
  const metrics = computeMetrics(path, graph, coordinates, elevationProfile);

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
  for (const [edgeIndex, edgeId] of path.edgeIds.entries()) {
    const edge = resolveEdge(graph, edgeId);
    if (!edge) continue;
    const edgeCoordinates = clipCoordinatesByFraction(
      getDisplayCoordinatesForEdge(edge),
      edgeFractionForIndex(path, edgeIndex)
    );
    if (edgeCoordinates.length >= 2) {
      appendCoordinates(coords, edgeCoordinates);
      continue;
    }
    const from = graph.nodes.get(edge.fromNodeId);
    const to = graph.nodes.get(edge.toNodeId);
    if (!from || !to) continue;
    if (coords.length === 0 || !sameCoordinate(coords[coords.length - 1], from.coordinate)) {
      coords.push(from.coordinate);
    }
    coords.push(to.coordinate);
  }
  return coords;
}

function getDisplayCoordinatesForEdge(edge: RoadEdge): Coordinate[] {
  return edge.coordinates ?? [];
}

function appendCoordinates(target: Coordinate[], coordinates: Coordinate[]): void {
  for (const coordinate of coordinates) {
    if (target.length === 0 || !sameCoordinate(target[target.length - 1], coordinate)) {
      target.push(coordinate);
    }
  }
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
  coordinates: Coordinate[],
  profile: ElevationPoint[]
): RouteMetrics {
  const edges = path.edgeIds
    .map((eid, edgeIndex) => {
      const edge = resolveEdge(graph, eid);
      if (!edge) return undefined;
      const fraction = edgeFractionForIndex(path, edgeIndex);
      return fraction < 1 ? { ...edge, lengthKm: edge.lengthKm * fraction } : edge;
    })
    .filter(Boolean) as RoadEdge[];

  // totalClimbM
  let totalClimb = 0;
  for (let i = 1; i < profile.length; i++) {
    const diff = profile[i].elevation - profile[i - 1].elevation;
    if (diff > 0) totalClimb += diff;
  }

  const edgeSlopeMetrics = computeEdgeSlopeMetrics(edges, path.totalLengthKm);
  const provenance = computeGeometryProvenance(path, graph);
  const suitability = summarizeMarathonSuitability(coordinates, edges, path.totalLengthKm);
  const topology = analyzeRouteTopology(coordinates, path.nodeIds, path.totalLengthKm);
  let avgSlope = edgeSlopeMetrics.avgSlopePercent;
  let maxSlope = edgeSlopeMetrics.maxSlopePercent;
  let longSteepRatio = edgeSlopeMetrics.longSteepRatio;
  let maxSingleClimbM = edgeSlopeMetrics.maxSingleClimbM;
  let maxContinuousSteepKm = edgeSlopeMetrics.maxContinuousSteepKm;
  let startFinishElevationDiffM = edgeSlopeMetrics.startFinishElevationDiffM;

  if (!edgeSlopeMetrics.hasSlopeData) {
    if (profile.length > 1) {
      const slopes = profile.slice(1).map((p) => Math.abs(p.slope));
      avgSlope = slopes.reduce((a, b) => a + b, 0) / slopes.length;
    }

    maxSlope = Math.max(...profile.map((p) => Math.abs(p.slope)), 0);
    startFinishElevationDiffM = profile.length > 1 ? Math.abs(profile.at(-1)!.elevation - profile[0].elevation) : 0;

    let steepDist = 0;
    let maxSteepDist = 0;
    for (let i = 1; i < profile.length; i++) {
      const climb = profile[i].elevation - profile[i - 1].elevation;
      if (climb > 0) maxSingleClimbM = Math.max(maxSingleClimbM, climb);
      if (Math.abs(profile[i].slope) > 3) {
        const segKm = profile[i].km - profile[i - 1].km;
        steepDist += segKm;
        if (Math.abs(profile[i].slope) > 5) {
          maxSteepDist += segKm;
          maxContinuousSteepKm = Math.max(maxContinuousSteepKm, maxSteepDist);
        } else {
          maxSteepDist = 0;
        }
      } else {
        maxSteepDist = 0;
      }
    }
    longSteepRatio = profile.length > 1 ? steepDist / profile[profile.length - 1].km : 0;
  } else {
    maxSingleClimbM = getProfileMaxSingleClimbM(profile);
    maxContinuousSteepKm = getProfileMaxContinuousSteepKm(profile);
    startFinishElevationDiffM = profile.length > 1 ? Math.abs(profile.at(-1)!.elevation - profile[0].elevation) : 0;
  }

  // sharpTurnRatio
  let sharpTurns = 0;
  let turnPenaltyTotal = 0;
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
    const penalty = turnPenaltyFromAngle(angle);
    turnPenaltyTotal += penalty;
    if (penalty >= 55) sharpTurns++;
  }
  const sharpTurnRatio = allCoords.length > 2 ? sharpTurns / (allCoords.length - 2) : 0;
  const turnPenaltyScore = allCoords.length > 2 ? turnPenaltyTotal / (allCoords.length - 2) : 0;

  // narrowRoadRatio: service + track
  let narrowKm = 0;
  let bridgeKm = 0;
  let bridgeCount = 0;
  let yangtzeBridgeKm = 0;
  const yangtzeBridgeNames = new Set<string>();
  let wuhanYangtzeBridgePassed = false;
  for (const e of edges) {
    if (e.roadLevel === "service" || e.roadLevel === "track") {
      narrowKm += e.lengthKm;
    }
    if (e.isBridge) {
      bridgeKm += e.lengthKm;
      bridgeCount += 1;
    }
    if (e.isBridge && /长江.*桥|长江大桥/.test(e.roadName ?? "")) {
      yangtzeBridgeKm += e.lengthKm;
      if (e.roadName) yangtzeBridgeNames.add(e.roadName);
    }
    if (e.isRequiredRiverBridge) wuhanYangtzeBridgePassed = true;
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
    startFinishElevationDiffM: Math.round(startFinishElevationDiffM),
    netElevationDropM: profile.length > 1
      ? Math.round(Math.max(0, profile[0].elevation - profile.at(-1)!.elevation))
      : 0,
    maxSingleClimbM: Math.round(maxSingleClimbM),
    maxContinuousSteepKm: Math.round(maxContinuousSteepKm * 100) / 100,
    avgSlopePercent: Math.round(avgSlope * 10) / 10,
    maxSlopePercent: Math.round(maxSlope * 10) / 10,
    longSteepRatio: Math.round(longSteepRatio * 100) / 100,
    sharpTurnRatio: Math.round(sharpTurnRatio * 100) / 100,
    turnPenaltyScore: Math.round(turnPenaltyScore),
    narrowRoadRatio: Math.round(narrowRoadRatio * 100) / 100,
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
    terrainCoverageRatio: provenance.terrainCoverageRatio,
    maxContinuityGapM: provenance.maxContinuityGapM,
    unsuitableEdgeCount: provenance.unsuitableEdgeCount,
    roadAlignedRatio: provenance.roadAlignedRatio,
    supplyCoverageRatio: Math.round(supplyCoverageSum * 100) / 100,
    medicalAvgIntervalKm: Math.round(medicalIntervalSum * 10) / 10,
    parkingServiceScore: Math.round(parkingSum),
    shadeCoverageRatio: Math.round(shadeSum * 100) / 100,
    bridgeDistanceKm: Math.round(bridgeKm * 100) / 100,
    bridgeSegmentCount: bridgeCount,
    riverCrossingScore: Math.round(Math.min(100, bridgeKm * 24 + bridgeCount * 10 + (wuhanYangtzeBridgePassed ? 26 : 0))),
    yangtzeBridgeDistanceKm: Math.round(yangtzeBridgeKm * 100) / 100,
    yangtzeBridgeNames: [...yangtzeBridgeNames],
    wuhanYangtzeBridgePassed
  };
}

function computeGeometryProvenance(path: GeneratedPath, graph: RoadGraph) {
  let measuredTerrainKm = 0;
  let sourceGeometryKm = 0;
  let maxContinuityGapKm = 0;
  let unsuitableEdgeCount = 0;
  let previousEnd: Coordinate | null = null;

  for (const [edgeIndex, edgeId] of path.edgeIds.entries()) {
    const edge = resolveEdge(graph, edgeId);
    if (!edge) continue;
    const fraction = edgeFractionForIndex(path, edgeIndex);
    const edgeCoordinates = clipCoordinatesByFraction(getDisplayCoordinatesForEdge(edge), fraction);
    const effectiveLengthKm = edge.lengthKm * fraction;
    if (edge.terrainMeasured || typeof edge.slopeMean === "number") measuredTerrainKm += effectiveLengthKm;
    if (!isFullMarathonRoadEdge(edge)) unsuitableEdgeCount += 1;
    if (edgeCoordinates.length < 2) continue;

    sourceGeometryKm += effectiveLengthKm;
    const start = edgeCoordinates[0];
    if (previousEnd) maxContinuityGapKm = Math.max(maxContinuityGapKm, haversineKm(previousEnd, start));
    previousEnd = edgeCoordinates.at(-1)!;
  }

  const routeKm = Math.max(path.totalLengthKm, 0.001);
  const discontinuityKm = maxContinuityGapKm;
  return {
    terrainCoverageRatio: roundRatio(measuredTerrainKm / routeKm),
    maxContinuityGapM: Math.round(discontinuityKm * 1000 * 10) / 10,
    unsuitableEdgeCount,
    roadAlignedRatio: roundRatio(sourceGeometryKm / (routeKm + discontinuityKm))
  };
}

function edgeFractionForIndex(path: GeneratedPath, edgeIndex: number): number {
  return edgeIndex === path.edgeIds.length - 1
    ? Math.max(0, Math.min(1, path.terminalEdgeFraction ?? 1))
    : 1;
}

function clipCoordinatesByFraction(coordinates: Coordinate[], fraction: number): Coordinate[] {
  if (coordinates.length < 2 || fraction >= 1) return [...coordinates];
  if (fraction <= 0) return coordinates.length ? [coordinates[0]] : [];
  const lengths = coordinates.slice(1).map((coordinate, index) => haversineKm(coordinates[index], coordinate));
  const targetKm = lengths.reduce((sum, length) => sum + length, 0) * fraction;
  const output: Coordinate[] = [coordinates[0]];
  let walkedKm = 0;

  for (let index = 0; index < lengths.length; index++) {
    const segmentKm = lengths[index];
    if (walkedKm + segmentKm < targetKm) {
      output.push(coordinates[index + 1]);
      walkedKm += segmentKm;
      continue;
    }
    const localFraction = segmentKm <= 0 ? 0 : (targetKm - walkedKm) / segmentKm;
    const from = coordinates[index];
    const to = coordinates[index + 1];
    output.push([
      from[0] + (to[0] - from[0]) * localFraction,
      from[1] + (to[1] - from[1]) * localFraction
    ]);
    break;
  }
  return output;
}

function roundRatio(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

export function autoName(
  path: GeneratedPath,
  graph: RoadGraph,
  index: number
): string {
  const edges = path.edgeIds
    .map((eid) => resolveEdge(graph, eid))
    .filter(Boolean) as RoadEdge[];

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

function resolveEdge(graph: RoadGraph, edgeId: string): RoadEdge | undefined {
  return graph.edges.get(edgeId) ?? graph.edges.get(edgeId.replace(/_rev$/, ""));
}

function sameCoordinate(a: Coordinate, b: Coordinate): boolean {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

function getProfileMaxSingleClimbM(profile: ElevationPoint[]): number {
  let maxClimb = 0;
  for (let index = 1; index < profile.length; index++) {
    maxClimb = Math.max(maxClimb, profile[index].elevation - profile[index - 1].elevation);
  }
  return Math.max(0, maxClimb);
}

function getProfileMaxContinuousSteepKm(profile: ElevationPoint[]): number {
  let currentKm = 0;
  let maxKm = 0;
  for (let index = 1; index < profile.length; index++) {
    const segmentKm = Math.max(0, profile[index].km - profile[index - 1].km);
    if (Math.abs(profile[index].slope) > 5) {
      currentKm += segmentKm;
      maxKm = Math.max(maxKm, currentKm);
    } else {
      currentKm = 0;
    }
  }
  return maxKm;
}

function computeEdgeSlopeMetrics(edges: RoadEdge[], totalKm: number) {
  const slopeEdges = edges.filter((edge) => typeof edge.slopeMean === "number" && !edge.isRequiredRiverBridge);
  if (slopeEdges.length === 0) {
    return {
      hasSlopeData: false,
      avgSlopePercent: 0,
      maxSlopePercent: 0,
      longSteepRatio: 0,
      estimatedClimbM: 0,
      maxSingleClimbM: 0,
      maxContinuousSteepKm: 0,
      startFinishElevationDiffM: 0
    };
  }

  const denominator = slopeEdges.reduce((sum, edge) => sum + edge.lengthKm, 0) || totalKm || 1;
  const weightedSlope = slopeEdges.reduce((sum, edge) => sum + effectiveRaceSlopePercent(edge.slopeMean ?? 0) * edge.lengthKm, 0);
  const steepKm = slopeEdges
    .filter((edge) => effectiveRaceSlopePercent(edge.slopeMean ?? 0) > 3)
    .reduce((sum, edge) => sum + edge.lengthKm, 0);
  return {
    hasSlopeData: true,
    avgSlopePercent: weightedSlope / denominator,
    maxSlopePercent: Math.max(...slopeEdges.map((edge) => effectiveRaceSlopePercent(edge.slopeMean ?? 0)), 0),
    longSteepRatio: steepKm / (totalKm || denominator),
    estimatedClimbM: 0,
    maxSingleClimbM: 0,
    maxContinuousSteepKm: 0,
    startFinishElevationDiffM: 0
  };
}

function effectiveRaceSlopePercent(slopeMean: number): number {
  return Math.min(3, Math.abs(slopeMean) * 0.22);
}
