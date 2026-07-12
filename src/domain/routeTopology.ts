import { haversineKm, turnAngle } from "./roadAttributes";
import type { Coordinate } from "./routeMetrics";

export interface RouteTopologyDiagnostics {
  revisitedNodeCount: number;
  parallelBacktrackCount: number;
  hairpinTurnCount: number;
  sharpTurnDensityPerKm: number;
}

export function analyzeRouteTopology(
  coordinates: Coordinate[],
  nodeIds: string[],
  totalKm: number
): RouteTopologyDiagnostics {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  const finalClosesAtStart = nodeIds.length > 1 && nodeIds.at(-1) === nodeIds[0];
  nodeIds.forEach((nodeId, index) => {
    if (finalClosesAtStart && index === nodeIds.length - 1) return;
    if (seen.has(nodeId)) repeated.add(nodeId);
    seen.add(nodeId);
  });

  let hairpinTurnCount = 0;
  let sharpTurnCount = 0;
  for (let index = 1; index < coordinates.length - 1; index++) {
    const angle = turnAngle(coordinates[index - 1], coordinates[index], coordinates[index + 1]);
    if (angle >= 75) sharpTurnCount += 1;
    if (angle >= 150) hairpinTurnCount += 1;
  }

  return {
    revisitedNodeCount: repeated.size,
    parallelBacktrackCount: countParallelBacktracks(coordinates),
    hairpinTurnCount,
    sharpTurnDensityPerKm: round(sharpTurnCount / Math.max(totalKm, 0.001), 3)
  };
}

function countParallelBacktracks(coordinates: Coordinate[]): number {
  let count = 0;
  for (let first = 0; first < coordinates.length - 1; first++) {
    const firstVector = direction(coordinates[first], coordinates[first + 1]);
    if (!firstVector) continue;
    const firstMidpoint = midpoint(coordinates[first], coordinates[first + 1]);

    for (let second = first + 2; second < coordinates.length - 1; second++) {
      const secondVector = direction(coordinates[second], coordinates[second + 1]);
      if (!secondVector || firstVector.x * secondVector.x + firstVector.y * secondVector.y > -0.94) continue;
      const secondMidpoint = midpoint(coordinates[second], coordinates[second + 1]);
      if (haversineKm(firstMidpoint, secondMidpoint) <= 0.15) count += 1;
    }
  }
  return count;
}

function direction(from: Coordinate, to: Coordinate): { x: number; y: number } | null {
  const x = (to[0] - from[0]) * Math.cos(((from[1] + to[1]) * Math.PI) / 360);
  const y = to[1] - from[1];
  const magnitude = Math.hypot(x, y);
  return magnitude <= 1e-12 ? null : { x: x / magnitude, y: y / magnitude };
}

function midpoint(a: Coordinate, b: Coordinate): Coordinate {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
