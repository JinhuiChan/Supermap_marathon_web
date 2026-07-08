import { describe, expect, it } from "vitest";
import { demoRoutes } from "../data/routes";
import { supportPoints } from "../data/supportPoints";
import { analyzeRoute, buildDecisionReport } from "./routeAnalysis";

describe("routeAnalysis", () => {
  it("turns the official route metrics and support points into analysis cards", () => {
    const route = demoRoutes[0];
    const analysis = analyzeRoute(route, supportPoints);

    expect(analysis.routeId).toBe("wuhan-marathon-2026");
    expect(analysis.supportPointCount).toBeGreaterThan(8);
    expect(analysis.dimensionCards.map((card) => card.id)).toEqual([
      "terrain",
      "passage",
      "venue",
      "support",
      "experience"
    ]);
    expect(analysis.dimensionCards.find((card) => card.id === "venue")?.score).toBeGreaterThan(0);
    expect(analysis.dimensionCards.find((card) => card.id === "support")?.evidence).toContain("公厕");
    expect(analysis.highlights.join(" ")).toContain("地铁");
  });

  it("builds a competition report with SuperMap evidence and recommendation logic", () => {
    const report = buildDecisionReport(demoRoutes, supportPoints);

    expect(report).toContain("SuperMap iServer");
    expect(report).toContain("2026 Wuhan Marathon official route reference");
    expect(report).toContain("推荐");
    expect(report).toContain("服务点");
  });
});
