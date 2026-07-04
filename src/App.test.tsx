import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the marathon route workbench", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("gis-mode-nav");
    expect(html).toContain("智能选型");
    expect(html).toContain("赛道分析");
    expect(html).toContain("空间约束");
    expect(html).toContain("选择起点");
    expect(html).toContain("选择终点");
    expect(html).toContain("起点：未设置");
    expect(html).toContain("终点：未设置");
    expect(html).toContain("请先在地图上设置起点和终点");
    expect(html).toContain("POI 服务权重");
    expect(html).toContain("阻力因子");
    expect(html).toContain("候选方案");
    expect(html).not.toContain("2026 Wuhan Marathon official route reference");
    expect(html).toContain("SuperMap iServer");
    expect(html).toContain("iClient JavaScript");
    expect(html).toContain("ASTGTMV003_N30E114");
    expect(html).toContain("wuhan-marathon-routes.geojson");
    expect(html).not.toContain("Two Rivers Four Banks");
  });

  it("keeps route selection controls visible when candidate routes are hidden on the map", () => {
    const html = renderToStaticMarkup(
      <App initialLayerVisibility={{ routes: false, supportPoints: true, roadNetwork: true }} />
    );

    expect(html).toContain("gis-selection-panel");
    expect(html).toContain("选择起点");
    expect(html).toContain("请先在地图上设置起点和终点");
  });
});
