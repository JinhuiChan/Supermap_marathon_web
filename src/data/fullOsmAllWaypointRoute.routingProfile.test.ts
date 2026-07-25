import { describe, expect, it } from "vitest";
import sourceText from "./fullOsmAllWaypointRoute.ts?raw";

describe("fullOsmAllWaypointRoute routing profile boundary", () => {
  it("uses city routing profile bridge rules instead of hard-coded Wuhan bridge names", () => {
    expect(sourceText).toContain("isRequiredRiverBridgeForProfile");
    expect(sourceText).not.toContain("武汉长江大桥");
  });
});
