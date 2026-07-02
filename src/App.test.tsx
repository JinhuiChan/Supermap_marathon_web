import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the marathon route workbench", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("候选赛道库");
    expect(html).toContain("智能选型目标");
    expect(html).toContain("PB 竞速");
    expect(html).toContain("2026 Wuhan Marathon official route reference");
    expect(html).toContain("SuperMap iServer");
    expect(html).toContain("iClient JavaScript");
    expect(html).toContain("ASTGTMV003_N30E114");
    expect(html).toContain("wuhan-marathon-routes.geojson");
    expect(html).toContain("汉马道路走廊");
    expect(html).not.toContain("两江四岸");
  });

  it("hides route selection controls when candidate routes are hidden", () => {
    const html = renderToStaticMarkup(
      <App initialLayerVisibility={{ routes: false, supportPoints: true, roadNetwork: true }} />
    );

    expect(html).not.toContain("智能选型目标");
    expect(html).not.toContain("候选赛道库");
  });
});
