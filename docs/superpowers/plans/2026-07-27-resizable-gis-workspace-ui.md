# Resizable GIS Workspace UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the WebGIS information hierarchy and add persistent, accessible drag resizing for the sidebar, waypoint panel, and candidate-route bottom panel without changing business behavior.

**Architecture:** Keep business state and map behavior in `App.tsx`, add a focused pure sizing module for limits and persistence, and add one reusable separator component for pointer and keyboard input. Drive the existing CSS Grid with three CSS custom properties so layout changes remain presentation-only.

**Tech Stack:** React 19, TypeScript 5.8, CSS Grid, Pointer Events, localStorage, Vitest, React server rendering tests.

---

## File map

- Create `src/layout/workspaceSizing.ts`: defaults, limits, clamping, viewport-aware maxima, and safe persistence helpers.
- Create `src/layout/workspaceSizing.test.ts`: unit tests for all sizing and persistence behavior.
- Create `src/components/ResizeHandle.tsx`: reusable accessible pointer/keyboard separator.
- Create `src/components/ResizeHandle.test.tsx`: server-rendered accessibility contract and key-delta unit tests.
- Modify `src/App.tsx`: own the three presentation-only dimensions, inject CSS variables, and render separators.
- Modify `src/App.test.tsx`: verify the static workspace contains only the separators appropriate to its current state.
- Modify `src/styles.css`: consume CSS variables, style separators, widen and clarify information panels, and disable resizing in the mobile flow.

### Task 1: Workspace sizing primitives

**Files:**
- Create: `src/layout/workspaceSizing.test.ts`
- Create: `src/layout/workspaceSizing.ts`

- [ ] **Step 1: Write failing sizing and persistence tests**

```ts
import { describe, expect, it } from "vitest";
import {
  WORKSPACE_SIZE_DEFAULTS,
  clampWorkspaceSize,
  getCandidateHeightMax,
  getSidebarWidthMax,
  getWaypointHeightMax,
  readStoredWorkspaceSize,
  writeStoredWorkspaceSize
} from "./workspaceSizing";

describe("workspaceSizing", () => {
  it("clamps dimensions to their valid range", () => {
    expect(clampWorkspaceSize(200, 320, 520)).toBe(320);
    expect(clampWorkspaceSize(440, 320, 520)).toBe(440);
    expect(clampWorkspaceSize(900, 320, 520)).toBe(520);
  });

  it("keeps enough viewport space for the map and top panel", () => {
    expect(getSidebarWidthMax(1280)).toBe(520);
    expect(getSidebarWidthMax(900)).toBeLessThan(520);
    expect(getWaypointHeightMax(720)).toBeGreaterThanOrEqual(WORKSPACE_SIZE_DEFAULTS.waypointHeight);
    expect(getCandidateHeightMax(720)).toBeGreaterThanOrEqual(WORKSPACE_SIZE_DEFAULTS.candidateHeight);
  });

  it("reads valid persisted sizes and rejects invalid values", () => {
    const values = new Map<string, string>([
      ["valid", "412"],
      ["invalid", "wide"],
      ["too-large", "900"]
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };

    expect(readStoredWorkspaceSize(storage, "valid", 380, 320, 520)).toBe(412);
    expect(readStoredWorkspaceSize(storage, "invalid", 380, 320, 520)).toBe(380);
    expect(readStoredWorkspaceSize(storage, "too-large", 380, 320, 520)).toBe(520);
  });

  it("persists numeric values without failing when storage is unavailable", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };

    writeStoredWorkspaceSize(storage, "sidebar", 420);
    expect(values.get("sidebar")).toBe("420");
    expect(() => writeStoredWorkspaceSize(null, "sidebar", 420)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run:

```powershell
npm.cmd test -- src/layout/workspaceSizing.test.ts
```

Expected: FAIL because `./workspaceSizing` does not exist.

- [ ] **Step 3: Implement the sizing module**

```ts
export interface WorkspaceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const WORKSPACE_SIZE_DEFAULTS = {
  sidebarWidth: 380,
  waypointHeight: 190,
  candidateHeight: 240
} as const;

