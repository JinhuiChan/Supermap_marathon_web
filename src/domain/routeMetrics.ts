export type Coordinate = [number, number];

export interface ElevationPoint {
  km: number;
  elevation: number;
  slope: number;
}

export interface RouteMetrics {
  totalClimbM: number;
  avgSlopePercent: number;
  maxSlopePercent: number;
  longSteepRatio: number;
  sharpTurnRatio: number;
  narrowRoadRatio: number;
  supplyCoverageRatio: number;
  medicalAvgIntervalKm: number;
  parkingServiceScore: number;
  shadeCoverageRatio: number;
}

export interface MarathonRoute {
  id: string;
  name: string;
  color: string;
  lengthKm: number;
  closedLoop: boolean;
  coordinates: Coordinate[];
  elevationProfile: ElevationPoint[];
  metrics: RouteMetrics;
}

export interface RouteScore {
  id: string;
  name: string;
  difficultyScore: number;
  supportScore: number;
  recommendationScore: number;
  difficultyLabel: string;
  runnerFit: string;
  rank: number;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

export function getDifficultyLabel(score: number) {
  if (score < 35) return "精英 PB 友好";
  if (score < 70) return "大众稳健完赛";
  return "高难度挑战";
}

export function scoreRoute(route: MarathonRoute): RouteScore {
  const m = route.metrics;
  const terrain =
    clamp(m.totalClimbM / 5) * 0.3 +
    clamp(m.avgSlopePercent * 14) * 0.25 +
    clamp(m.maxSlopePercent * 8) * 0.2 +
    clamp(m.longSteepRatio * 100) * 0.25;
  const passage = clamp(m.sharpTurnRatio * 100) * 0.45 + clamp(m.narrowRoadRatio * 100) * 0.55;
  const support =
    clamp(m.supplyCoverageRatio * 100) * 0.38 +
    clamp(100 - m.medicalAvgIntervalKm * 8) * 0.34 +
    clamp(m.parkingServiceScore) * 0.16 +
    clamp(m.shadeCoverageRatio * 100) * 0.12;
  const difficultyScore = clamp(terrain * 0.58 + passage * 0.22 + (100 - support) * 0.2);
  const recommendationScore = clamp(100 - difficultyScore * 0.72 + support * 0.28);

  return {
    id: route.id,
    name: route.name,
    difficultyScore: Math.round(difficultyScore),
    supportScore: Math.round(support),
    recommendationScore: Math.round(recommendationScore),
    difficultyLabel: getDifficultyLabel(difficultyScore),
    runnerFit: getDifficultyLabel(difficultyScore),
    rank: 0
  };
}

export function compareRoutes(routes: MarathonRoute[]): RouteScore[] {
  return routes
    .map(scoreRoute)
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}
