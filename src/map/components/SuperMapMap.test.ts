import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { activeCityPackage } from "../../config/cityPackages";
import type { MarathonRoute } from "../../domain/routeMetrics";
import { clampDraggedProgressPosition, getVisibleMapRoutes, SuperMapMap } from "./SuperMapMap";

function makeRoute(id: string): MarathonRoute {
  return {
    id,
    name: id,
    color: "#0f5ca8",
    lengthKm: 1,
    closedLoop: false,
    coordinates: [
      [114, 30],
      [114.01, 30.01]
    ],
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

describe("getVisibleMapRoutes", () => {
  it("returns active and compared routes for the map", () => {
    const routes = [makeRoute("active"), makeRoute("checked"), makeRoute("unchecked")];

    expect(getVisibleMapRoutes(routes, "active", ["checked"]).map((route) => route.id)).toEqual(["active", "checked"]);
  });

  it("keeps the active route visible even when it is not checked for comparison", () => {
    const routes = [makeRoute("active"), makeRoute("unchecked")];

    expect(getVisibleMapRoutes(routes, "active", []).map((route) => route.id)).toEqual(["active"]);
  });

  it("returns no routes when the candidate route map layer is hidden", () => {
    const routes = [makeRoute("checked")];

    expect(getVisibleMapRoutes(routes, "checked", ["checked"], false)).toEqual([]);
  });

  it("renders the comparison count as an independent map status with the route-plan limit", () => {
    const html = renderToStaticMarkup(
      createElement(SuperMapMap, {
        routes: [],
        activeRouteId: "",
        comparedRouteIds: ["one", "two", "three"],
        routePlans: activeCityPackage.routePlans,
        layerVisibility: { routes: true, roadNetwork: true },
        onSelectRoute: () => {}
      })
    );

    expect(html).toContain("3/3 已加入对比");
    expect(html).not.toContain("3/5 已加入对比");
  });

  it("renders route generation progress on the map instead of the selection panel", () => {
    const html = renderToStaticMarkup(
      createElement(SuperMapMap, {
        routes: [],
        activeRouteId: "",
        comparedRouteIds: [],
        routePlans: activeCityPackage.routePlans,
        layerVisibility: { routes: true, roadNetwork: true },
        isGenerating: true,
        generationProgress: 41,
        generationStatus: "滨江线: connected 3/9 control-point legs",
        onSelectRoute: () => {}
      })
    );

    expect(html).toContain("map-generation-progress");
    expect(html).toContain("拖动生成进度");
    expect(html).toContain('aria-valuenow="41"');
    expect(html).toContain("滨江线: connected 3/9 control-point legs");
  });

  it("clamps dragged generation progress inside the map panel", () => {
    expect(clampDraggedProgressPosition({ x: -80, y: 20 }, { width: 900, height: 500 }, { width: 420, height: 118 })).toEqual({
      x: 0,
      y: 20
    });
    expect(clampDraggedProgressPosition({ x: 820, y: 470 }, { width: 900, height: 500 }, { width: 420, height: 118 })).toEqual({
      x: 480,
      y: 382
    });
  });

  it("uses the provided route-plan count in the map comparison status", () => {
    const html = renderToStaticMarkup(
      createElement(SuperMapMap, {
        routes: [],
        activeRouteId: "",
        comparedRouteIds: ["one", "two"],
        routePlans: activeCityPackage.routePlans.slice(0, 2),
        layerVisibility: { routes: true, roadNetwork: true },
        onSelectRoute: () => {}
      })
    );

    expect(html).toContain("2/2 已加入对比");
    expect(html).not.toContain("2/3 已加入对比");
  });
});
