import type { MarathonRoute } from "./routeMetrics";
import { compareRoutes, scoreRoute } from "./routeMetrics";
import type { SupportPoint } from "../data/supportPoints";
import { getSupportPointSummary, getSupportPointsForRoute } from "../data/supportPoints";

export type AnalysisDimensionId = "terrain" | "passage" | "venue" | "support" | "experience";

export interface AnalysisDimensionCard {
  id: AnalysisDimensionId;
  label: string;
  score: number;
  level: "优秀" | "稳定" | "需优化";
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
  if (score >= 60) return "稳定";
  return "需优化";
}

function getTerrainScore(route: MarathonRoute) {
  const m = route.metrics;
  const terrainPenalty =
    m.totalClimbM / 7 +
    (m.startFinishElevationDiffM ?? 0) * 0.35 +
    (m.maxSingleClimbM ?? 0) * 0.9 +
    (m.maxContinuousSteepKm ?? 0) * 14 +
    m.avgSlopePercent * 7 +
    m.maxSlopePercent * 4 +
    m.longSteepRatio * 28;
  return Math.round(clamp(100 - terrainPenalty));
}

function getTurnPenaltyScore(route: MarathonRoute) {
  return clamp(route.metrics.turnPenaltyScore ?? route.metrics.sharpTurnRatio * 100);
}

function getPassageScore(route: MarathonRoute) {
  const m = route.metrics;
  const penalty =
    getTurnPenaltyScore(route) * 0.46 +
    m.sharpTurnRatio * 100 * 0.2 +
    m.narrowRoadRatio * 100 * 0.22 +
    (m.repeatedRoadRatio ?? 0) * 100 * 0.06 +
    Math.min(100, (m.localKnotCount ?? 0) * 18 + (m.localBacktrackCount ?? 0) * 10) * 0.06;
  return Math.round(clamp(100 - penalty));
}

function inferMainRoadRatio(route: MarathonRoute) {
  if (typeof route.metrics.mainRoadRatio === "number") return route.metrics.mainRoadRatio;
  return clamp(1 - route.metrics.narrowRoadRatio - (route.metrics.unsuitableRoadRatio ?? 0), 0, 1);
}

function getVenueReadinessScore(route: MarathonRoute) {
  const m = route.metrics;
  if (typeof m.competitionReadinessScore === "number") {
    const geometryPenalty =
      (m.selfIntersectionCount ?? 0) * 5 +
      (m.repeatedRoadRatio ?? 0) * 100 * 0.12 +
      getTurnPenaltyScore(route) * 0.08;
    return Math.round(clamp(m.competitionReadinessScore - geometryPenalty));
  }

  const mainRoadRatio = inferMainRoadRatio(route);
  const unsuitableRoadRatio = m.unsuitableRoadRatio ?? m.narrowRoadRatio;
  const geometryPenalty = (m.selfIntersectionCount ?? 0) * 8 + (m.localKnotCount ?? 0) * 10;
  return Math.round(clamp(mainRoadRatio * 62 + getPassageScore(route) * 0.28 - unsuitableRoadRatio * 100 * 0.28 - geometryPenalty));
}

function getExperienceScore(route: MarathonRoute) {
  const m = route.metrics;
  const landmarkScore = clamp(m.landmarkCoverageScore ?? 0);
  const riverScore = clamp(m.riverCrossingScore ?? Math.min(100, (m.bridgeDistanceKm ?? 0) * 30 + (m.bridgeSegmentCount ?? 0) * 12));
  return Math.round(clamp(m.shadeCoverageRatio * 42 + landmarkScore * 0.34 + riverScore * 0.2 + (route.closedLoop ? 4 : 0)));
}

