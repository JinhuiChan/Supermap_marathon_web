import { describe, expect, it } from "vitest";
import { demoRoutes } from "../data/routes";
import { supportPoints } from "../data/supportPoints";
import { analyzeRoute, buildDecisionReport } from "./routeAnalysis";

describe("routeAnalysis", () => {
  it("turns route metrics and support points into readable analysis cards", () => {
    const route = demoRoutes.find((item) => item.id === "river-loop")!;
    const analysis = analyzeRoute(route, supportPoints);

    expect(analysis.routeId).toBe("river-loop");
    expect(analysis.supportPointCount).toBe(3);
    expect(analysis.dimensionCards.map((card) => card.id)).toEqual([
      "terrain",
      "passage",
      "support",
      "experience"
    ]);
    expect(analysis.dimensionCards.find((card) => card.id === "terrain")?.level).toBe("稳妥");
    expect(analysis.dimensionCards.find((card) => card.id === "passage")?.score).toBeGreaterThan(80);
    expect(analysis.highlights.join("\n")).toContain("补给");
  });

  it("builds a competition report with SuperMap evidence and recommendation logic", () => {
    const report = buildDecisionReport(demoRoutes.slice(0, 3), supportPoints);

    expect(report).toContain("SuperMap iServer");
    expect(report).toContain("2026武汉马拉松官方路线");
    expect(report).toContain("两江四岸平缓备选线");
    expect(report).toContain("东湖绿道景观备选线");
    expect(report).toContain("服务点");
    expect(report).toContain("推荐理由");
  });
});
