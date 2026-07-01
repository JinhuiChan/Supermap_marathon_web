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
  lineage?: {
    source: "official-road-level" | "planning-sketch" | "simulated-graph" | "osm-generated";
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

export type RouteSelectionProfile = "balanced" | "pb-friendly" | "mass-finish" | "support-first" | "scenic";

export const routeSelectionProfiles: Array<{ id: RouteSelectionProfile; label: string; description: string }> = [
  { id: "balanced", label: "综合平衡", description: "兼顾难度、保障和体验" },
  { id: "pb-friendly", label: "PB 竞速", description: "优先低爬升、少急弯、通行顺畅" },
  { id: "mass-finish", label: "大众完赛", description: "优先稳定完赛和保障覆盖" },
  { id: "support-first", label: "保障优先", description: "优先补给、医疗和集散能力" },
  { id: "scenic", label: "景观体验", description: "优先遮荫、体验和观赛组织" }
];

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
  const passageScore = clamp(100 - (m.sharpTurnRatio * 100 * 0.45 + m.narrowRoadRatio * 100 * 0.55));
  const flatnessScore = clamp(
    100 - (m.totalClimbM / 4 + m.avgSlopePercent * 12 + m.maxSlopePercent * 6 + m.longSteepRatio * 100 * 0.6)
  );
  const medicalScore = clamp(100 - m.medicalAvgIntervalKm * 8);
  const shadeScore = clamp(m.shadeCoverageRatio * 100);

  if (profile === "pb-friendly") {
    return clamp(flatnessScore * 0.72 + passageScore * 0.2 + lowDifficulty * 0.08);
  }

  if (profile === "mass-finish") {
    return clamp(score.recommendationScore * 0.42 + score.supportScore * 0.38 + lowDifficulty * 0.2);
  }

  if (profile === "support-first") {
    return clamp(score.supportScore * 0.62 + medicalScore * 0.2 + score.recommendationScore * 0.18);
  }

  return clamp(shadeScore * 0.44 + score.supportScore * 0.22 + score.recommendationScore * 0.22 + (route.closedLoop ? 12 : 4));
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
