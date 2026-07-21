export type Coordinate = [number, number];

export interface ElevationPoint {
  km: number;
  elevation: number;
  slope: number;
}

export interface RouteMetrics {
  totalClimbM: number;
  startFinishElevationDiffM?: number;
  netElevationDropM?: number;
  maxSingleClimbM?: number;
  maxContinuousSteepKm?: number;
  terrainCoverageRatio?: number;
  maxContinuityGapM?: number;
  unsuitableEdgeCount?: number;
  roadAlignedRatio?: number;
  avgSlopePercent: number;
  maxSlopePercent: number;
  longSteepRatio: number;
  sharpTurnRatio: number;
  turnPenaltyScore?: number;
  narrowRoadRatio: number;
  competitionReadinessScore?: number;
  mainRoadRatio?: number;
  unsuitableRoadRatio?: number;
  repeatedRoadRatio?: number;
  selfIntersectionCount?: number;
  localBacktrackCount?: number;
  localKnotCount?: number;
  revisitedNodeCount?: number;
  parallelBacktrackCount?: number;
  hairpinTurnCount?: number;
  sharpTurnDensityPerKm?: number;
  supplyCoverageRatio: number;
  medicalAvgIntervalKm: number;
  parkingServiceScore: number;
  shadeCoverageRatio: number;
  landmarkCoverageScore?: number;
  landmarkPassedCount?: number;
  bridgeDistanceKm?: number;
  bridgeSegmentCount?: number;
  riverCrossingScore?: number;
  yangtzeBridgeDistanceKm?: number;
  yangtzeBridgeNames?: string[];
  wuhanYangtzeBridgePassed?: boolean;
}

export interface MarathonRoute {
  id: string;
  name: string;
  color: string;
  lengthKm: number;
  targetDistanceKm?: number;
  closedLoop: boolean;
  coordinates: Coordinate[];
  elevationProfile: ElevationPoint[];
  metrics: RouteMetrics;
  lineage?: {
    source: "planning-sketch" | "simulated-graph" | "osm-generated";
    roadAligned: boolean;
    note: string;
  };
}

export interface RouteScore {
  id: string;
  name: string;
  difficultyScore: number;
  supportScore: number;
  recommendationScore: number;
  profileScore: number;
  difficultyLabel: string;
  runnerFit: string;
  rank: number;
}

export type RouteSelectionProfile =
  | "balanced"
  | "pb-friendly"
  | "mass-finish"
  | "support-first"
  | "scenic"
  | "river-scenic";

export const routeSelectionProfiles: Array<{ id: RouteSelectionProfile; label: string; description: string }> = [
  { id: "pb-friendly", label: "竞速平坦", description: "低爬升、少急弯、宽路连续，适合稳定配速" },
  { id: "scenic", label: "城市体验", description: "优先地标、滨水、公园与观赛展示价值" }
];

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

export function getDifficultyLabel(score: number) {
  if (score < 35) return "精英 PB 友好";
  if (score < 70) return "大众稳健完赛";
  return "高难度挑战";
}

function getTurnPenaltyScore(route: MarathonRoute): number {
  return clamp(route.metrics.turnPenaltyScore ?? route.metrics.sharpTurnRatio * 100);
}

function getPassagePenalty(route: MarathonRoute): number {
  const m = route.metrics;
  const turnPenalty = getTurnPenaltyScore(route);
  return clamp(turnPenalty * 0.5 + clamp(m.sharpTurnRatio * 100) * 0.22 + clamp(m.narrowRoadRatio * 100) * 0.28);
}

function getRiverScore(route: MarathonRoute): number {
  const m = route.metrics;
  if (typeof m.riverCrossingScore === "number") return clamp(m.riverCrossingScore);

  const bridgeKmScore = clamp((m.bridgeDistanceKm ?? 0) * 28);
  const bridgeCountScore = clamp((m.bridgeSegmentCount ?? 0) * 34);
  return clamp(bridgeKmScore * 0.55 + bridgeCountScore * 0.45);
}