export const WORKSPACE_SIZE_LIMITS = {
  sidebarWidth: { min: 320, max: 520 },
  waypointHeight: { min: 140, max: 360 },
  candidateHeight: { min: 180, max: 420 }
} as const;

export const WORKSPACE_STORAGE_KEYS = {
  sidebarWidth: "supermap.workspace.sidebar-width",
  waypointHeight: "supermap.workspace.waypoint-height",
  candidateHeight: "supermap.workspace.candidate-height"
} as const;

export function clampWorkspaceSize(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function getSidebarWidthMax(viewportWidth: number): number {
  return clampWorkspaceSize(
    viewportWidth - 392,
    WORKSPACE_SIZE_LIMITS.sidebarWidth.min,
    WORKSPACE_SIZE_LIMITS.sidebarWidth.max
  );
}

export function getWaypointHeightMax(viewportHeight: number): number {
  return clampWorkspaceSize(
    (viewportHeight - 88) * 0.55,
    WORKSPACE_SIZE_DEFAULTS.waypointHeight,
    WORKSPACE_SIZE_LIMITS.waypointHeight.max
  );
}

export function getCandidateHeightMax(viewportHeight: number): number {
  return clampWorkspaceSize(
    viewportHeight - 348,
    WORKSPACE_SIZE_DEFAULTS.candidateHeight,
    WORKSPACE_SIZE_LIMITS.candidateHeight.max
  );
}

export function readStoredWorkspaceSize(
  storage: WorkspaceStorage | null,
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  try {
    const value = Number(storage?.getItem(key));
    return Number.isFinite(value) && value > 0
      ? clampWorkspaceSize(value, min, max)
      : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredWorkspaceSize(
  storage: WorkspaceStorage | null,
  key: string,
  value: number
): void {
  try {
    storage?.setItem(key, String(Math.round(value)));
  } catch {
    // Layout persistence is optional; the live UI remains usable.
  }
}
```

- [ ] **Step 4: Run the focused tests**

Run:

```powershell
npm.cmd test -- src/layout/workspaceSizing.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit the sizing primitives**

```powershell
git add -- src/layout/workspaceSizing.ts src/layout/workspaceSizing.test.ts
git commit -m "Add GIS workspace sizing primitives"
```

### Task 2: Accessible resize separator

**Files:**
- Create: `src/components/ResizeHandle.test.tsx`
- Create: `src/components/ResizeHandle.tsx`

- [ ] **Step 1: Write failing separator tests**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResizeHandle, resizeDeltaForKey } from "./ResizeHandle";

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
});
```

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run:

```powershell
npm.cmd test -- src/components/ResizeHandle.test.tsx
```

Expected: FAIL because `ResizeHandle.tsx` does not exist.

- [ ] **Step 3: Implement the separator**

```tsx
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type ResizeOrientation = "vertical" | "horizontal";

interface ResizeHandleProps {
  orientation: ResizeOrientation;
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  className?: string;
  onResize: (delta: number) => void;
  onReset: () => void;
}

export function resizeDeltaForKey(
  key: string,
  orientation: ResizeOrientation,
  largeStep: boolean
): number | null {
  const step = largeStep ? 24 : 10;
  if (orientation === "vertical") {
    if (key === "ArrowLeft") return -step;
    if (key === "ArrowRight") return step;
  } else {
    if (key === "ArrowUp") return -step;
    if (key === "ArrowDown") return step;
  }
  return null;
}

export function ResizeHandle({
  orientation,
  ariaLabel,
  value,
  min,
  max,
  className = "",
  onResize,
  onReset
}: ResizeHandleProps) {
  const pointerId = useRef<number | null>(null);
  const lastAxisPosition = useRef(0);
  const [active, setActive] = useState(false);

  const axisPosition = (event: PointerEvent<HTMLDivElement>) =>
    orientation === "vertical" ? event.clientX : event.clientY;

  const finishPointerResize = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    setActive(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = resizeDeltaForKey(event.key, orientation, event.shiftKey);
    if (delta === null) return;
    event.preventDefault();
    onResize(delta);
  };

  return (
    <div
      className={`workspace-resize-handle ${orientation} ${className} ${active ? "active" : ""}`.trim()}
      role="separator"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-orientation={orientation}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        pointerId.current = event.pointerId;
        lastAxisPosition.current = axisPosition(event);
        event.currentTarget.setPointerCapture(event.pointerId);
        setActive(true);
      }}
      onPointerMove={(event) => {
        if (pointerId.current !== event.pointerId) return;
        const nextPosition = axisPosition(event);
        const delta = nextPosition - lastAxisPosition.current;
        lastAxisPosition.current = nextPosition;
        if (delta !== 0) onResize(delta);
      }}
      onPointerUp={finishPointerResize}
      onPointerCancel={finishPointerResize}
    >
      <span aria-hidden="true" />
    </div>
  );
}
```

- [ ] **Step 4: Run the focused tests**

Run:

```powershell
npm.cmd test -- src/components/ResizeHandle.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit the reusable separator**

