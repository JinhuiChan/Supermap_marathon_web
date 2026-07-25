import { describe, expect, it } from "vitest";
import { isRequiredRiverBridgeForProfile, wuhanRoutingProfile } from "./cityRoutingProfiles";

describe("cityRoutingProfiles", () => {
  it("keeps Wuhan routing rules behind a reusable city profile boundary", () => {
    expect(wuhanRoutingProfile.cityId).toBe("wuhan");
    expect(wuhanRoutingProfile.landmarkInfluenceRadiusKm).toBeGreaterThan(0);
    expect(wuhanRoutingProfile.riverBridgeNamePattern.test("二七长江大桥")).toBe(true);
    expect(wuhanRoutingProfile.landmarks.some((landmark) => landmark.name === "武汉长江大桥")).toBe(true);
    expect(isRequiredRiverBridgeForProfile("武汉长江大桥", true, wuhanRoutingProfile)).toBe(true);
    expect(isRequiredRiverBridgeForProfile("普通跨河桥", true, wuhanRoutingProfile)).toBe(false);
    expect(isRequiredRiverBridgeForProfile("武汉长江大桥", false, wuhanRoutingProfile)).toBe(false);
  });
});
