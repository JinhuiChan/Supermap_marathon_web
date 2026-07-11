import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MarathonRoute } from "../domain/routeMetrics";
import { RouteQualityPanel } from "./RouteQualityPanel";

const route: MarathonRoute = {
  id: "quality-route",
  name: "竞速平坦路线",
  color: "#0f766e",
  lengthKm: 42.204,
  closedLoop: false,
  coordinates: [[114.3, 30.6], [114.36, 30.62]],
  elevationProfile: [],
  lineage: { source: "osm-generated", roadAligned: true, note: "test" },
  metrics: {
    totalClimbM: 120,
    netElevationDropM: 5,
    maxContinuousSteepKm: 0.4,
    terrainCoverageRatio: 1,
    maxContinuityGapM: 0.3,
    unsuitableEdgeCount: 0,
    roadAlignedRatio: 1,
    avgSlopePercent: 1.2,
    maxSlopePercent: 3,
    longSteepRatio: 0,
    sharpTurnRatio: 0.04,
    narrowRoadRatio: 0,
    repeatedRoadRatio: 0,
    selfIntersectionCount: 0,
    localBacktrackCount: 0,
    localKnotCount: 0,
    supplyCoverageRatio: 0.8,
    medicalAvgIntervalKm: 4,
    parkingServiceScore: 85,
    shadeCoverageRatio: 0.6
  }
};

describe("RouteQualityPanel", () => {
  it("shows the hard-gate evidence and certification boundary", () => {
    const html = renderToStaticMarkup(<RouteQualityPanel route={route} />);
    expect(html).toContain("质量闸门已通过");
    expect(html).toContain("42.204 km");
    expect(html).toContain("重复道路");
    expect(html).toContain("0%");
    expect(html).toContain("自交");
    expect(html).toContain("连续误差");
    expect(html).toContain("0.3 m");
    expect(html).toContain("规划结果不替代 World Athletics / AIMS 认证测量");
  });

  it("shows a useful empty state before route generation", () => {
    const html = renderToStaticMarkup(<RouteQualityPanel route={null} />);
    expect(html).toContain("等待合规路线");
  });
});
