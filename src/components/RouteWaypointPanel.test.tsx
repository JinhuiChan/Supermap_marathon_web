import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouteWaypointPanel } from "./RouteWaypointPanel";

describe("RouteWaypointPanel", () => {
  it("shows the selected route start, intermediate control points, and finish", () => {
    const html = renderToStaticMarkup(<RouteWaypointPanel activeRouteId="waypoint-riverside" />);

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
    const html = renderToStaticMarkup(<RouteWaypointPanel activeRouteId="" />);

    expect(html).toContain("点击生成或选择路线后查看");
    expect(html).not.toContain("<ol");
  });
});
