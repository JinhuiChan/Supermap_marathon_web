import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MarathonRoute } from "../domain/routeMetrics";
import { CandidateRouteDrawer } from "./CandidateRouteDrawer";

const route: MarathonRoute = {
  id: "candidate",
  name: "组织保障路线",
  color: "#0f766e",
  lengthKm: 42.204,
  closedLoop: false,
  coordinates: [[114.3, 30.6], [114.36, 30.62]],
  elevationProfile: [],
  lineage: { source: "osm-generated", roadAligned: true, note: "test" },
  metrics: {
    totalClimbM: 100,
    avgSlopePercent: 1,
    maxSlopePercent: 3,
    longSteepRatio: 0,
    sharpTurnRatio: 0.04,
    narrowRoadRatio: 0,
    repeatedRoadRatio: 0,
    selfIntersectionCount: 0,
    localBacktrackCount: 12,
    localKnotCount: 0,
    maxContinuityGapM: 0.3,
    roadAlignedRatio: 1,
    landmarkPassedCount: 9,
    mainRoadRatio: 0.92,
    supplyCoverageRatio: 0.8,
    medicalAvgIntervalKm: 4,
    parkingServiceScore: 80,
    shadeCoverageRatio: 0.6
  }
};

describe("CandidateRouteDrawer", () => {
  it("prioritizes hard quality evidence over generic risk labels", () => {
    const html = renderToStaticMarkup(
      <CandidateRouteDrawer
        routes={[route]}
        activeRouteId="candidate"
        comparedRouteIds={[]}
        generationStatus="质量校验完成"
        onSelectRoute={() => {}}
        onToggleCompare={() => {}}
        onAnalyzeRoute={() => {}}
      />
    );

    expect(html).toContain("42.204 km");
    expect(html).not.toContain("已加入对比");
    expect(html).toContain("爬升 100 m");
    expect(html).toContain("重复 0%");
    expect(html).toContain("自交 0");
    expect(html).toContain("连续误差 0.3 m");
    expect(html).toContain("9</strong>控制点");
    expect(html).toContain("100%</strong>贴合");
    expect(html).toContain("92%</strong>通行路");
    expect(html).not.toContain("办赛");
    expect(html).not.toContain("推荐</span>");
    expect(html).not.toContain("保障</span>");
    expect(html).not.toContain("局部折返");
  });
});
