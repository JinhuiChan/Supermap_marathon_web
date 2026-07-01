import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { MarathonRoute } from "../domain/routeMetrics";
import { RouteLibrary } from "./RouteLibrary";

const route: MarathonRoute = {
  id: "osm-balanced",
  name: "OSM 综合平衡候选线",
  color: "#7c3aed",
  lengthKm: 42.195,
  closedLoop: false,
  coordinates: [[114.3, 30.6], [114.31, 30.61]],
  elevationProfile: [],
  metrics: {
    totalClimbM: 120,
    avgSlopePercent: 1.1,
    maxSlopePercent: 3.5,
    longSteepRatio: 0.08,
    sharpTurnRatio: 0.12,
    narrowRoadRatio: 0.06,
    supplyCoverageRatio: 0.88,
    medicalAvgIntervalKm: 4.8,
    parkingServiceScore: 82,
    shadeCoverageRatio: 0.55
  },
  lineage: {
    source: "osm-generated",
    roadAligned: true,
    note: "test"
  }
};

describe("RouteLibrary", () => {
  test("shows generation controls and route scores", () => {
    const html = renderToStaticMarkup(
      <RouteLibrary
        routes={[route]}
        activeRouteId={route.id}
        comparedRouteIds={[route.id]}
        generationStatus="已生成 3 条 OSM 候选路线"
        canGenerate
        onSelectRoute={() => {}}
        onToggleCompare={() => {}}
        onGenerateRoutes={() => {}}
      />
    );

    expect(html).toContain("生成 OSM 候选路线");
    expect(html).toContain("已生成 3 条 OSM 候选路线");
    expect(html).toContain("推荐");
    expect(html).toContain("难度");
  });
});