export function analyzeRoute(route: MarathonRoute, points: SupportPoint[]): RouteAnalysis {
  const routeScore = scoreRoute(route);
  const summary = getSupportPointSummary(route.id, points);
  const routePoints = getSupportPointsForRoute(route.id, points);
  const supplyCount = (summary.byType["补给"] ?? 0) + (summary.byType["商圈/补给"] ?? 0);
  const medicalCount = (summary.byType["医疗"] ?? 0) + (summary.byType["应急集结"] ?? 0);
  const parkingCount = summary.byType["停车场"] ?? 0;
  const transitCount = summary.byType["地铁站"] ?? 0;
  const restroomCount = summary.byType["公厕"] ?? 0;

  const terrainScore = getTerrainScore(route);
  const passageScore = getPassageScore(route);
  const venueReadinessScore = getVenueReadinessScore(route);
  const supportScore = routeScore.supportScore;
  const experienceScore = getExperienceScore(route);
  const mainRoadRatio = inferMainRoadRatio(route);
  const unsuitableRoadRatio = route.metrics.unsuitableRoadRatio ?? route.metrics.narrowRoadRatio;
  const selfIntersectionCount = route.metrics.selfIntersectionCount ?? 0;
  const turnPenaltyScore = getTurnPenaltyScore(route);

  const dimensionCards: AnalysisDimensionCard[] = [
    {
      id: "terrain",
      label: "地形坡度",
      score: terrainScore,
      level: getLevel(terrainScore),
      evidence: `累计爬升 ${route.metrics.totalClimbM}m，起终点高差 ${route.metrics.startFinishElevationDiffM ?? 0}m，最大单段爬升 ${route.metrics.maxSingleClimbM ?? 0}m，最大连续陡坡 ${(route.metrics.maxContinuousSteepKm ?? 0).toFixed(2)}km`
    },
    {
      id: "passage",
      label: "通行组织",
      score: passageScore,
      level: getLevel(passageScore),
      evidence: `转弯惩罚 ${Math.round(turnPenaltyScore)}，急弯占比 ${percent(route.metrics.sharpTurnRatio)}，窄路占比 ${percent(route.metrics.narrowRoadRatio)}`
    },
    {
      id: "venue",
      label: "办赛条件",
      score: venueReadinessScore,
      level: getLevel(venueReadinessScore),
      evidence: `主干路 ${percent(mainRoadRatio)}，不适宜道路 ${percent(unsuitableRoadRatio)}，重复道路 ${percent(route.metrics.repeatedRoadRatio ?? 0)}，自交 ${selfIntersectionCount} 处`
    },
    {
      id: "support",
      label: "赛事保障",
      score: supportScore,
      level: getLevel(supportScore),
      evidence: `${summary.total} 个服务点，补给 ${supplyCount} 个，医疗/应急 ${medicalCount} 个，地铁 ${transitCount} 个，公厕 ${restroomCount} 个；模型补给覆盖 ${percent(route.metrics.supplyCoverageRatio)}`
    },
    {
      id: "experience",
      label: "观赛体验",
      score: experienceScore,
      level: getLevel(experienceScore),
      evidence: `遮荫覆盖 ${percent(route.metrics.shadeCoverageRatio)}，地标覆盖 ${route.metrics.landmarkCoverageScore ?? 0} 分，跨江景观 ${route.metrics.riverCrossingScore ?? 0} 分，桥梁 ${(route.metrics.bridgeDistanceKm ?? 0).toFixed(2)}km`
    }
  ];

  const highlights = [
    `推荐分 ${routeScore.recommendationScore}，适配 ${routeScore.runnerFit}`,
    `办赛条件 ${venueReadinessScore} 分，主干路占比 ${percent(mainRoadRatio)}`,
    `补给覆盖 ${percent(route.metrics.supplyCoverageRatio)}，沿线服务点 ${routePoints.length} 个`,
    `跨江景观 ${route.metrics.riverCrossingScore ?? 0} 分，桥梁段 ${(route.metrics.bridgeDistanceKm ?? 0).toFixed(2)}km`,
    transitCount > 0 ? `地铁集散点 ${transitCount} 个，利于赛前赛后疏散` : "可通过临时接驳补足轨道交通集散",
    parkingCount > 0 ? `停车保障点 ${parkingCount} 个，利于赛前集散` : "可通过临时接驳补足停车保障"
  ];

  const risks = [
    unsuitableRoadRatio > 0.12
      ? "存在较多不适宜承办大规模赛事的窄路或低等级道路，建议替换为主次干道"
      : "道路等级整体满足候选赛道初筛要求",
    turnPenaltyScore > 55
      ? "直角转弯或急折角较多，需继续优化折线化路段"
      : "转弯阻力处于可控范围",
    selfIntersectionCount > 0
      ? `路线存在 ${selfIntersectionCount} 处自交，建议重算或设置避让点`
      : "路线几何形态未发现明显自交",
    route.metrics.medicalAvgIntervalKm > 6 ? "医疗点平均间距偏大，建议增设移动医疗组" : "医疗间距处于可控范围",
    route.metrics.longSteepRatio > 0.2 ? "长距离坡段占比较高，需要分段配速提示" : "长坡压力较小，利于大众跑者完赛",
    restroomCount === 0 ? "公厕保障点不足，建议沿起终点和补给区补充" : "公厕保障已纳入服务设施清单"
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
    "数据依据：SuperMap iServer 发布的 map-wuhan-road-network WMS 服务、武汉 DEM/坡度数据、道路网络 GeoJSON 与服务点 GeoJSON。",
    "路线基准：当前报告仅分析由道路网络生成算法输出的候选路线，不采用已删除的 2026 官方道路级矢量路线。",
    "评分口径：难度、保障、办赛条件和体验分均从每条路线的几何、坡度、道路等级、POI 覆盖、地标与跨江指标计算，不使用固定展示分。",
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
