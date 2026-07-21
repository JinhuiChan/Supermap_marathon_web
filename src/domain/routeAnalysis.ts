import type { MarathonRoute } from "./routeMetrics";
import { compareRoutes, scoreRoute } from "./routeMetrics";
import type { SupportPoint } from "../data/supportPoints";
import { getSupportPointSummary, getSupportPointsForRoute } from "../data/supportPoints";

export type AnalysisDimensionId = "terrain" | "passage" | "venue" | "support" | "experience";
export type AnalysisReliability = "measured" | "derived" | "estimated";

export interface AnalysisDimensionCard {
  id: AnalysisDimensionId;
  label: string;
  score: number;
  level: "优秀" | "稳定" | "需优化";
  evidence: string;
  source: string;
  reliability: AnalysisReliability;
  inputs: string[];
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
  dataSources: string[];
  dataGaps: string[];
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
    Math.abs(m.startFinishElevationDiffM ?? 0) * 0.35 +
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

function isGeneratedFromFullOsm(route: MarathonRoute) {
  return route.lineage?.source === "osm-generated";
}

function getSupportReliability(route: MarathonRoute, supportPointCount: number): AnalysisReliability {
  if (isGeneratedFromFullOsm(route)) return "estimated";
  return supportPointCount > 0 ? "derived" : "estimated";
}

function unique(items: string[]) {
  return [...new Set(items)];
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
  const supportReliability = getSupportReliability(route, summary.total);
  const experienceReliability: AnalysisReliability = isGeneratedFromFullOsm(route) ? "estimated" : "derived";

  const dimensionCards: AnalysisDimensionCard[] = [
    {
      id: "terrain",
      label: "地形坡度",
      score: terrainScore,
      level: getLevel(terrainScore),
      source: "路线坐标与坡度指标派生",
      reliability: "derived",
      inputs: ["totalClimbM", "startFinishElevationDiffM", "maxSlopePercent", "longSteepRatio"],
      evidence: `累计爬升 ${route.metrics.totalClimbM}m，起终点高差 ${route.metrics.startFinishElevationDiffM ?? 0}m，最大单段爬升 ${route.metrics.maxSingleClimbM ?? 0}m，最大连续陡坡 ${(route.metrics.maxContinuousSteepKm ?? 0).toFixed(2)}km`
    },
    {
      id: "passage",
      label: "通行组织",
      score: passageScore,
      level: getLevel(passageScore),
      source: "路线几何与道路拓扑检测",
      reliability: "derived",
      inputs: ["turnPenaltyScore", "sharpTurnRatio", "narrowRoadRatio", "repeatedRoadRatio", "localKnotCount"],
      evidence: `转弯惩罚 ${Math.round(turnPenaltyScore)}，急弯占比 ${percent(route.metrics.sharpTurnRatio)}，窄路占比 ${percent(route.metrics.narrowRoadRatio)}`
    },
    {
      id: "venue",
      label: "办赛条件",
      score: venueReadinessScore,
      level: getLevel(venueReadinessScore),
      source: "道路等级、适赛性与拓扑约束指标",
      reliability: "derived",
      inputs: ["mainRoadRatio", "unsuitableRoadRatio", "repeatedRoadRatio", "selfIntersectionCount"],
      evidence: `主干路 ${percent(mainRoadRatio)}，不适宜道路 ${percent(unsuitableRoadRatio)}，重复道路 ${percent(route.metrics.repeatedRoadRatio ?? 0)}，自交 ${selfIntersectionCount} 处`
    },
    {
      id: "support",
      label: "赛事保障",
      score: supportScore,
      level: getLevel(supportScore),
      source: supportReliability === "estimated" ? "模型估算，未接入官方保障部署" : "本地服务点 GeoJSON 与路线指标派生",
      reliability: supportReliability,
      inputs: ["supportPoints", "supplyCoverageRatio", "medicalAvgIntervalKm", "parkingServiceScore"],
      evidence:
        supportReliability === "estimated"
          ? `${summary.total} 个已匹配服务点；补给覆盖 ${percent(route.metrics.supplyCoverageRatio)}、医疗间距 ${route.metrics.medicalAvgIntervalKm.toFixed(1)}km、停车分 ${route.metrics.parkingServiceScore} 为模型估算，不是官方保障点部署`
          : `${summary.total} 个服务点，补给 ${supplyCount} 个，医疗/应急 ${medicalCount} 个，地铁 ${transitCount} 个，公厕 ${restroomCount} 个；补给覆盖 ${percent(route.metrics.supplyCoverageRatio)}`
    },
    {
      id: "experience",
      label: "景观体验",
      score: experienceScore,
      level: getLevel(experienceScore),
      source: experienceReliability === "estimated" ? "地标命中与桥梁指标派生，遮荫为模型估算" : "地标、桥梁与遮荫指标派生",
      reliability: experienceReliability,
      inputs: ["shadeCoverageRatio", "landmarkCoverageScore", "riverCrossingScore", "bridgeDistanceKm"],
      evidence: `遮荫覆盖 ${percent(route.metrics.shadeCoverageRatio)}，地标覆盖 ${route.metrics.landmarkCoverageScore ?? 0} 分，跨江景观 ${route.metrics.riverCrossingScore ?? 0} 分，桥梁 ${(route.metrics.bridgeDistanceKm ?? 0).toFixed(2)}km`
    }
  ];

  const highlights = [
    `推荐分 ${routeScore.recommendationScore}，难度分 ${routeScore.difficultyScore}，保障分 ${routeScore.supportScore}`,
    `道路拓扑：重复道路 ${percent(route.metrics.repeatedRoadRatio ?? 0)}，自交 ${selfIntersectionCount} 处，交叉口复访 ${route.metrics.revisitedNodeCount ?? 0} 处`,
    `道路属性：主干路 ${percent(mainRoadRatio)}，不适宜道路 ${percent(unsuitableRoadRatio)}，窄路 ${percent(route.metrics.narrowRoadRatio)}`,
    `地形：累计爬升 ${route.metrics.totalClimbM}m，最大坡度 ${route.metrics.maxSlopePercent.toFixed(1)}%，长坡占比 ${percent(route.metrics.longSteepRatio)}`,
    `景观指标：地标覆盖 ${route.metrics.landmarkCoverageScore ?? 0} 分，桥梁段 ${(route.metrics.bridgeDistanceKm ?? 0).toFixed(2)}km，跨江景观 ${route.metrics.riverCrossingScore ?? 0} 分`,
    supportReliability === "estimated"
      ? `保障指标为估算：补给覆盖 ${percent(route.metrics.supplyCoverageRatio)}，医疗间距 ${route.metrics.medicalAvgIntervalKm.toFixed(1)}km，已匹配服务点 ${routePoints.length} 个`
      : `保障点数据：已匹配服务点 ${routePoints.length} 个，补给 ${supplyCount} 个，医疗/应急 ${medicalCount} 个，公厕 ${restroomCount} 个`
  ];

  const risks = [
    unsuitableRoadRatio > 0.12
      ? `不适宜道路占比 ${percent(unsuitableRoadRatio)}，高于 12% 复核阈值`
      : `不适宜道路占比 ${percent(unsuitableRoadRatio)}`,
    turnPenaltyScore > 55
      ? `转弯惩罚 ${Math.round(turnPenaltyScore)}，高于 55 复核阈值`
      : `转弯惩罚 ${Math.round(turnPenaltyScore)}`,
    selfIntersectionCount > 0 ? `路线自交 ${selfIntersectionCount} 处` : "路线自交 0 处",
    `局部绳结 ${route.metrics.localKnotCount ?? 0} 处，平行折返 ${route.metrics.parallelBacktrackCount ?? 0} 处，发卡掉头 ${route.metrics.hairpinTurnCount ?? 0} 处`,
    supportReliability === "estimated"
      ? `医疗平均间距 ${route.metrics.medicalAvgIntervalKm.toFixed(1)}km 为模型估算，需用官方医疗点位复核`
      : `医疗/应急点 ${medicalCount} 个，医疗平均间距 ${route.metrics.medicalAvgIntervalKm.toFixed(1)}km`,
    restroomCount === 0 ? "已匹配公厕 0 个" : `已匹配公厕 ${restroomCount} 个`
  ];

  const dataSources = unique([
    "路线几何坐标",
    "道路拓扑检测指标",
    "道路等级与适赛性指标",
    "坡度/爬升指标",
    route.lineage?.source === "osm-generated" ? "Full OSM 路网生成结果" : "候选路线指标",
    points.length > 0 ? "本地服务点 GeoJSON" : "未提供服务点数据"
  ]);

  const dataGaps = [
    "未接入官方补给点、医疗点、厕所、停车与交通管制部署数据",
    "未接入实时交通、封路许可、人流疏散与现场道路宽度实测数据",
    "遮荫、停车、医疗间距等指标在 Full OSM 生成路线中为模型估算"
  ];

  return {
    routeId: route.id,
    routeName: route.name,
    recommendationScore: routeScore.recommendationScore,
    supportPointCount: summary.total,
    dimensionCards,
    highlights,
    risks,
    dataSources,
    dataGaps,
    recommendation: `当前推荐分 ${routeScore.recommendationScore}/100；该分数仅基于已接入的路线几何、道路属性、拓扑和本地服务点数据，正式决策前需要补齐数据缺口并现场复核。`
  };
}

export function buildDecisionReport(routes: MarathonRoute[], points: SupportPoint[]): string {
  const rankedRoutes = compareRoutes(routes);
  const analysisByRoute = new Map(routes.map((route) => [route.id, analyzeRoute(route, points)]));
  const lines = [
    "武汉马拉松赛道智能选线分析报告",
    "",
    "数据依据：SuperMap iServer 发布的 map-wuhan-road-network WMS 服务、道路网络 GeoJSON、路线几何、道路等级、坡度/爬升、拓扑检测与本地服务点 GeoJSON。",
    "路线基准：当前报告仅分析由道路网络生成算法输出的候选路线，不采用已删除的 2026 官方道路级矢量路线。",
    "评分口径：难度、保障、办赛条件和体验分均从每条路线的几何、坡度、道路等级、POI 覆盖、地标与跨江指标计算；估算指标会在分析卡中标注。",
    "数据缺口：未接入官方补给点、医疗点、厕所、停车、交通管制、实时交通、人流疏散与现场道路宽度实测数据。",
    "",
    "推荐排序："
  ];

  for (const score of rankedRoutes) {
    const analysis = analysisByRoute.get(score.id);
    if (!analysis) continue;
    lines.push(
      `${score.rank}. ${score.name}：推荐分 ${score.recommendationScore}，难度 ${score.difficultyScore}，保障 ${score.supportScore}，服务点 ${analysis.supportPointCount} 个`
    );
    lines.push(`   数据来源：${analysis.dataSources.join("；")}。`);
    lines.push(`   事实摘要：${analysis.highlights.join("；")}。`);
    lines.push(`   复核项：${analysis.risks.join("；")}。`);
  }

  lines.push("");
  lines.push("结论：排序只反映当前已接入数据下的相对表现；正式采用前必须补齐数据缺口并进行现场踏勘。");

  return lines.join("\n");
}
