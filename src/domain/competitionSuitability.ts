import type { RoadEdge, RoadLevel } from "./roadNetwork";
import type { Coordinate } from "./routeMetrics";

export interface MarathonSuitabilitySummary {
  score: number;
  mainRoadRatio: number;
  unsuitableRoadRatio: number;
  repeatedRoadRatio: number;
  selfIntersectionCount: number;
  tunnelRatio: number;
}

const mainRoadLevels = new Set<RoadLevel>(["trunk", "primary", "secondary"]);

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

export function summarizeMarathonSuitability(
  coordinates: Coordinate[],
  edges: RoadEdge[],
  totalKm: number
): MarathonSuitabilitySummary {
  const denominator = Math.max(totalKm, 1);
  const mainRoadKm = edges
    .filter((edge) => mainRoadLevels.has(edge.roadLevel))
    .reduce((sum, edge) => sum + edge.lengthKm, 0);
  const unsuitableKm = edges
    .filter((edge) => !edge.competitionSuitable)
    .reduce((sum, edge) => sum + edge.lengthKm, 0);
  const tunnelKm = edges
    .filter((edge) => edge.isTunnel)
    .reduce((sum, edge) => sum + edge.lengthKm, 0);
  const repeatedRoadKm = computeRepeatedRoadKm(edges);
  const selfIntersectionCount = countSelfIntersections(coordinates);

  const mainRoadRatio = roundRatio(mainRoadKm / denominator);
  const unsuitableRoadRatio = roundRatio(unsuitableKm / denominator);
  const repeatedRoadRatio = roundRatio(repeatedRoadKm / denominator);
  const tunnelRatio = roundRatio(tunnelKm / denominator);

  const score = Math.round(
    clamp(
      82 +
        mainRoadRatio * 16 -
        unsuitableRoadRatio * 60 -
        repeatedRoadRatio * 35 -
        Math.min(selfIntersectionCount, 5) * 8 -
        tunnelRatio * 15
    )
  );

  return {
    score,
    mainRoadRatio,
    unsuitableRoadRatio,
    repeatedRoadRatio,
    selfIntersectionCount,
    tunnelRatio
  };
}

function computeRepeatedRoadKm(edges: RoadEdge[]): number {
  const seen = new Set<string>();
  let repeatedKm = 0;

  for (const edge of edges) {
    const baseId = baseEdgeId(edge.id);
    if (seen.has(baseId)) {
      repeatedKm += edge.lengthKm;
    } else {
      seen.add(baseId);
    }
  }

  return repeatedKm;
}

function countSelfIntersections(coordinates: Coordinate[]): number {
  if (coordinates.length < 4) return 0;
  let count = 0;
  const closed = sameCoordinate(coordinates[0], coordinates[coordinates.length - 1]);

  for (let first = 0; first < coordinates.length - 1; first++) {
    for (let second = first + 2; second < coordinates.length - 1; second++) {
      if (closed && first === 0 && second === coordinates.length - 2) continue;
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

function roundRatio(value: number): number {
  return Math.round(clamp(value, 0, 1) * 100) / 100;
}

function baseEdgeId(edgeId: string): string {
  return edgeId.endsWith("_rev") ? edgeId.slice(0, -4) : edgeId;
}
