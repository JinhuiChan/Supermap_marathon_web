import { describe, expect, it } from "vitest";
import type { MarathonRoute } from "./routeMetrics";
import {
  buildDecisionReport,
  buildRouteComparisonHtmlReport,
  buildSingleRouteHtmlReport
} from "./routeAnalysis";

const route: MarathonRoute = {
  id: "east-lake",
  name: "东湖线",
  color: "#00a86b",
  lengthKm: 42.195,
  targetDistanceKm: 42.195,
  closedLoop: false,
  coordinates: [[114.302, 30.604], [114.386, 30.589]],
  elevationProfile: [],
  lineage: { source: "osm-generated", roadAligned: true, note: "test" },
  metrics: {
    totalClimbM: 58,
    avgSlopePercent: 0.7,
    maxSlopePercent: 8.2,
    longSteepRatio: 0.03,
    sharpTurnRatio: 0.08,
    turnPenaltyScore: 18,
    narrowRoadRatio: 0.04,
    competitionReadinessScore: 90,
    mainRoadRatio: 0.78,
    unsuitableRoadRatio: 0.02,
    repeatedRoadRatio: 0.01,
    selfIntersectionCount: 0,
    localKnotCount: 12,
    revisitedNodeCount: 4,
    parallelBacktrackCount: 2,
    hairpinTurnCount: 1,
    maxContinuityGapM: 0.2,
    roadAlignedRatio: 1,
    supplyCoverageRatio: 0.92,
    medicalAvgIntervalKm: 4.2,
    parkingServiceScore: 86,
    shadeCoverageRatio: 0.68,
    landmarkCoverageScore: 82,
    riverCrossingScore: 64,
    bridgeDistanceKm: 1.8,
    bridgeSegmentCount: 1
  }
};

const secondRoute: MarathonRoute = {
  ...route,
  id: "riverside",
  name: "滨江线",
  color: "#2563eb",
  metrics: {
    ...route.metrics,
    totalClimbM: 72,
    turnPenaltyScore: 42,
    supplyCoverageRatio: 0.74,
    landmarkCoverageScore: 68
  }
};

describe("HTML route reports", () => {
  it("builds a single-route HTML report with risk review, support planning, sources, and print styling", () => {
    const html = buildSingleRouteHtmlReport(route, []);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("route-map");
    expect(html).toContain("<svg");
    expect(html).toContain("单路线分析报告");
    expect(html).toContain("赛事选线决策报告");
    expect(html).toContain("评分体系");
    expect(html).toContain("SuperMap 数据链路");
    expect(html).toContain("东湖线");
    expect(html).toContain("风险复核项");
    expect(html).toContain("分段分析");
    expect(html).not.toContain("风险定位说明");
    expect(html).toContain("修改建议闭环");
    expect(html).toContain("保障规划建议");
    expect(html).toContain("数据来源");
    expect(html).toContain("World Athletics / AIMS");
    expect(html).toContain("@media print");
    expect(html).not.toContain("<script");
  });

  it("builds a multi-route HTML comparison report for at least two candidate routes", () => {
    const html = buildRouteComparisonHtmlReport([route, secondRoute], []);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("route-map");
    expect(html).toContain("<svg");
    expect(html).toContain("多路线比选报告");
    expect(html).toContain("东湖线");
    expect(html).toContain("滨江线");
    expect(html).toContain("综合排序");
    expect(html).toContain("风险复核项");
    expect(html).toContain("数据来源");
  });

  it("uses report context from a city package when provided", () => {
    const html = buildSingleRouteHtmlReport(route, [], {
      reportBrand: "测试城市马拉松选线平台",
      dataBasis: "数据依据：测试城市包。"
    });
    const text = buildDecisionReport([route], [], {
      reportBrand: "测试城市马拉松选线平台",
      dataBasis: "数据依据：测试城市包。"
    });

    expect(html).toContain("测试城市马拉松选线平台");
    expect(html).not.toContain("武汉马拉松赛道智能选线系统");
    expect(text).toContain("测试城市马拉松选线平台分析报告");
    expect(text).toContain("数据依据：测试城市包。");
  });
});
