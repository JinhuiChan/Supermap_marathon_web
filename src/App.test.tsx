import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the marathon route workbench", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("selection-profile-panel");
    expect(html).toContain("route-generator-actions");
    expect(html).toContain("2026 Wuhan Marathon official route reference");
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

    expect(html).toContain("selection-profile-panel");
    expect(html).toContain("route-generator-actions");
  });
});
