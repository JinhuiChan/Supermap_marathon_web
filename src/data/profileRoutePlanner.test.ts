import { describe, expect, test } from "vitest";
import { buildBestRouteForSelectionProfile, profileRoutePlans, waypointRoutePlans } from "./profileRoutePlanner";

const roadNetwork = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { highway: "primary" },
      geometry: {
        type: "LineString",
        coordinates: [
          [114.3, 30.6],
          [114.31, 30.6],
          [114.32, 30.6],
          [114.33, 30.6],
          [114.34, 30.6]
        ]
      }
    },
    {
      type: "Feature",
      properties: { highway: "secondary" },
      geometry: {
        type: "LineString",
        coordinates: [
          [114.34, 30.6],
          [114.34, 30.61],
          [114.33, 30.61],
          [114.32, 30.61],
          [114.31, 30.61],
          [114.3, 30.61],
          [114.3, 30.6]
        ]
      }
    }
  ]
};

describe("profileRoutePlanner", () => {
  test("keeps configured plans for the two visible selection goals", () => {
    expect(profileRoutePlans).toEqual(expect.objectContaining({
      "pb-friendly": expect.objectContaining({ name: expect.stringContaining("竞速") }),
      scenic: expect.objectContaining({ name: expect.stringContaining("城市体验") })
    }));
  });

  test("returns a single best route bound to the selected profile", () => {
    const route = buildBestRouteForSelectionProfile(roadNetwork, "balanced", {
      targetDistanceKm: 5,
      seedPoints: [[114.3, 30.6]]
    });

    expect(route).not.toBeNull();
    expect(route?.id).toBe("profile-balanced");
    expect(route?.name).toContain("综合平衡");
  });

  test("does not use the deleted official vector route as a full-marathon shortcut", () => {
    const route = buildBestRouteForSelectionProfile(roadNetwork, "scenic");

    expect(route?.lineage?.source).not.toBe("official-road-level");
  });

  test("does not require a bridge for the visible city-experience plan", () => {
    expect(profileRoutePlans.scenic.name).toContain("城市体验");
    expect(profileRoutePlans.scenic.preferredCandidateIds).toContain("osm-scenic");
  });

  test("keeps visible route plans aligned with requested differentiated constraints", () => {
    const eastLake = waypointRoutePlans.find((plan) => plan.id === "waypoint-east-lake");
    const riverside = waypointRoutePlans.find((plan) => plan.id === "waypoint-riverside");
    const cityScenic = waypointRoutePlans.find((plan) => plan.id === "waypoint-city-scenic");

    expect(eastLake).toMatchObject({
      targetDistanceKm: 42.195,
      positioning: expect.stringContaining("PB"),
      audience: expect.stringContaining("专业跑者")
    });
    expect(eastLake?.waypoints).toHaveLength(11);
    expect(eastLake?.waypoints.map((waypoint) => waypoint.coordinate)).toContainEqual([114.3317, 30.5615]);
    expect(eastLake?.features).toEqual(expect.arrayContaining([
      expect.stringContaining("东湖环湖绿道")
    ]));

    expect(riverside).toMatchObject({
      targetDistanceKm: 42.195,
      positioning: expect.stringContaining("全马"),
      audience: expect.stringContaining("新手")
    });
    expect(riverside?.features).toEqual(expect.arrayContaining([
      expect.stringContaining("双江景")
    ]));

    expect(cityScenic).toMatchObject({
      targetDistanceKm: 42.195,
      positioning: expect.stringContaining("文旅"),
      audience: expect.stringContaining("城市宣传")
    });
    expect(cityScenic?.features).toEqual(expect.arrayContaining([
      expect.stringContaining("一城两江三镇")
    ]));
  });
});
