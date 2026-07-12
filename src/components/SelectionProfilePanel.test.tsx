import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { SelectionProfilePanel } from "./SelectionProfilePanel";

describe("SelectionProfilePanel", () => {
  test("renders route selection profiles", () => {
    const html = renderToStaticMarkup(
      <SelectionProfilePanel activeProfile="pb-friendly" onProfileChange={() => {}} onApplyRecommendation={() => {}} />
    );

    expect(html).toContain("智能选型目标");
    expect(html).toContain("竞速平坦");
    expect(html).toContain("城市体验");
  });

  test("notifies when a profile is selected", () => {
    const onProfileChange = vi.fn();
    const panel = SelectionProfilePanel({
      activeProfile: "support-first",
      onProfileChange,
      onApplyRecommendation: () => {}
    });
    const profileButton = panel.props.children[1].props.children[0];

    profileButton.props.onClick();

    expect(onProfileChange).toHaveBeenCalledWith("pb-friendly");
  });
});
