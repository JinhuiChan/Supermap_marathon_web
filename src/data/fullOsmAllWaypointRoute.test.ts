import { describe, expect, it } from "vitest";
import { buildFullOsmAllWaypointRoute, getWaypointHitDistancesM } from "./fullOsmAllWaypointRoute";
import type { WaypointRoutePlan } from "./profileRoutePlanner";

const featureCollection = {
  type: "FeatureCollection",
  features: [
    line([
      [114.0000, 30.0000],
      [114.0100, 30.0000],
      [114.0200, 30.0000],
      [114.0300, 30.0000],
      [114.0400, 30.0000],
      [114.0500, 30.0000]
    ])
  ]
};

const plan: WaypointRoutePlan = {
  id: "waypoint-east-lake",
  name: "East Lake test",
  color: "#00a86b",
  targetDistanceKm: 4,
  waypoints: [
    { label: "start", coordinate: [114.0000, 30.0000] },
    { label: "far", coordinate: [114.0300, 30.0000] },
    { label: "near", coordinate: [114.0100, 30.0000] }
  ],
  note: "",
  description: "",
  positioning: "",
  audience: "",
  features: []
};

describe("buildFullOsmAllWaypointRoute", () => {
  it("builds a target-length route that can hit unordered control points", () => {
    const route = buildFullOsmAllWaypointRoute(featureCollection, plan, { waypointHitRadiusKm: 0.2 });

    expect(route).not.toBeNull();
    expect(route?.lengthKm).toBeGreaterThanOrEqual(3.9);
    expect(route?.lengthKm).toBeLessThanOrEqual(4.1);
    expect(getWaypointHitDistancesM(route!, plan, 0.2).every((hit) => hit.hit)).toBe(true);
  });

  it("extends forward on unused roads instead of filling distance by immediately backtracking", () => {
    const route = buildFullOsmAllWaypointRoute(
      {
        type: "FeatureCollection",
        features: [
          line([
            [114.0000, 30.0000],
            [114.0100, 30.0000],
            [114.0200, 30.0000],
            [114.0300, 30.0000],
            [114.0400, 30.0000],
            [114.0500, 30.0000],
            [114.0600, 30.0000]
          ])
        ]
      },
      {
        ...plan,
        targetDistanceKm: 5,
        waypoints: [
          { label: "start", coordinate: [114.0000, 30.0000] },
          { label: "control", coordinate: [114.0200, 30.0000] }
        ]
      },
      { waypointHitRadiusKm: 0.2 }
    );

    expect(route).not.toBeNull();
    expect(route?.lengthKm).toBeGreaterThanOrEqual(4.9);
    expect(route?.lengthKm).toBeLessThanOrEqual(5.1);
    expect(route?.metrics.repeatedRoadRatio).toBe(0);
    expect(route?.metrics.hairpinTurnCount).toBe(0);
    expect(route?.metrics.parallelBacktrackCount).toBe(0);
  });

  it("chooses a slightly longer control-link candidate when the shortest one self-intersects", () => {
    const route = buildFullOsmAllWaypointRoute(
      {
        type: "FeatureCollection",
        features: [
          line([
            [114.0000, 30.0000],
            [114.0300, 30.0100],
            [114.0000, 30.0100],
            [114.0300, 30.0000]
          ]),
          line([
            [114.0000, 30.0000],
            [114.0000, 29.9700],
            [114.0300, 29.9700],
            [114.0300, 30.0000]
          ])
        ]
      },
      {
        ...plan,
        targetDistanceKm: 10,
        waypoints: [
          { label: "start", coordinate: [114.0000, 30.0000] },
          { label: "finish", coordinate: [114.0300, 30.0000] }
        ]
      },
      { waypointHitRadiusKm: 0.2 }
    );

    expect(route).not.toBeNull();
    expect(route?.metrics.selfIntersectionCount).toBe(0);
  });
});

function line(coordinates: number[][]) {
  return {
    type: "Feature",
    properties: { highway: "primary" },
    geometry: { type: "LineString", coordinates }
  };
}
