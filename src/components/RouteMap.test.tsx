import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { activeCityPackage } from "../config/cityPackages";
import { RouteMap } from "./RouteMap";

describe("RouteMap", () => {
  it("uses the provided city package route-plan count in the fallback map toolbar", () => {
    const html = renderToStaticMarkup(
      <RouteMap
        routes={[]}
        activeRouteId=""
        comparedRouteIds={["one", "two"]}
        routePlans={activeCityPackage.routePlans.slice(0, 2)}
        cityPackage={{ ...activeCityPackage, name: "测试城市", displayName: "测试城市马拉松" }}
        onSelectRoute={() => {}}
      />
    );

    expect(html).toContain("测试城市 WebGIS 赛道工作台");
    expect(html).toContain("2/2 已加入对比");
    expect(html).not.toContain("武汉 WebGIS");
    expect(html).not.toContain("2/3 已加入对比");
  });
});
