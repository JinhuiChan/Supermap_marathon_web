import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MarathonRoute } from "../domain/routeMetrics";
import { ExportPanel } from "./ExportPanel";

const route: MarathonRoute = {
  id: "single",
  name: "单路线候选",
  color: "#0f766e",
  lengthKm: 42.195,
  targetDistanceKm: 42.195,
  closedLoop: false,
  coordinates: [[114.3, 30.6], [114.36, 30.62]],
  elevationProfile: [],
  lineage: { source: "osm-generated", roadAligned: true, note: "test" },
  metrics: {
    totalClimbM: 80,
    avgSlopePercent: 0.8,
    maxSlopePercent: 4,
    longSteepRatio: 0,
    sharpTurnRatio: 0.04,
    narrowRoadRatio: 0.02,
    repeatedRoadRatio: 0,
    selfIntersectionCount: 0,
    maxContinuityGapM: 0.2,
    roadAlignedRatio: 1,
    supplyCoverageRatio: 0.8,
    medicalAvgIntervalKm: 4,
    parkingServiceScore: 70,
    shadeCoverageRatio: 0.6
  }
};

describe("ExportPanel", () => {
  it("enables a single-route HTML report with one generated route", () => {
    const html = renderToStaticMarkup(<ExportPanel routes={[route]} supportPoints={[]} />);

    expect(html).toContain("单路线分析报告");
    expect(html).toContain("导出单路线 HTML 报告");
    expect(html).toContain("保存当前路线 JSON");
    expect(html).toContain("多路线比选报告");
    expect(html).toContain("disabled");
  });

  it("enables multi-route HTML comparison when at least two routes are selected", () => {
    const secondRoute = { ...route, id: "second", name: "第二候选线" };
    const html = renderToStaticMarkup(<ExportPanel routes={[route, secondRoute]} supportPoints={[]} />);

    expect(html).toContain("导出单路线 HTML 报告");
    expect(html).toContain("导出多路线 HTML 报告");
    expect(html).not.toContain("导出对比报告");
  });

  it("builds the single-route report from the current analysis route instead of the first compared route", () => {
    const comparedRoute = { ...route, id: "compared", name: "对比路线" };
    const activeRoute = { ...route, id: "active", name: "当前分析路线" };
    const html = renderToStaticMarkup(
      <ExportPanel primaryRoute={activeRoute} routes={[comparedRoute]} supportPoints={[]} />
    );

    expect(html).toContain("当前分析路线");
    expect(html).not.toContain("对比路线");
  });
});
