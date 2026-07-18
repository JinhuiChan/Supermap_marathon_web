import { haversineKm } from "./roadAttributes";
import type { MarathonRoute } from "./routeMetrics";

export const marathonQualityThresholds = {
  minDistanceKm: 42.195,
  maxDistanceKm: 42.237,
  maxNetDropM: 42.195,
  maxTotalClimbM: 180,
  maxAbsGradePercent: 5,
  maxContinuousSteepKm: 1,
  maxLocalBacktrackCount: 40,
  maxContinuityGapM: 10,
  minTerrainCoverageRatio: 0.95
} as const;

export type RouteQualityIssueCode =
  | "distance"
  | "net-drop"
  | "total-climb"
  | "max-grade"
  | "continuous-steep"
  | "terrain-coverage"
  | "repeated-road"
  | "backtrack"
  | "self-intersection"
  | "local-knot"
  | "node-revisit"
  | "parallel-backtrack"
  | "hairpin-turn"
  | "sharp-turn-density"
  | "continuity-gap"
  | "road-suitability"
  | "road-alignment";

export interface RouteQualityIssue {
  code: RouteQualityIssueCode;
  label: string;
  actual: number | boolean;
  limit: number | boolean;
}

export interface RouteQualityReport {
  passed: boolean;
  issues: RouteQualityIssue[];
  endpointSeparationKm: number;
}

export function evaluateRouteQuality(route: MarathonRoute): RouteQualityReport {
  const issues: RouteQualityIssue[] = [];
  const metrics = route.metrics;
  const first = route.coordinates[0];
  const last = route.coordinates.at(-1);
  const endpointSeparationKm = first && last ? haversineKm(first, last) : Number.POSITIVE_INFINITY;

  if (route.lengthKm < marathonQualityThresholds.minDistanceKm || route.lengthKm > marathonQualityThresholds.maxDistanceKm) {
    addIssue(issues, "distance", "规划里程", route.lengthKm, marathonQualityThresholds.maxDistanceKm);
  }
  if ((metrics.netElevationDropM ?? Number.POSITIVE_INFINITY) > marathonQualityThresholds.maxNetDropM) {
    addIssue(issues, "net-drop", "起终点净下降", metrics.netElevationDropM ?? false, marathonQualityThresholds.maxNetDropM);
  }
  if (metrics.totalClimbM > marathonQualityThresholds.maxTotalClimbM) {
    addIssue(issues, "total-climb", "累计爬升", metrics.totalClimbM, marathonQualityThresholds.maxTotalClimbM);
  }
  if (metrics.maxSlopePercent > marathonQualityThresholds.maxAbsGradePercent) {
    addIssue(issues, "max-grade", "最大坡度", metrics.maxSlopePercent, marathonQualityThresholds.maxAbsGradePercent);
  }
  if ((metrics.maxContinuousSteepKm ?? Number.POSITIVE_INFINITY) > marathonQualityThresholds.maxContinuousSteepKm) {
    addIssue(issues, "continuous-steep", "连续大坡", metrics.maxContinuousSteepKm ?? false, marathonQualityThresholds.maxContinuousSteepKm);
  }
  if ((metrics.terrainCoverageRatio ?? 0) < marathonQualityThresholds.minTerrainCoverageRatio) {
    addIssue(issues, "terrain-coverage", "地形数据覆盖", metrics.terrainCoverageRatio ?? 0, marathonQualityThresholds.minTerrainCoverageRatio);
  }
  if ((metrics.repeatedRoadRatio ?? Number.POSITIVE_INFINITY) > 0) {
    addIssue(issues, "repeated-road", "重复道路", metrics.repeatedRoadRatio ?? false, 0);
  }
  const localBacktrackCount = metrics.localBacktrackCount ?? 0;
  if (
    (localBacktrackCount > 0 && (metrics.repeatedRoadRatio ?? 0) > 0) ||
    localBacktrackCount > marathonQualityThresholds.maxLocalBacktrackCount
  ) {
    addIssue(issues, "backtrack", "局部折返", metrics.localBacktrackCount ?? false, marathonQualityThresholds.maxLocalBacktrackCount);
  }
  if ((metrics.selfIntersectionCount ?? Number.POSITIVE_INFINITY) > 0) {
    addIssue(issues, "self-intersection", "路线自交", metrics.selfIntersectionCount ?? false, 0);
  }
  if ((metrics.localKnotCount ?? Number.POSITIVE_INFINITY) > 0) {
    addIssue(issues, "local-knot", "局部绳结", metrics.localKnotCount ?? false, 0);
  }
  if ((metrics.revisitedNodeCount ?? Number.POSITIVE_INFINITY) > 0) {
    addIssue(issues, "node-revisit", "交叉口复访", metrics.revisitedNodeCount ?? false, 0);
  }
  if ((metrics.parallelBacktrackCount ?? Number.POSITIVE_INFINITY) > 0) {
    addIssue(issues, "parallel-backtrack", "平行折返", metrics.parallelBacktrackCount ?? false, 0);
  }
  if ((metrics.hairpinTurnCount ?? Number.POSITIVE_INFINITY) > 0) {
    addIssue(issues, "hairpin-turn", "发卡掉头", metrics.hairpinTurnCount ?? false, 0);
  }
  if ((metrics.sharpTurnDensityPerKm ?? Number.POSITIVE_INFINITY) > 1.5) {
    addIssue(issues, "sharp-turn-density", "急弯密度", metrics.sharpTurnDensityPerKm ?? false, 1.5);
  }
  if ((metrics.maxContinuityGapM ?? Number.POSITIVE_INFINITY) > marathonQualityThresholds.maxContinuityGapM) {
    addIssue(issues, "continuity-gap", "路网连续误差", metrics.maxContinuityGapM ?? false, marathonQualityThresholds.maxContinuityGapM);
  }
  if ((metrics.unsuitableEdgeCount ?? Number.POSITIVE_INFINITY) > 0) {
    addIssue(issues, "road-suitability", "不适赛道路", metrics.unsuitableEdgeCount ?? false, 0);
  }
  const aligned = route.lineage?.roadAligned === true && (metrics.roadAlignedRatio ?? 0) >= 1;
  if (!aligned) {
    addIssue(issues, "road-alignment", "道路几何贴合", aligned, true);
  }

  return {
    passed: issues.length === 0,
    issues,
    endpointSeparationKm: round(endpointSeparationKm, 4)
  };
}

function addIssue(
  issues: RouteQualityIssue[],
  code: RouteQualityIssueCode,
  label: string,
  actual: number | boolean,
  limit: number | boolean
) {
  issues.push({ code, label, actual, limit });
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
