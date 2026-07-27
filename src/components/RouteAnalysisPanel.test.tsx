import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RouteAnalysisPanel } from "./RouteAnalysisPanel";
import type { MarathonRoute } from "../domain/routeMetrics";

const route: MarathonRoute = {
  id: "waypoint-east-lake",
  name: "东湖线",
  color: "#00a86b",
  lengthKm: 42.195,
  closedLoop: false,
  coordinates: [[114.3023, 30.60287], [114.3864, 30.5896]],
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
    supplyCoverageRatio: 0.78,
    medicalAvgIntervalKm: 4.5,
    parkingServiceScore: 70,
    shadeCoverageRatio: 0.46,
    landmarkCoverageScore: 100,
    riverCrossingScore: 64,
    bridgeDistanceKm: 1.8,
    bridgeSegmentCount: 1
  },
  lineage: {
    source: "osm-generated",
    roadAligned: true,
    note: "Full OSM generated route"
  }
};

describe("RouteAnalysisPanel", () => {
  it("starts with a decision summary that separates candidate generation from final recommendation", () => {
    const html = renderToStaticMarkup(<RouteAnalysisPanel route={route} supportPoints={[]} />);

    expect(html).toContain("路线状态");
    expect(html).toContain("候选方案");
    expect(html).toContain("推荐分");
    expect(html).toContain("风险项");
    expect(html).toContain("是否建议进入比选");
    expect(html).toContain("正式赛道需现场复核与认证测量");
  });

  it("shows evidence sources and marks estimated analysis cards", () => {
    const html = renderToStaticMarkup(<RouteAnalysisPanel route={route} supportPoints={[]} />);

    expect(html).toContain("数据来源");
    expect(html).toContain("落地复核与保障细化");
    expect(html).not.toContain("办赛条件");
    expect(html).not.toContain("数据缺口");
    expect(html).toContain("estimated");
    expect(html).toContain("模型估算");
    expect(html).toContain("不是官方保障点部署");
    expect(html).toContain("应以候选路线里程");
    expect(html).toContain("不作为当前选线算法的前置输入");
    expect(html).not.toMatch(/利于|可控|适配|优先方案|大众跑者完赛/);
  });

  it("renders route-based support planning recommendations", () => {
    const html = renderToStaticMarkup(<RouteAnalysisPanel route={route} supportPoints={[]} />);

    expect(html).toContain("保障规划建议");
    expect(html).toContain("补给");
    expect(html).toContain("医疗");
    expect(html).toContain("厕所");
    expect(html).toContain("引导");
    expect(html).toContain("不是官方保障方案");
  });
});
