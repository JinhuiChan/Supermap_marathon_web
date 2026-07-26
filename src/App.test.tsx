import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App, { routeCompareLimit, updateComparedRouteIds, upsertManualRoutePlan } from "./App";
import { activeCityPackage, type CityPackage } from "./config/cityPackages";

describe("App", () => {
  it("renders the marathon route workbench without the deleted official vector route", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("gis-mode-nav");
    expect(html).toContain("马拉松赛道空间选线平台");
    expect(html).not.toContain("武汉马拉松赛道空间选线平台");
    expect(html).toContain("智能选型");
    expect(html).toContain("赛道分析");
    expect(html).not.toContain("采用当前推荐");
    expect(html).toContain("硬性合规规则");
    expect(html).not.toContain("东湖线");
    expect(html).not.toContain("滨江线");
    expect(html).not.toContain("城市景观线");
    expect(html).toContain("手动推荐线");
    expect(html).toContain("等待候选路线");
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
    expect(html).not.toContain("iClient3D");
    expect(html).not.toContain("三维");
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
    expect(html).toContain("添加控制点");
    expect(html).toContain("重复道路 0%");
  });

  it("does not render the candidate route drawer before any route is generated", () => {
    const html = renderToStaticMarkup(<App />);
    const selectionDock = html.match(/<aside class="gis-selection-dock"[\s\S]*?<\/aside>/)?.[0] ?? "";

    expect(selectionDock).not.toContain("candidate-route-drawer");
    expect(html).not.toContain("candidate-route-drawer");
    expect(html).not.toContain("has-candidates");
  });

  it("limits route comparison to the configured city package route plans", () => {
    expect(routeCompareLimit).toBe(activeCityPackage.routePlans.length);
    expect(updateComparedRouteIds(["east", "riverside", "auto"], "extra")).toEqual(["east", "riverside", "auto"]);
    expect(updateComparedRouteIds(["east", "riverside"], "auto")).toEqual(["east", "riverside", "auto"]);
    expect(updateComparedRouteIds(["east", "riverside"], "city")).toEqual(["east", "riverside", "city"]);
  });

  it("adds user-entered manual route plans without replacing preset routes", () => {
    const manualPlan = {
      ...activeCityPackage.routePlans[0],
      id: "manual-user-1",
      name: "用户手动路线",
      controlPointSourceLabel: "用户手动输入控制点"
    };
    const next = upsertManualRoutePlan(activeCityPackage.routePlans, manualPlan);
    const updated = upsertManualRoutePlan(next, { ...manualPlan, name: "用户手动路线二次编辑" });

    expect(next.slice(0, activeCityPackage.routePlans.length)).toEqual(activeCityPackage.routePlans);
    expect(next.at(-1)).toBe(manualPlan);
    expect(updated).toHaveLength(next.length);
    expect(updated.at(-1)?.name).toBe("用户手动路线二次编辑");
  });

  it("keeps multiple user-entered manual route plans when their ids differ", () => {
    const firstManualPlan = {
      ...activeCityPackage.routePlans[0],
      id: "manual-user-1",
      name: "手动推荐线"
    };
    const secondManualPlan = {
      ...activeCityPackage.routePlans[0],
      id: "manual-user-2",
      name: "现场补充线"
    };

    const withFirst = upsertManualRoutePlan(activeCityPackage.routePlans, firstManualPlan);
    const withBoth = upsertManualRoutePlan(withFirst, secondManualPlan);

    expect(withBoth).toHaveLength(activeCityPackage.routePlans.length + 2);
    expect(withBoth.slice(-2).map((plan) => plan.name)).toEqual(["手动推荐线", "现场补充线"]);
  });

  it("can render from a provided city package instead of hard-coded Wuhan data", () => {
    const customPlan = {
      ...activeCityPackage.routePlans[0],
      id: "test-city-fast",
      name: "测试城市竞速线",
      description: "测试城市赛道走廊",
      audience: "测试跑者",
      features: ["测试城市路线亮点"]
    };
    const testCityPackage: CityPackage = {
      ...activeCityPackage,
      id: "test-city",
      name: "测试城市",
      displayName: "测试城市马拉松",
      marathonName: "测试城市马拉松选线平台",
      routePlans: [customPlan],
      supportPoints: [],
      landmarks: []
    };

    const html = renderToStaticMarkup(<App cityPackage={testCityPackage} />);

    expect(html).toContain("测试城市马拉松选线平台");
    expect(html).not.toContain("测试城市竞速线");
    expect(html).not.toContain("滨江线");
  });
});
