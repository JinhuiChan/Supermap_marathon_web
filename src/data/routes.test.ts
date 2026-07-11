import { describe, expect, it } from "vitest";
import { demoRoutes } from "./routes";

describe("routes", () => {
  it("does not ship the incorrect 2026 official vector route as a static demo route", () => {
    expect(demoRoutes).toEqual([]);
  });
});