```powershell
git add -- src/components/ResizeHandle.tsx src/components/ResizeHandle.test.tsx
git commit -m "Add accessible workspace resize handle"
```

### Task 3: Integrate resizable dimensions into the app shell

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add failing app-shell assertions**

Extend the initial render test:

```ts
expect(html).toContain("--gis-sidebar-width:380px");
expect(html).toContain("--gis-waypoint-height:190px");
expect(html).toContain("--gis-candidate-height:240px");
expect(html).toContain('aria-label="调整侧边栏宽度"');
expect(html).toContain('aria-label="调整控制点面板高度"');
```

Extend the “does not render candidate route drawer” test:

```ts
expect(html).not.toContain('aria-label="调整候选方案面板高度"');
```

- [ ] **Step 2: Run the app test and confirm the expected failure**

Run:

```powershell
npm.cmd test -- src/App.test.tsx
```

Expected: FAIL because no CSS variables or resize separators are rendered.

- [ ] **Step 3: Add presentation-only layout state**

In `App.tsx`:

- import `type CSSProperties` from React;
- import `ResizeHandle`;
- import all sizing defaults, limits, keys, clamp/max and persistence helpers;
- add lazy state initializers that read from `window.localStorage` when `window` exists;
- persist each value in a dedicated `useEffect`;
- calculate `workspaceStyle` with the three CSS custom properties;
- apply it to `.gis-map-stage`.

Use these update rules:

```ts
const viewportWidth = () => typeof window === "undefined" ? 1280 : window.innerWidth;
const viewportHeight = () => typeof window === "undefined" ? 720 : window.innerHeight;

const resizeSidebar = (delta: number) => setSidebarWidth((current) =>
  clampWorkspaceSize(
    current + delta,
    WORKSPACE_SIZE_LIMITS.sidebarWidth.min,
    getSidebarWidthMax(viewportWidth())
  )
);

const resizeWaypointPanel = (delta: number) => setWaypointHeight((current) =>
  clampWorkspaceSize(
    current - delta,
    WORKSPACE_SIZE_LIMITS.waypointHeight.min,
    getWaypointHeightMax(viewportHeight())
  )
);

const resizeCandidatePanel = (delta: number) => setCandidateHeight((current) =>
  clampWorkspaceSize(
    current - delta,
    WORKSPACE_SIZE_LIMITS.candidateHeight.min,
    getCandidateHeightMax(viewportHeight())
  )
);
```

Render:

- a vertical separator between `.gis-selection-dock` / `.gis-analysis-dock` and the map;
- a horizontal separator between `GisSelectionPanel` and `RouteWaypointPanel`;
- a horizontal separator between the map and `CandidateRouteDrawer` only when `hasCandidateRoutes`.

Double-click reset values:

```ts
WORKSPACE_SIZE_DEFAULTS.sidebarWidth
WORKSPACE_SIZE_DEFAULTS.waypointHeight
WORKSPACE_SIZE_DEFAULTS.candidateHeight
```

- [ ] **Step 4: Run the app and focused layout tests**

Run:

```powershell
npm.cmd test -- src/App.test.tsx src/layout/workspaceSizing.test.ts src/components/ResizeHandle.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit the app integration**

```powershell
git add -- src/App.tsx src/App.test.tsx
git commit -m "Integrate resizable GIS workspace layout"
```

### Task 4: Refine layout and information hierarchy

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Capture the baseline build**

Run:

```powershell
npm.cmd run build
```

Expected: exit 0 before style changes.

- [ ] **Step 2: Implement the desktop grid and separator styles**

Change `.gis-map-stage` to three columns:

```css
grid-template-columns:
  var(--gis-sidebar-width, 380px)
  8px
  minmax(340px, 1fr);
