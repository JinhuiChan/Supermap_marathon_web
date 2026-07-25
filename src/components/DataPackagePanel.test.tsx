import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { activeCityPackage } from "../config/cityPackages";
import type { Coordinate } from "../domain/routeMetrics";
import { buildWaypointCsv, DataPackagePanel } from "./DataPackagePanel";

describe("DataPackagePanel", () => {
  test("offers a SuperMap-ready waypoint CSV export", () => {
    const html = renderToStaticMarkup(<DataPackagePanel />);
    const csv = buildWaypointCsv();

    expect(html).toContain("城市包完整度");
    expect(html).toContain("9/9");
    expect(html).toContain("wuhan-marathon-waypoints.csv");
    expect(csv).toContain('"route_id","route_name","sequence","label","longitude","latitude","target_distance_km"');
    expect(csv).toContain('"waypoint-riverside","滨江线","1","起点：三阳路沿江大道","114.30230","30.60287","42.195"');
    expect(csv).toContain('"114.33170","30.56150"');
  });

  test("builds waypoint CSV from provided city route plans", () => {
    const customPlan = {
      ...activeCityPackage.routePlans[0],
      id: "test-city-fast",
      name: "测试城市竞速线",
      waypoints: [
        { label: "起点：测试大道", coordinate: [120.12345, 31.12345] as Coordinate }
      ]
    };
    const csv = buildWaypointCsv([customPlan]);

    expect(csv).toContain('"test-city-fast","测试城市竞速线","1","起点：测试大道","120.12345","31.12345"');
    expect(csv).not.toContain("waypoint-riverside");
  });
});
