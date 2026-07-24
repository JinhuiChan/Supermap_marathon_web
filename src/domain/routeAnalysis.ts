import type { MarathonRoute } from "./routeMetrics";
import { compareRoutes, scoreRoute } from "./routeMetrics";
import type { SupportPoint } from "../data/supportPoints";
import { getSupportPointSummary, getSupportPointsForRoute } from "../data/supportPoints";

export type AnalysisDimensionId = "terrain" | "passage" | "support" | "experience";
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

export interface SupportPlanningRecommendation {
  type: "补给" | "医疗" | "厕所" | "引导";
  recommendation: string;
  basis: string;
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
  implementationNotes: string[];
  supportPlan: SupportPlanningRecommendation[];
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

function getExperienceScore(route: MarathonRoute) {
  const m = route.metrics;
  const landmarkScore = clamp(m.landmarkCoverageScore ?? 0);
  const riverScore = clamp(m.riverCrossingScore ?? Math.min(100, (m.bridgeDistanceKm ?? 0) * 30 + (m.bridgeSegmentCount ?? 0) * 12));
  return Math.round(clamp(m.shadeCoverageRatio * 42 + landmarkScore * 0.34 + riverScore * 0.2 + (route.closedLoop ? 4 : 0)));
}

function unique(items: string[]) {
  return [...new Set(items)];
}

function buildSupportPlan(route: MarathonRoute, supportPointCount: number): SupportPlanningRecommendation[] {
  const supplyStationCount = Math.max(1, Math.ceil(route.lengthKm / 5));
  const restroomStationCount = Math.max(2, Math.ceil(route.lengthKm / 10) + 1);
  const bridgeKm = route.metrics.bridgeDistanceKm ?? 0;
  const selfIntersectionCount = route.metrics.selfIntersectionCount ?? 0;
  const repeatedRoadRatio = route.metrics.repeatedRoadRatio ?? 0;
  const turnPenaltyScore = getTurnPenaltyScore(route);
  const controlCount = route.metrics.landmarkPassedCount ?? 0;

  return [
    {
      type: "补给",
      recommendation: `建议 ${supplyStationCount} 个补给站，按约 5km 间距布设；该建议按 ${route.lengthKm.toFixed(1)}km 线路长度推导，不是官方保障方案。`,
      basis: `线路长度 ${route.lengthKm.toFixed(1)}km，已接入服务点 ${supportPointCount} 个，控制点命中 ${controlCount} 个`
    },
    {
      type: "医疗",
      recommendation: `建议在起点、半程点、30km 后疲劳段和终点布设医疗点；桥梁或长坡后可增加观察点，不是官方保障方案。`,
      basis: `医疗间距指标 ${route.metrics.medicalAvgIntervalKm.toFixed(1)}km，桥梁段 ${bridgeKm.toFixed(2)}km，最大坡度 ${route.metrics.maxSlopePercent.toFixed(1)}%`
    },
    {
      type: "厕所",
      recommendation: `建议 ${restroomStationCount} 组厕所服务点，覆盖起终点及约每 10km 一个服务区；具体位置需结合场地条件复核，不是官方保障方案。`,
      basis: `线路长度 ${route.lengthKm.toFixed(1)}km，当前面板不含官方厕所部署数据`
    },
    {
      type: "引导",
      recommendation: `建议在折返、交叉、桥梁上下桥和重复道路附近布设志愿者、隔离带与方向标识；不是官方保障方案。`,
      basis: `自交 ${selfIntersectionCount} 处，重复道路 ${percent(repeatedRoadRatio)}，转弯惩罚 ${Math.round(turnPenaltyScore)}，桥梁段 ${bridgeKm.toFixed(2)}km`
    }
  ];
}

function isGeneratedFromFullOsm(route: MarathonRoute) {
  return route.lineage?.source === "osm-generated";
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
  const supportScore = routeScore.supportScore;
  const experienceScore = getExperienceScore(route);
  const mainRoadRatio = inferMainRoadRatio(route);
  const unsuitableRoadRatio = route.metrics.unsuitableRoadRatio ?? route.metrics.narrowRoadRatio;
  const selfIntersectionCount = route.metrics.selfIntersectionCount ?? 0;
  const turnPenaltyScore = getTurnPenaltyScore(route);
  const supportPlan = buildSupportPlan(route, summary.total);
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
      id: "support",
      label: "保障规划",
      score: supportScore,
      level: getLevel(supportScore),
      source: "基于线路长度、拓扑风险、桥梁/坡度和已接入服务点推导",
      reliability: "derived",
      inputs: ["lengthKm", "supportPoints", "medicalAvgIntervalKm", "selfIntersectionCount", "bridgeDistanceKm"],
      evidence: `建议补给 ${Math.ceil(route.lengthKm / 5)} 个、厕所 ${Math.ceil(route.lengthKm / 10) + 1} 组；已匹配服务点 ${summary.total} 个。该卡输出保障规划建议，不是官方保障点部署。`
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
    `保障规划：${supportPlan.map((item) => `${item.type}-${item.recommendation}`).join("；")}`
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
    `医疗规划依据：医疗间距指标 ${route.metrics.medicalAvgIntervalKm.toFixed(1)}km，医疗/应急点 ${medicalCount} 个`,
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

  const implementationNotes = [
    "补给、医疗、厕所、志愿者与隔离设施应以候选路线里程、桥梁、转弯、折返点和人流集散位置为依据进一步布设",
    "交通管制、封路许可和疏散方案应围绕最终候选路线分段制定，并结合交警、城管和赛事执行条件复核",
    "现场踏勘用于确认道路宽度、施工围挡、路面状态和临时障碍，不作为当前选线算法的前置输入",
    "遮荫、停车、医疗间距等部分指标为模型估算，落地阶段应结合现场和部门数据校核"
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
    implementationNotes,
    supportPlan,
    recommendation: `当前推荐分 ${routeScore.recommendationScore}/100；该分数基于路线几何、道路属性、拓扑和本地服务点数据，用于候选路线比选。补给、医疗、交通管制等保障方案应在选定候选路线后分段细化，并通过现场复核确认实施条件。`
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
    "评分口径：难度、保障和体验分均从每条路线的几何、坡度、道路等级、POI 覆盖、地标与跨江指标计算；估算指标会在分析卡中标注。",
    "后续保障规划口径：补给、医疗、厕所、交通管制与疏散方案以候选路线为基础分段制定，本报告先给出选线比选与保障建议。",
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
  lines.push("结论：排序反映当前已接入数据下的候选路线适配性，可作为路线比选和后续保障规划的依据；正式落地时需围绕拟采用路线细化补给、医疗、交通管制与现场执行方案。");

  return lines.join("\n");
}
