import { describe, expect, it } from "vitest";
import { supportPoints } from "../data/supportPoints";
import type { MarathonRoute } from "./routeMetrics";
import { analyzeRoute, buildDecisionReport } from "./routeAnalysis";

const generatedRoute: MarathonRoute = {
  id: "profile-balanced",
  name: "综合平衡最优路线",
  color: "#005bbb",
  lengthKm: 42.195,
  closedLoop: false,
  coordinates: [[114.302, 30.604], [114.34, 30.558]],
  elevationProfile: [],
  metrics: {
    totalClimbM: 58,
    avgSlopePercent: 0.7,
    maxSlopePercent: 2.4,
    longSteepRatio: 0.03,
    sharpTurnRatio: 0.08,
    turnPenaltyScore: 18,
    narrowRoadRatio: 0.04,
    competitionReadinessScore: 90,
    mainRoadRatio: 0.78,
    unsuitableRoadRatio: 0,
    repeatedRoadRatio: 0,
    selfIntersectionCount: 0,
    supplyCoverageRatio: 0.92,
    medicalAvgIntervalKm: 4.2,
    parkingServiceScore: 86,
    shadeCoverageRatio: 0.68,
    landmarkCoverageScore: 82,
    riverCrossingScore: 64,
    bridgeDistanceKm: 1.8,
    bridgeSegmentCount: 1
  },
  lineage: {
    source: "osm-generated",
    roadAligned: true,
    note: "测试路线"
  }
};

