import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResizeHandle, resizeDeltaForKey, shouldResetFromClickDetail } from "./ResizeHandle";

describe("ResizeHandle", () => {
  it("renders an accessible separator with the current value", () => {
    const html = renderToStaticMarkup(
      <ResizeHandle
        orientation="vertical"
        ariaLabel="调整侧边栏宽度"
        value={380}
        min={320}
        max={520}
        onResize={() => {}}
        onReset={() => {}}
      />
    );

    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain('aria-valuenow="380"');
    expect(html).toContain('tabindex="0"');
  });

  it("maps arrow keys to resize deltas for each orientation", () => {
    expect(resizeDeltaForKey("ArrowLeft", "vertical", false)).toBe(-10);
    expect(resizeDeltaForKey("ArrowRight", "vertical", true)).toBe(24);
    expect(resizeDeltaForKey("ArrowUp", "horizontal", false)).toBe(-10);
    expect(resizeDeltaForKey("ArrowDown", "horizontal", true)).toBe(24);
    expect(resizeDeltaForKey("ArrowDown", "vertical", false)).toBeNull();
  });

  it("treats the second click as a reset gesture across browser event variants", () => {
    expect(shouldResetFromClickDetail(1)).toBe(false);
    expect(shouldResetFromClickDetail(2)).toBe(true);
    expect(shouldResetFromClickDetail(3)).toBe(true);
  });
});
