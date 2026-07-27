import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { activeCityPackage } from "../config/cityPackages";
import type { MarathonRoute } from "../domain/routeMetrics";
import { RouteMap } from "./RouteMap";

function makeRoute(id: string): MarathonRoute {
  return {
    id,
    name: id,
    color: "#2563eb",
    lengthKm: 42.195,
    closedLoop: false,
    coordinates: [[114.3, 30.6], [114.31, 30.61]],
    elevationProfile: [],
    metrics: {
      totalClimbM: 0,
      avgSlopePercent: 0,
      maxSlopePercent: 0,
      longSteepRatio: 0,
      sharpTurnRatio: 0,
      narrowRoadRatio: 0,
      supplyCoverageRatio: 0.8,
      medicalAvgIntervalKm: 4,
      parkingServiceScore: 80,
      shadeCoverageRatio: 0.5
    }
  };
}

describe("RouteMap", () => {
  it("uses the current candidate route count in the fallback map toolbar", () => {
    const html = renderToStaticMarkup(
      <RouteMap
        routes={[makeRoute("one"), makeRoute("two")]}
        activeRouteId="one"
        comparedRouteIds={["one", "missing"]}
        routePlans={activeCityPackage.routePlans.slice(0, 2)}
        cityPackage={{ ...activeCityPackage, name: "测试城市", displayName: "测试城市马拉松" }}
        onSelectRoute={() => {}}
      />
    );

    expect(html).toContain("测试城市 WebGIS 赛道工作台");
    expect(html).toContain("1/2 已加入对比");
    expect(html).not.toContain("武汉 WebGIS");
    expect(html).not.toContain("2/3 已加入对比");
  });
});
