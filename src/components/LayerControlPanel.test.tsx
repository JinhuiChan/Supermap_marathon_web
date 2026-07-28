import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { activeCityPackage } from "../config/cityPackages";
import { LayerControlPanel } from "./LayerControlPanel";

describe("LayerControlPanel", () => {
  it("keeps the basemap fixed and offers a support planning layer toggle", () => {
    const html = renderToStaticMarkup(
      <LayerControlPanel
        visibility={{ routes: true, roadNetwork: true, supportPlanning: true }}
        cityPackage={activeCityPackage}
        onChange={() => {}}
      />
    );

    expect(html).toContain("iClient 地图服务");
    expect(html).toContain("比赛指定 iServer REST 底图");
    expect(html).toContain("武汉道路网络");
    expect(html).not.toContain("OpenStreetMap");
    expect(html).not.toContain("本地矢量街道图");
    expect(html).not.toContain("赛事服务点");
    expect(html).toContain("保障规划点");
    expect(html).toContain("显示补给、医疗、厕所和引导建议点");
  });

  it("labels the road network layer from the provided city package", () => {
    const html = renderToStaticMarkup(
      <LayerControlPanel
        visibility={{ routes: true, roadNetwork: true, supportPlanning: true }}
        cityPackage={{ ...activeCityPackage, name: "测试城市" }}
        onChange={() => {}}
      />
    );

    expect(html).toContain("测试城市道路网络");
    expect(html).not.toContain("武汉道路网络");
  });
});
