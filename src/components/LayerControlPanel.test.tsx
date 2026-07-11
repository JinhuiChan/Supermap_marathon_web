import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LayerControlPanel } from "./LayerControlPanel";

describe("LayerControlPanel", () => {
  it("keeps the basemap fixed to the iDesktop-published map and omits support-point toggles", () => {
    const html = renderToStaticMarkup(
      <LayerControlPanel
        visibility={{ routes: true, roadNetwork: true }}
        onChange={() => {}}
      />
    );

    expect(html).toContain("iDesktop 发布图");
    expect(html).toContain("比赛指定底图");
    expect(html).toContain("武汉道路网络");
    expect(html).not.toContain("OpenStreetMap");
    expect(html).not.toContain("本地矢量街道图");
    expect(html).not.toContain("赛事服务点");
  });
});