grid-template-areas: "left sidebar-resizer map";
column-gap: 6px;
row-gap: 0;
```

When candidates exist, use:

```css
grid-template-rows:
  minmax(240px, 1fr)
  8px
  var(--gis-candidate-height, 240px);
grid-template-areas:
  "left sidebar-resizer map"
  "left sidebar-resizer candidate-resizer"
  "left sidebar-resizer candidates";
```

Change `.gis-selection-dock` to:

```css
grid-template-rows:
  minmax(0, 1fr)
  8px
  var(--gis-waypoint-height, 190px);
gap: 6px;
overflow: hidden;
```

Add grid-area modifier classes for the three handles and style `.workspace-resize-handle` with:

- transparent 8px hit target;
- a centered 1px line for the visual grip;
- green hover/focus/active feedback;
- `col-resize` for vertical and `row-resize` for horizontal;
- a larger visible focus ring;
- `touch-action: none` and `user-select: none`.

- [ ] **Step 3: Improve information density without changing content**

Apply these presentation changes:

- raise the default desktop sidebar breakpoint value from 300px to the CSS variable;
- remove horizontal scrolling from `.gis-selection-panel` and `.route-waypoint-panel`;
- make `.gis-routing-source-control` a compact three-column summary above 360px;
- use 12px panel padding and a consistent 8px group gap;
- give `.gis-tool-group` a subtle tinted section background and 8px radius;
- use a minimum 36px control height for primary form actions;
- improve disabled button contrast and visible focus rings;
- keep candidate cards at three columns on wide screens and reduce to two below 1180px;
- preserve existing map, route, layer, comparison, and analysis selectors.

- [ ] **Step 4: Disable desktop resizing in the mobile flow**

Inside `@media (max-width: 820px)`:

```css
.workspace-resize-handle {
  display: none;
}

.gis-map-stage,
.gis-tool-shell.selection.has-candidates .gis-map-stage {
  grid-template-columns: 1fr;
  grid-template-rows: none;
  grid-template-areas:
    "map"
    "candidates"
    "left";
}

.gis-selection-dock {
  grid-template-rows: none;
  gap: 12px;
}
```

- [ ] **Step 5: Build after the style changes**

Run:

```powershell
npm.cmd run build
```

Expected: exit 0.

- [ ] **Step 6: Commit the visual refinement**

```powershell
git add -- src/styles.css
git commit -m "Refine GIS workspace information layout"
```

### Task 5: Full verification and browser QA

**Files:**
- Modify only if verification finds a defect in files already listed above.

- [ ] **Step 1: Run the complete automated suite**

Run:

```powershell
npm.cmd test
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run the production build**

Run:

```powershell
npm.cmd run build
```

Expected: TypeScript and Vite both exit 0.

- [ ] **Step 3: Verify desktop layout at `http://127.0.0.1:5174/`**

Check at 1280×720:

- sidebar starts at 380px and has no horizontal scrollbar;
- map remains readable;
- vertical separator resizes the sidebar between its limits;
- waypoint separator changes the lower-left panel height;
- double click restores each tested dimension;
- reloading preserves the last non-reset dimension.

- [ ] **Step 4: Verify candidate bottom panel**

Generate or select a candidate route and check:

- the candidate separator appears only with the drawer;
- dragging upward enlarges the drawer and dragging downward shrinks it;
- route selection, compare checkbox, and analysis button behavior remain unchanged.

- [ ] **Step 5: Verify responsive fallback**

At 820px and below:

- separators are hidden;
- map, candidates, and left workspace use the single-column order;
- the page has no horizontal scrollbar;
- all existing controls remain usable.

- [ ] **Step 6: Review the final diff and rollback points**

Run:

```powershell
git status --short
git log -6 --oneline
git diff HEAD~4..HEAD --check
```

Expected: clean worktree, separate design/sizing/component/integration/style commits, and no whitespace errors.
