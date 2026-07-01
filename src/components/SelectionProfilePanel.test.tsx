import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { SelectionProfilePanel } from "./SelectionProfilePanel";

describe("SelectionProfilePanel", () => {
  test("renders route selection profiles", () => {
    const html = renderToStaticMarkup(
      <SelectionProfilePanel activeProfile="balanced" onProfileChange={() => {}} onApplyRecommendation={() => {}} />
    );

    expect(html).toContain("智能选型目标");
    expect(html).toContain("综合平衡");
    expect(html).toContain("PB 竞速");
    expect(html).toContain("保障优先");
  });

  test("notifies when a profile is selected", () => {
    const onProfileChange = vi.fn();
    const panel = SelectionProfilePanel({
      activeProfile: "balanced",
      onProfileChange,
      onApplyRecommendation: () => {}
    });
    const profileButton = panel.props.children[1].props.children[1];

    profileButton.props.onClick();

    expect(onProfileChange).toHaveBeenCalledWith("pb-friendly");
  });
});
