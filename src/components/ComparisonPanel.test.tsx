import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MarathonRoute, RouteScore } from "../domain/routeMetrics";
import { buildComparisonRows, ComparisonPanel } from "./ComparisonPanel";

const makeScore = (id: string, profileScore: number, rank: number): RouteScore => ({
  id,
  name: id,
  difficultyScore: 35 + rank,
  supportScore: 68,
  recommendationScore: profileScore,
  profileScore,
  difficultyLabel: "大众稳健完赛",
  runnerFit: "大众稳健完赛",
  rank
});

const routeBase: MarathonRoute = {
  id: "east-lake",
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
    supplyCoverageRatio: 0.78,
    medicalAvgIntervalKm: 4.5,
    parkingServiceScore: 70,
    shadeCoverageRatio: 0.46,
    landmarkCoverageScore: 100,
    riverCrossingScore: 64
  }
};

describe("ComparisonPanel", () => {
  it("expands tight target scores into readable comparison indexes", () => {
    const rows = buildComparisonRows([makeScore("东湖线", 60, 1), makeScore("滨江线", 59, 2), makeScore("城市景观线", 58, 3)]);

    expect(rows.map((row) => row.profileScore)).toEqual([60, 59, 58]);
    expect(rows.map((row) => row.comparisonIndex)).toEqual([90, 78, 65]);
  });

  it("keeps tied target scores tied instead of inventing a ranking gap", () => {
    const rows = buildComparisonRows([makeScore("东湖线", 68, 1), makeScore("滨江线", 68, 2)]);

    expect(rows.map((row) => row.comparisonIndex)).toEqual([80, 80]);
  });

  it("renders comparison index while keeping the raw target score visible", () => {
    const html = renderToStaticMarkup(
      <ComparisonPanel
        routes={[
          routeBase,
          {
            ...routeBase,
            id: "riverfront",
            name: "滨江线",
            color: "#2563eb",
            metrics: {
              ...routeBase.metrics,
              totalClimbM: 76,
              turnPenaltyScore: 44,
              landmarkCoverageScore: 72
            }
          }
        ]}
      />
    );

    expect(html).toContain("对比指数");
    expect(html).toContain("原始目标分");
  });
});
