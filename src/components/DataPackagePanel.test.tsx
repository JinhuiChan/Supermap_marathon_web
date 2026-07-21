import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { buildWaypointCsv, DataPackagePanel } from "./DataPackagePanel";

describe("DataPackagePanel", () => {
  test("offers a SuperMap-ready waypoint CSV export", () => {
    const html = renderToStaticMarkup(<DataPackagePanel />);
    const csv = buildWaypointCsv();

    expect(html).toContain("wuhan-marathon-waypoints.csv");
    expect(csv).toContain('"route_id","route_name","sequence","label","longitude","latitude","target_distance_km"');
    expect(csv).toContain('"waypoint-riverside","滨江线","1","起点：三阳路沿江大道","114.30230","30.60287","42.195"');
    expect(csv).toContain('"114.33170","30.56150"');
  });
});
