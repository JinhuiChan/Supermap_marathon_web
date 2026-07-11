import { describe, expect, it } from "vitest";
import {
  getSupportPointSummary,
  getSupportPointsForRoute,
  supportPoints
} from "./supportPoints";

describe("supportPoints", () => {
  it("loads support POIs for non-official candidate scenarios", () => {
    expect(supportPoints.length).toBeGreaterThanOrEqual(9);
    expect(supportPoints[0]).toMatchObject({
      id: "start-river-loop",
      routeId: "river-loop",
      type: "起终点",
      serviceLevel: "A"
    });
  });

  it("does not keep support points bound to the deleted official vector route", () => {
    expect(getSupportPointsForRoute("wuhan-marathon-2026")).toEqual([]);
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
        停车场: 1
      },
      topServiceLevel: "A"
    });
  });
});
