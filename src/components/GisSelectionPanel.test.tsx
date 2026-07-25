import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GisSelectionPanel, defaultGisPlanningSettings } from "./GisSelectionPanel";
import { activeCityPackage } from "../config/cityPackages";

function renderPanel(overrides: Partial<Parameters<typeof GisSelectionPanel>[0]> = {}) {
  return renderToStaticMarkup(
    <GisSelectionPanel
      settings={defaultGisPlanningSettings}
      routePlans={activeCityPackage.routePlans}
      canGenerate
      onGenerateRoute={() => {}}
      {...overrides}
    />
  );
}

describe("GisSelectionPanel", () => {
  it("shows immediate feedback while the route model is running", () => {
    const html = renderPanel({ isGenerating: true });
    expect(html).toContain("正在搜索合规路线");
    expect(html).toContain("disabled");
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain("gis-generation-progress");
  });

  it("explains why route generation is disabled", () => {
    const html = renderPanel({ canGenerate: false, generateDisabledReason: "道路网络数据仍在加载" });
    expect(html).toContain("道路网络数据仍在加载");
    expect(html).toContain('title="道路网络数据仍在加载"');
  });

  it("uses full OSM as the only routing network source", () => {
    const html = renderPanel();

    expect(html).toContain("Routing data");
    expect(html).not.toContain("Area roads");
    expect(html).toContain("Full OSM");
    expect(html).toContain("38MB");
  });

  it("offers three route corridor options whose hard rules stay identical", () => {
    const html = renderPanel();
    expect(html).toContain("东湖线");
    expect(html).toContain("滨江线");
    expect(html).toContain("城市景观线");
    expect((html.match(/class="[^"]*gis-waypoint-route-button/g) ?? [])).toHaveLength(3);
    expect(html).toContain("硬性合规规则");
  });

  it("renders route buttons from the provided city package route plans", () => {
    const customPlan = {
      ...activeCityPackage.routePlans[0],
      id: "test-city-fast",
      name: "测试城市竞速线",
      description: "测试城市道路走廊",
      audience: "测试跑者",
      features: ["测试城市路线亮点"]
    };
    const html = renderPanel({ routePlans: [customPlan] });

    expect(html).toContain("测试城市竞速线");
    expect(html).toContain("测试城市道路走廊");
    expect(html).not.toContain("婊ㄦ睙绾?");
    expect((html.match(/class="[^"]*gis-waypoint-route-button/g) ?? [])).toHaveLength(1);
  });

  it("puts the decision flow ahead of implementation parameters", () => {
    const html = renderPanel();
    expect(html).toContain("1. 选择路线");
    expect(html).toContain("2. 硬性合规规则");
    expect(html).toContain("3. 生成路线");
    expect(html).not.toContain("POI 参数预览");
    expect(html).not.toContain("阻力参数预览");
    expect(html).not.toContain("推荐路线场景");
  });

  it("shows the enforceable marathon route thresholds", () => {
    const html = renderPanel();
    expect(html).toContain("42.195–42.237 km");
    expect(html).not.toContain("21.0975 km");
    expect(html).toContain("起终点净下降 ≤ 42.195 m");
    expect(html).toContain("累计爬升 ≤ 180 m");
    expect(html).toContain("重复道路 0%");
    expect(html).toContain("自交 0");
    expect(html).toContain("交叉口复访 0");
    expect(html).toContain("平行折返 0");
    expect(html).toContain("发卡掉头 0");
    expect(html).toContain("路网连续误差 ≤ 10 m");
  });
});
