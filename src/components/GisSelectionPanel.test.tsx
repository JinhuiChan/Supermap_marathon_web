import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GisSelectionPanel, defaultGisPlanningSettings } from "./GisSelectionPanel";

function renderPanel(overrides: Partial<Parameters<typeof GisSelectionPanel>[0]> = {}) {
  return renderToStaticMarkup(
    <GisSelectionPanel
      settings={defaultGisPlanningSettings}
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
  });

  it("explains why route generation is disabled", () => {
    const html = renderPanel({ canGenerate: false, generateDisabledReason: "道路网络数据仍在加载" });
    expect(html).toContain("道路网络数据仍在加载");
    expect(html).toContain('title="道路网络数据仍在加载"');
  });

  it("offers two distinct goals whose hard rules stay identical", () => {
    const html = renderPanel();
    expect(html).toContain("竞速平坦");
    expect(html).toContain("城市体验");
    expect((html.match(/class="[^"]*gis-profile-option/g) ?? [])).toHaveLength(2);
    expect(html).toContain("两种目标共享同一组硬性合规规则，仅改变合格路线的走廊与排序偏好");
  });

  it("puts the decision flow ahead of implementation parameters", () => {
    const html = renderPanel();
    expect(html).toContain("1. 选择目标");
    expect(html).toContain("2. 核对硬规则");
    expect(html).toContain("3. 生成路线");
    expect(html).not.toContain("POI 参数预览");
    expect(html).not.toContain("阻力参数预览");
    expect(html).not.toContain("推荐路线场景");
  });

  it("shows the enforceable marathon route thresholds", () => {
    const html = renderPanel();
    expect(html).toContain("42.195–42.237 km");
    expect(html).not.toContain("21.0975");
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
