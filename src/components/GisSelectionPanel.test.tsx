import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GisSelectionPanel,
  defaultGisPlanningSettings
} from "./GisSelectionPanel";

describe("GisSelectionPanel", () => {
  it("shows immediate feedback while the route model is running", () => {
    const html = renderToStaticMarkup(
      <GisSelectionPanel
        activeProfile="balanced"
        settings={defaultGisPlanningSettings}
        canGenerate
        isGenerating
        startPoint={[114.3, 30.6]}
        endPoint={[114.4, 30.62]}
        activePointTool={null}
        onProfileChange={() => {}}
        onWeightChange={() => {}}
        onPointToolChange={() => {}}
        onClearPlanningPoints={() => {}}
        onGenerateRoutes={() => {}}
      />
    );

    expect(html).toContain("正在计算");
    expect(html).toContain("disabled");
  });

  it("explains why route generation is disabled", () => {
    const html = renderToStaticMarkup(
      <GisSelectionPanel
        activeProfile="balanced"
        settings={defaultGisPlanningSettings}
        canGenerate={false}
        generateDisabledReason="道路网络数据仍在加载"
        startPoint={[114.3, 30.6]}
        endPoint={[114.4, 30.62]}
        activePointTool={null}
        onProfileChange={() => {}}
        onWeightChange={() => {}}
        onPointToolChange={() => {}}
        onClearPlanningPoints={() => {}}
        onGenerateRoutes={() => {}}
      />
    );

    expect(html).toContain("道路网络数据仍在加载");
    expect(html).toContain('title="道路网络数据仍在加载"');
  });
});
