import { describe, expect, it } from "vitest";
import {
  getSupportPointSummary,
  getSupportPointsForRoute,
  supportPoints
} from "./supportPoints";

describe("supportPoints", () => {
  it("loads the Wuhan marathon service points from the published dataset", () => {
    expect(supportPoints.length).toBeGreaterThan(9);
    expect(supportPoints[0]).toMatchObject({
      id: "start-river-loop",
      routeId: "river-loop",
      type: "起终点",
      serviceLevel: "A"
    });
  });

  it("contains service points for the official Wuhan Marathon vector route", () => {
    const officialPoints = getSupportPointsForRoute("wuhan-marathon-2026");

    expect(officialPoints.length).toBeGreaterThanOrEqual(5);
    expect(officialPoints.map((point) => point.type)).toContain("起终点");
    expect(officialPoints.map((point) => point.type)).toContain("补给");
    expect(officialPoints.map((point) => point.type)).toContain("医疗");
  });

  it("filters service points by route", () => {
    const riverPoints = getSupportPointsForRoute("river-loop");

    expect(riverPoints).toHaveLength(3);
    expect(riverPoints.map((point) => point.type)).toEqual(["起终点", "补给", "医疗"]);
  });

  it("summarizes support coverage for a route", () => {
    expect(getSupportPointSummary("east-lake")).toEqual({
      total: 3,
      byType: {
        起终点: 1,
        补给: 1,
        停车: 1
      },
      topServiceLevel: "A"
    });
  });
});
