import type { MarathonRoute } from "./routeMetrics";
import { compareRoutes, scoreRoute } from "./routeMetrics";
import type { SupportPoint } from "../data/supportPoints";
import { getSupportPointSummary, getSupportPointsForRoute } from "../data/supportPoints";

export type AnalysisDimensionId = "terrain" | "passage" | "venue" | "support" | "experience";

export interface AnalysisDimensionCard {
  id: AnalysisDimensionId;
  label: string;
  score: number;
  level: "优秀" | "稳妥" | "需优化";
  evidence: string;
}

export interface RouteAnalysis {
  routeId: string;
  routeName: string;
  recommendationScore: number;
  supportPointCount: number;
  dimensionCards: AnalysisDimensionCard[];
  highlights: string[];
  risks: string[];
  recommendation: string;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);
const percent = (value: number) => `${Math.round(value * 100)}%`;

function getLevel(score: number): AnalysisDimensionCard["level"] {
  if (score >= 80) return "优秀";
  if (score >= 60) return "稳妥";
  return "需优化";
}

function getTerrainScore(route: MarathonRoute) {
  const m = route.metrics;
  const terrainPenalty =
    m.totalClimbM / 8 +
    m.avgSlopePercent * 8 +
    m.maxSlopePercent * 4 +
    m.longSteepRatio * 25;
  return Math.round(clamp(100 - terrainPenalty));
}

function getPassageScore(route: MarathonRoute) {
  const m = route.metrics;
  return Math.round(clamp(100 - (m.sharpTurnRatio * 100 * 0.45 + m.narrowRoadRatio * 100 * 0.55)));
}

function getVenueReadinessScore(route: MarathonRoute) {
  const m = route.metrics;
  if (typeof m.competitionReadinessScore === "number") return m.competitionReadinessScore;
  return Math.round(clamp(getPassageScore(route) * 0.55 + scoreRoute(route).supportScore * 0.45));
}

function getExperienceScore(route: MarathonRoute) {
  const m = route.metrics;
  return Math.round(clamp(m.shadeCoverageRatio * 70 + (route.closedLoop ? 20 : 8) + 10));
}

export function analyzeRoute(route: MarathonRoute, points: SupportPoint[]): RouteAnalysis {
  const routeScore = scoreRoute(route);
  const summary = getSupportPointSummary(route.id, points);
  const routePoints = getSupportPointsForRoute(route.id, points);
  const supplyCount = summary.byType["补给"] ?? 0;
  const medicalCount = summary.byType["医疗"] ?? 0;
  const parkingCount = summary.byType["停车"] ?? 0;

  const terrainScore = getTerrainScore(route);
  const passageScore = getPassageScore(route);
  const venueReadinessScore = getVenueReadinessScore(route);
  const supportScore = routeScore.supportScore;
  const experienceScore = getExperienceScore(route);
  const mainRoadRatio = route.metrics.mainRoadRatio ?? 0.68;
  const unsuitableRoadRatio = route.metrics.unsuitableRoadRatio ?? route.metrics.narrowRoadRatio;
  const selfIntersectionCount = route.metrics.selfIntersectionCount ?? 0;

  const dimensionCards: AnalysisDimensionCard[] = [
    {
      id: "terrain",
      label: "地形友好度",
      score: terrainScore,
      level: getLevel(terrainScore),
      evidence: `累计爬升 ${route.metrics.totalClimbM}m，最大坡度 ${route.metrics.maxSlopePercent}%`
    },
    {
      id: "passage",
      label: "通行组织",
      score: passageScore,
      level: getLevel(passageScore),
      evidence: `急弯占比 ${percent(route.metrics.sharpTurnRatio)}，窄路占比 ${percent(route.metrics.narrowRoadRatio)}`
    },
    {
      id: "venue",
      label: "办赛条件",
      score: venueReadinessScore,
      level: getLevel(venueReadinessScore),
      evidence: `主干路 ${percent(mainRoadRatio)}，不适宜道路 ${percent(unsuitableRoadRatio)}，交织 ${selfIntersectionCount} 处`
    },
    {
      id: "support",
      label: "赛事保障",
      score: supportScore,
      level: getLevel(supportScore),
      evidence: `${summary.total} 个服务点，补给 ${supplyCount} 个，医疗 ${medicalCount} 个，最高等级 ${summary.topServiceLevel}`
    },
    {
      id: "experience",
      label: "观赛体验",
      score: experienceScore,
      level: getLevel(experienceScore),
      evidence: `遮荫覆盖 ${percent(route.metrics.shadeCoverageRatio)}，${route.closedLoop ? "闭环线路便于组织" : "非闭环线路需加强接驳"}`
    }
  ];

  const highlights = [
    `推荐分 ${routeScore.recommendationScore}，适配 ${routeScore.runnerFit}`,
    `办赛条件 ${venueReadinessScore} 分，主干路占比 ${percent(mainRoadRatio)}`,
    `补给覆盖 ${percent(route.metrics.supplyCoverageRatio)}，沿线服务点 ${routePoints.length} 个`,
    parkingCount > 0 ? `停车保障点 ${parkingCount} 个，利于赛前集散` : "可通过临时接驳补足停车保障"
  ];

  const risks = [
    unsuitableRoadRatio > 0.12
      ? "存在较多不适宜承办大规模赛事的窄路或低等级道路，建议替换为主次干道"
      : "道路等级整体满足候选赛道初筛要求",
    selfIntersectionCount > 0
      ? `路线存在 ${selfIntersectionCount} 处交织/自交，建议重算或设置避让点`
      : "路线几何形态未发现明显自交",
    route.metrics.medicalAvgIntervalKm > 6 ? "医疗点平均间距偏大，建议增设移动医疗组" : "医疗间距处于可控范围",
    route.metrics.longSteepRatio > 0.2 ? "长距离爬坡占比较高，需要分段配速提示" : "长坡压力较小，利于大众跑者完赛"
  ];

  return {
    routeId: route.id,
    routeName: route.name,
    recommendationScore: routeScore.recommendationScore,
    supportPointCount: summary.total,
    dimensionCards,
    highlights,
    risks,
    recommendation:
      routeScore.recommendationScore >= 75
        ? "建议作为优先方案进入现场踏勘与交通组织深化。"
        : "建议保留为备选方案，并优先优化保障点与高风险路段。"
  };
}

export function buildDecisionReport(routes: MarathonRoute[], points: SupportPoint[]): string {
  const rankedRoutes = compareRoutes(routes);
  const analysisByRoute = new Map(routes.map((route) => [route.id, analyzeRoute(route, points)]));
  const lines = [
    "武汉马拉松赛道智能选线分析报告",
    "",
    "数据依据：SuperMap iServer 发布的 map-wuhan-marathon WMS 服务、武汉 DEM 数据、赛道 GeoJSON 与服务点 GeoJSON。",
    "",
    "推荐排序："
  ];

  for (const score of rankedRoutes) {
    const analysis = analysisByRoute.get(score.id);
    if (!analysis) continue;
    lines.push(
      `${score.rank}. ${score.name}：推荐分 ${score.recommendationScore}，难度 ${score.difficultyScore}，保障 ${score.supportScore}，服务点 ${analysis.supportPointCount} 个`
    );
    lines.push(`   推荐理由：${analysis.highlights.join("；")}。`);
    lines.push(`   风险提示：${analysis.risks.join("；")}。`);
  }

  lines.push("");
  lines.push("结论：优先选择推荐分最高且保障点覆盖完整的方案，后续可在 SuperMap iDesktopX 中继续叠加交通管制、医疗资源和人流疏散数据。");

  return lines.join("\n");
}