describe("routeAnalysis", () => {
  it("turns generated route metrics into analysis cards", () => {
    const analysis = analyzeRoute(generatedRoute, supportPoints);

    expect(analysis.routeId).toBe("profile-balanced");
    expect(analysis.dimensionCards.map((card) => card.id)).toEqual([
      "terrain",
      "passage",
      "support",
      "experience"
    ]);
    expect(analysis.dimensionCards.map((card) => card.label)).not.toContain("办赛条件");
    expect(analysis.dimensionCards.find((card) => card.id === "support")?.reliability).toBe("derived");
    expect(analysis.dimensionCards.find((card) => card.id === "support")?.evidence).toContain("不是官方保障点部署");
  });

  it("builds a competition report without the deleted official vector route as baseline", () => {
    const report = buildDecisionReport([generatedRoute], supportPoints);

    expect(report).toContain("SuperMap iServer");
    expect(report).toContain("不采用已删除的 2026 官方道路级矢量路线");
    expect(report).not.toContain("2026 Wuhan Marathon official route reference");
    expect(report).not.toContain("办赛条件");
    expect(report).toContain("推荐");
  });

  it("derives visibly different analysis scores from each route's real metrics", () => {
    const flatSupportedRoute: MarathonRoute = {
      ...generatedRoute,
      id: "flat-supported",
      metrics: {
        ...generatedRoute.metrics,
        totalClimbM: 42,
        sharpTurnRatio: 0.03,
        turnPenaltyScore: 8,
        supplyCoverageRatio: 0.94,
        medicalAvgIntervalKm: 3.2,
        landmarkCoverageScore: 76,
        riverCrossingScore: 58
      }
    };
    const angularLowSupportRoute: MarathonRoute = {
      ...generatedRoute,
      id: "angular-low-support",
      metrics: {
        ...generatedRoute.metrics,
        totalClimbM: 76,
        sharpTurnRatio: 0.22,
        turnPenaltyScore: 82,
        narrowRoadRatio: 0.18,
        supplyCoverageRatio: 0.48,
        medicalAvgIntervalKm: 8.4,
        parkingServiceScore: 42,
        landmarkCoverageScore: 24,
        riverCrossingScore: 12
      }
    };

    const better = analyzeRoute(flatSupportedRoute, supportPoints);
    const worse = analyzeRoute(angularLowSupportRoute, supportPoints);
    const betterScores = Object.fromEntries(better.dimensionCards.map((card) => [card.id, card.score]));
    const worseScores = Object.fromEntries(worse.dimensionCards.map((card) => [card.id, card.score]));

    expect(betterScores.passage).toBeGreaterThan(worseScores.passage);
    expect(betterScores.support).toBeGreaterThan(worseScores.support);
    expect(betterScores.experience).toBeGreaterThan(worseScores.experience);
    expect(new Set(worse.dimensionCards.map((card) => card.score)).size).toBeGreaterThan(2);
  });

  it("labels data sources and frames implementation planning as downstream of route selection", () => {
    const analysis = analyzeRoute(generatedRoute, []);
    const support = analysis.dimensionCards.find((card) => card.id === "support");

    expect(analysis.dataSources).toContain("路线几何坐标");
    expect(analysis.dataSources).toContain("道路拓扑检测指标");
    expect(analysis.implementationNotes).toContain("补给、医疗、厕所、志愿者与隔离设施应以候选路线里程、桥梁、转弯、折返点和人流集散位置为依据进一步布设");
    expect(analysis.implementationNotes.join(" ")).toContain("现场踏勘用于确认道路宽度");
    expect(analysis.recommendation).toContain("用于候选路线比选");
    expect(analysis.recommendation).toContain("保障方案应在选定候选路线后分段细化");
    expect(analysis.recommendation).not.toContain("补齐数据缺口");
    expect(support?.reliability).toBe("derived");
    expect(support?.source).toContain("基于线路长度");
    expect(support?.evidence).toContain("不是官方保障点部署");
    expect([...analysis.highlights, ...analysis.risks, analysis.recommendation].join(" ")).not.toMatch(/利于|可控|适配|优先方案|大众跑者完赛/);
  });

  it("reports support and traffic controls as route-based follow-up planning", () => {
    const report = buildDecisionReport([generatedRoute], supportPoints);

    expect(report).toContain("后续保障规划口径");
    expect(report).toContain("以候选路线为基础分段制定");
    expect(report).toContain("可作为路线比选和后续保障规划的依据");
    expect(report).not.toContain("数据缺口：未接入官方补给点");
    expect(report).not.toContain("正式采用前必须补齐数据缺口");
  });

  it("turns support analysis into route-based planning recommendations", () => {
    const analysis = analyzeRoute({
      ...generatedRoute,
      lengthKm: 42.195,
      metrics: {
        ...generatedRoute.metrics,
        selfIntersectionCount: 2,
        repeatedRoadRatio: 0.08,
        bridgeDistanceKm: 2.4,
        turnPenaltyScore: 62
      }
    }, []);
    const support = analysis.dimensionCards.find((card) => card.id === "support");

    expect(support?.label).toBe("保障规划");
    expect(support?.reliability).toBe("derived");
    expect(analysis.supportPlan.map((item) => item.type)).toEqual(["补给", "医疗", "厕所", "引导"]);
    expect(analysis.supportPlan.find((item) => item.type === "补给")?.recommendation).toContain("建议 9 个");
    expect(analysis.supportPlan.find((item) => item.type === "医疗")?.recommendation).toContain("起点、半程点、30km 后");
    expect(analysis.supportPlan.find((item) => item.type === "引导")?.basis).toContain("自交 2 处");
    expect(analysis.supportPlan.map((item) => item.recommendation).join(" ")).toContain("不是官方保障方案");
  });

  it("adds segment analysis and optimization actions without map-oriented risk hints", () => {
    const analysis = analyzeRoute({
      ...generatedRoute,
      metrics: {
        ...generatedRoute.metrics,
        maxSlopePercent: 7.4,
        repeatedRoadRatio: 0.03,
        localKnotCount: 5,
        revisitedNodeCount: 2,
        hairpinTurnCount: 1
      }
    }, []);

    expect(analysis.segmentAnalysis).toHaveLength(6);
    expect(analysis.segmentAnalysis[0].rangeLabel).toBe("0-5km");
    expect(analysis.segmentAnalysis.map((segment) => segment.focus)).toContain("30km 后疲劳与医疗观察");
    expect("riskLocationNotes" in analysis).toBe(false);
    expect(analysis.optimizationActions.map((item) => item.title)).toContain("优化局部拓扑");
    expect(analysis.optimizationActions.map((item) => item.priority)).toContain("高");
  });
});
