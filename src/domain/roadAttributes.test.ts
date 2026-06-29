import { describe, expect, it } from "vitest";
import { getElevation, haversineKm, qualityMultiplier, slopePercent, turnAngle } from "./roadAttributes";

describe("roadAttributes", () => {
  describe("haversineKm", () => {
    it("returns 0 for same point", () => {
      expect(haversineKm([114.3, 30.6], [114.3, 30.6])).toBe(0);
    });

    it("returns ~0.97km for 0.01° longitude at latitude 30.6°", () => {
      // 1° lon at 30.6°N ≈ 95.9 km, so 0.01° ≈ 0.959 km
      const dist = haversineKm([114.3, 30.6], [114.31, 30.6]);
      expect(dist).toBeCloseTo(0.96, 0);
    });

    it("is symmetric", () => {
      const a: [number, number] = [114.3, 30.6];
      const b: [number, number] = [114.45, 30.55];
      expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a));
    });
  });

  describe("qualityMultiplier", () => {
    it("prefers greenway over service", () => {
      expect(qualityMultiplier("greenway", false)).toBeLessThan(qualityMultiplier("service", false));
    });

    it("trunk is better than secondary", () => {
      expect(qualityMultiplier("trunk", false)).toBeLessThan(qualityMultiplier("secondary", false));
    });

    it("heavily penalises tunnels", () => {
      const trunk = qualityMultiplier("trunk", false);
      const trunkTunnel = qualityMultiplier("trunk", true);
      expect(trunkTunnel).toBe(trunk * 2);
    });
  });

  describe("getElevation", () => {
    it("returns a plausible Wuhan elevation", () => {
      const e = getElevation([114.3, 30.6]);
      expect(e).toBeGreaterThanOrEqual(20);
      expect(e).toBeLessThanOrEqual(120);
    });

    it("is higher near East Lake", () => {
      const flat = getElevation([114.3, 30.6]); // Hankou
      const hill = getElevation([114.4, 30.55]); // East Lake
      expect(hill).toBeGreaterThan(flat);
    });

    it("is deterministic", () => {
      expect(getElevation([114.35, 30.58])).toBe(getElevation([114.35, 30.58]));
    });
  });

  describe("slopePercent", () => {
    it("returns 0 for same point", () => {
      expect(slopePercent([114.3, 30.6], [114.3, 30.6])).toBe(0);
    });

    it("is positive for uphill", () => {
      // East Lake area is higher
      const s = slopePercent([114.3, 30.6], [114.4, 30.55]);
      expect(s).toBeGreaterThan(0);
    });
  });

  describe("turnAngle", () => {
    it("returns ~0 for straight line", () => {
      const a: [number, number] = [114.3, 30.6];
      const b: [number, number] = [114.31, 30.6];
      const c: [number, number] = [114.32, 30.6];
      expect(turnAngle(a, b, c)).toBeCloseTo(0, 0);
    });

    it("returns ~90 for right angle", () => {
      const a: [number, number] = [114.3, 30.6];
      const b: [number, number] = [114.31, 30.6];
      const c: [number, number] = [114.31, 30.61]; // north turn
      expect(turnAngle(a, b, c)).toBeCloseTo(90, -1);
    });
  });
});
