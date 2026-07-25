import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouteWaypointPanel } from "./RouteWaypointPanel";
import { activeCityPackage } from "../config/cityPackages";
import type { Coordinate } from "../domain/routeMetrics";

describe("RouteWaypointPanel", () => {
  it("shows the selected route start, intermediate control points, and finish", () => {
    const html = renderToStaticMarkup(
      <RouteWaypointPanel activeRouteId="waypoint-riverside" routePlans={activeCityPackage.routePlans} />
    );

    expect(html).toContain("当前路线控制点");
    expect(html).toContain("滨江线");
    expect(html).toContain("起点");
    expect(html).toContain("途经控制点");
    expect(html).toContain("终点");
    expect(html).toContain("三阳路沿江大道");
    expect(html).toContain("江汉关钟楼");
    expect(html).toContain("青山江滩");
    expect(html).toContain("114.30230, 30.60287");
  });

  it("renders an empty state before a route is selected", () => {
    const html = renderToStaticMarkup(<RouteWaypointPanel activeRouteId="" routePlans={activeCityPackage.routePlans} />);

    expect(html).toContain("点击生成或选择路线后查看");
    expect(html).not.toContain("<ol");
  });

  it("uses the provided city package route plans for waypoint lookup", () => {
    const customPlan = {
      ...activeCityPackage.routePlans[0],
      id: "test-city-fast",
      name: "测试城市竞速线",
      waypoints: [
        { label: "起点：测试大道", coordinate: [120.12345, 31.12345] as Coordinate },
        { label: "终点：测试体育中心", coordinate: [120.22345, 31.22345] as Coordinate }
      ]
    };
    const html = renderToStaticMarkup(
      <RouteWaypointPanel activeRouteId="test-city-fast" routePlans={[customPlan]} />
    );

    expect(html).toContain("测试城市竞速线");
    expect(html).toContain("测试大道");
    expect(html).toContain("120.12345, 31.12345");
  });
});
