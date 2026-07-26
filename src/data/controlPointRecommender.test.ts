import { describe, expect, test } from "vitest";
import { wuhanRoutingProfile } from "../config/cityRoutingProfiles";
import { supportPoints } from "./supportPoints";
import { recommendAutoControlPointRoutePlan } from "./controlPointRecommender";
import { waypointRoutePlans } from "./profileRoutePlanner";
import { wuhanLandmarkPoiLabels } from "./wuhanLandmarks";

describe("controlPointRecommender", () => {
  test("builds an explainable auto-recommended marathon route plan from city data", () => {
    const plan = recommendAutoControlPointRoutePlan({
      cityId: "wuhan",
      manualRoutePlans: waypointRoutePlans,
      landmarks: wuhanLandmarkPoiLabels,
      supportPoints,
      routingProfile: wuhanRoutingProfile
    });

    expect(plan).toMatchObject({
      id: "waypoint-auto-recommended",
      targetDistanceKm: 42.195,
      controlPointMode: "auto-recommended",
      selectionProfile: "balanced"
    });
    expect(plan.waypoints.length).toBeGreaterThanOrEqual(8);
    expect(plan.recommendationBasis?.length).toBeGreaterThanOrEqual(3);
    expect(plan.waypoints[0].coordinate).toEqual(waypointRoutePlans[0].waypoints[0].coordinate);
    expect(plan.waypoints.at(-1)?.coordinate).toEqual(waypointRoutePlans[0].waypoints.at(-1)?.coordinate);
    expect(plan.seedPoints).toEqual(expect.arrayContaining([
      wuhanLandmarkPoiLabels[2].coordinate
    ]));
  });

  test("does not mutate the existing manually configured route plans", () => {
    const before = waypointRoutePlans.map((plan) => ({
      id: plan.id,
      waypointCount: plan.waypoints.length,
      first: plan.waypoints[0].coordinate,
      last: plan.waypoints.at(-1)?.coordinate
    }));

    recommendAutoControlPointRoutePlan({
      cityId: "wuhan",
      manualRoutePlans: waypointRoutePlans,
      landmarks: wuhanLandmarkPoiLabels,
      supportPoints,
      routingProfile: wuhanRoutingProfile
    });

    expect(waypointRoutePlans.map((plan) => ({
      id: plan.id,
      waypointCount: plan.waypoints.length,
      first: plan.waypoints[0].coordinate,
      last: plan.waypoints.at(-1)?.coordinate
    }))).toEqual(before);
  });
});
