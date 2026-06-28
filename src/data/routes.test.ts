import { describe, expect, it } from "vitest";
import { demoRoutes } from "./routes";

describe("routes", () => {
  it("uses a road-level vectorized official Wuhan Marathon route as the primary route", () => {
    const primary = demoRoutes[0];

    expect(primary.id).toBe("wuhan-marathon-2026");
    expect(primary.name).toContain("官方");
    expect(primary.closedLoop).toBe(false);
    expect(primary.coordinates.length).toBeGreaterThan(20);
    expect(primary.coordinates[0]).toEqual([114.302, 30.604]);
    expect(primary.coordinates.at(-1)).toEqual([114.395, 30.635]);
  });

  it("keeps planning alternatives clearly separate from the official route", () => {
    expect(demoRoutes.slice(1).every((route) => route.name.includes("备选"))).toBe(true);
  });
});
