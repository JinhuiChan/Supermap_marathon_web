import { describe, expect, it } from "vitest";
import { supportPoints } from "../../data/supportPoints";
import { computeSupportPointStyle, formatSupportPointLabel, toLeafletLatLng } from "./SupportPointLayer";

describe("SupportPointLayer", () => {
  it("converts support point coordinates to Leaflet lat/lng order", () => {
    expect(toLeafletLatLng(supportPoints[0])).toEqual([30.584, 114.292]);
  });

  it("uses distinct visual styles for different support point types", () => {
    const supply = supportPoints.find((point) => point.type === "补给")!;
    const medical = supportPoints.find((point) => point.type === "医疗")!;

    expect(computeSupportPointStyle(supply, true).fillColor).not.toBe(
      computeSupportPointStyle(medical, true).fillColor
    );
    expect(computeSupportPointStyle(supply, true).radius).toBeGreaterThan(
      computeSupportPointStyle(supply, false).radius
    );
  });

  it("formats a readable point label", () => {
    expect(formatSupportPointLabel(supportPoints[0])).toBe("两江四岸起终点 · 起终点 · A级");
  });
});
