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
});
