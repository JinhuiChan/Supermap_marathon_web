import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App, { routeCompareLimit, updateComparedRouteIds } from "./App";

describe("App", () => {
  it("renders the marathon route workbench without the deleted official vector route", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("gis-mode-nav");
    expect(html).toContain("武汉马拉松赛道空间选线平台");
    expect(html).toContain("智能选型");
    expect(html).toContain("赛道分析");
    expect(html).not.toContain("采用当前推荐");
    expect(html).toContain("硬性合规规则");
    expect(html).toContain("东湖线");
    expect(html).toContain("城市景观线");
    expect(html).toContain("等待合规路线");
    expect(html).toContain("规划结果不替代 World Athletics / AIMS 认证测量");
    expect(html).not.toContain("选择起点");
    expect(html).not.toContain("选择终点");
    expect(html).not.toContain("官方道路级矢量路线");
    expect(html).not.toContain("2026 Wuhan Marathon official route reference");
    expect(html).not.toContain("POI 参数预览");
    expect(html).not.toContain("阻力参数预览");
    expect(html).not.toContain("候选方案");
    expect(html).toContain("GIS 详情");
    expect(html).toContain('class="gis-utility-details"');
    expect(html).not.toContain("OpenStreetMap");
    expect(html).toContain("iClient JavaScript");
    expect(html).toContain("ASTGTMV003_N30E114");
    expect(html).toContain("wuhan-marathon-routes.geojson");
    expect(html).toContain("Routing data");
    expect(html).toContain("Full OSM");
    expect(html).not.toContain("Area roads");
    expect(html).not.toMatch(/姝|閲|杩|闃|鍙|璧|绾|鍔|鐐/);
  });

  it("keeps route selection controls visible when candidate routes are hidden on the map", () => {
    const html = renderToStaticMarkup(
      <App initialLayerVisibility={{ routes: false, roadNetwork: true }} />
    );

    expect(html).toContain("gis-selection-panel");
    expect(html).toContain("选择路线");
    expect(html).toContain("重复道路 0%");
  });

  it("does not render the candidate route drawer before any route is generated", () => {
    const html = renderToStaticMarkup(<App />);
    const selectionDock = html.match(/<aside class="gis-selection-dock"[\s\S]*?<\/aside>/)?.[0] ?? "";

    expect(selectionDock).not.toContain("candidate-route-drawer");
    expect(html).not.toContain("candidate-route-drawer");
    expect(html).not.toContain("has-candidates");
  });

  it("limits route comparison to the three configured route plans", () => {
    expect(routeCompareLimit).toBe(3);
    expect(updateComparedRouteIds(["east", "riverside", "city"], "extra")).toEqual(["east", "riverside", "city"]);
    expect(updateComparedRouteIds(["east", "riverside"], "city")).toEqual(["east", "riverside", "city"]);
  });
});
