import { describe, expect, it } from "vitest";
import {
  getSupportPointSummary,
  getSupportPointsForRoute,
  supportPoints
} from "./supportPoints";

describe("supportPoints", () => {
  it("loads a complete Wuhan marathon support POI catalog", () => {
    expect(supportPoints.length).toBeGreaterThanOrEqual(20);
    expect(supportPoints[0]).toMatchObject({
      id: "start-river-loop",
      routeId: "river-loop",
      type: "起终点",
      serviceLevel: "A"
    });
  });

  it("contains all required service facility types for the official Wuhan route", () => {
    const officialTypes = [...new Set(getSupportPointsForRoute("wuhan-marathon-2026").map((point) => point.type))];

    expect(officialTypes).toEqual(expect.arrayContaining([
      "起终点",
      "补给",
      "医疗",
      "地铁站",
      "停车场",
      "公园",
      "公厕",
      "商圈/补给",
      "应急集结"
    ]));
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
