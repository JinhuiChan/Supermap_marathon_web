import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the marathon route workbench", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("候选赛道库");
    expect(html).toContain("武汉 WebGIS 赛道工作台");
    expect(html).toContain("2026武汉马拉松官方路线");
    expect(html).toContain("两江四岸平缓备选线");
    expect(html).toContain("推荐方案");
    expect(html).toContain("导出对比报告");
    expect(html).toContain("SuperMap iServer");
    expect(html).toContain("iClient JavaScript");
    expect(html).toContain("二维地图服务");
    expect(html).toContain("ASTGTMV003_N30E114");
    expect(html).toContain("GIS 数据包");
    expect(html).toContain("wuhan-marathon-routes.geojson");
  });
});