export function scoreRoute(route: MarathonRoute): RouteScore {
  const m = route.metrics;
  const terrain =
    clamp(m.totalClimbM / 5) * 0.3 +
    clamp(m.avgSlopePercent * 14) * 0.25 +
    clamp(m.maxSlopePercent * 8) * 0.2 +
    clamp(m.longSteepRatio * 100) * 0.25;
  const passage = getPassagePenalty(route);
  const support =
    clamp(m.supplyCoverageRatio * 100) * 0.38 +
    clamp(100 - m.medicalAvgIntervalKm * 8) * 0.34 +
    clamp(m.parkingServiceScore) * 0.16 +
    clamp(m.shadeCoverageRatio * 100) * 0.12;
  const landmarkScore = clamp(m.landmarkCoverageScore ?? 0);
  const riverScore = getRiverScore(route);
  const venueReadiness = clamp(m.competitionReadinessScore ?? ((100 - passage) * 0.55 + support * 0.45));
  const difficultyScore = clamp(
    terrain * 0.48 +
      passage * 0.28 +
      (100 - support) * 0.12 +
      (100 - venueReadiness) * 0.12
  );
  const recommendationScore = clamp(
    (100 - difficultyScore) * 0.46 +
      support * 0.2 +
      venueReadiness * 0.17 +
      landmarkScore * 0.1 +
      riverScore * 0.07
  );

  return {
    id: route.id,
    name: route.name,
    difficultyScore: Math.round(difficultyScore),
    supportScore: Math.round(support),
    recommendationScore: Math.round(recommendationScore),
    profileScore: Math.round(recommendationScore),
    difficultyLabel: getDifficultyLabel(difficultyScore),
    runnerFit: getDifficultyLabel(difficultyScore),
    rank: 0
  };
}

function getProfileScore(route: MarathonRoute, score: RouteScore, profile: RouteSelectionProfile) {
  if (profile === "balanced") return score.recommendationScore;

  const m = route.metrics;
  const lowDifficulty = 100 - score.difficultyScore;
  const passageScore = clamp(100 - getPassagePenalty(route));
  const flatnessScore = clamp(
    100 - (m.totalClimbM / 4 + m.avgSlopePercent * 12 + m.maxSlopePercent * 6 + m.longSteepRatio * 100 * 0.6)
  );
  const medicalScore = clamp(100 - m.medicalAvgIntervalKm * 8);
  const shadeScore = clamp(m.shadeCoverageRatio * 100);
  const landmarkScore = clamp(m.landmarkCoverageScore ?? 0);
  const riverScore = getRiverScore(route);

  if (profile === "pb-friendly") {
    return clamp(flatnessScore * 0.62 + passageScore * 0.3 + lowDifficulty * 0.08);
  }

  if (profile === "mass-finish") {
    return clamp(score.recommendationScore * 0.4 + score.supportScore * 0.38 + passageScore * 0.12 + lowDifficulty * 0.1);
  }

  if (profile === "support-first") {
    return clamp(score.supportScore * 0.6 + medicalScore * 0.22 + passageScore * 0.1 + score.recommendationScore * 0.08);
  }

  if (profile === "river-scenic") {
    return clamp(riverScore * 0.38 + landmarkScore * 0.28 + shadeScore * 0.14 + passageScore * 0.12 + score.supportScore * 0.08);
  }

  return clamp(landmarkScore * 0.34 + shadeScore * 0.26 + riverScore * 0.12 + score.supportScore * 0.14 + score.recommendationScore * 0.14);
}

export function scoreRouteForProfile(route: MarathonRoute, profile: RouteSelectionProfile = "balanced"): RouteScore {
  const score = scoreRoute(route);
  return {
    ...score,
    profileScore: Math.round(getProfileScore(route, score, profile))
  };
}

export function compareRoutes(routes: MarathonRoute[], profile: RouteSelectionProfile = "balanced"): RouteScore[] {
  return routes
    .map((route) => scoreRouteForProfile(route, profile))
    .sort((a, b) => b.profileScore - a.profileScore || b.recommendationScore - a.recommendationScore)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}
