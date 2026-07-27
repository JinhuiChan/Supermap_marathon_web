import { describe, expect, it } from "vitest";
import type { MarathonRoute } from "./routeMetrics";
import { buildAnalysisMapFocus } from "./routeAnalysisMapFocus";
import type { RouteRiskLocationNote } from "./routeAnalysis";

const route: MarathonRoute = {
  id: "risk-route",
  name: "风险路线",
  color: "#d97706",
  lengthKm: 42.195,
  closedLoop: false,
  coordinates: [
    [114.3, 30.6],
    [114.31, 30.61],
    [114.32, 30.62],
    [114.33, 30.63],
    [114.34, 30.64]
  ],
  elevationProfile: [],
  metrics: {
    totalClimbM: 88,
    avgSlopePercent: 0.9,
    maxSlopePercent: 7.2,
    longSteepRatio: 0,
    sharpTurnRatio: 0.04,
    narrowRoadRatio: 0.02,
    supplyCoverageRatio: 0.8,
    medicalAvgIntervalKm: 4,
    parkingServiceScore: 70,
    shadeCoverageRatio: 0.6
  }
};

const note: RouteRiskLocationNote = {
  id: "max-grade",
  issue: "最大坡度",
  mileageHint: "坡度异常路段，优先核查 30-40km 疲劳段",
  mapHint: "最大坡度应结合地图里程标注定位。",
  action: "替换缓坡道路"
};

describe("routeAnalysisMapFocus", () => {
  it("converts a risk note into a route coordinate focus for map highlighting", () => {
    const focus = buildAnalysisMapFocus(route, note);

    expect(focus.routeId).toBe("risk-route");
    expect(focus.issueId).toBe("max-grade");
    expect(focus.label).toContain("最大坡度");
    expect(focus.coordinate).toEqual([114.33, 30.63]);
    expect(focus.mileageLabel).toContain("30-40km");
  });
});
