# Delete Generated Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users safely delete one generated candidate route while keeping its control points available for regeneration.

**Architecture:** A pure domain helper computes the next route workspace state so active and compared IDs cannot become stale. The candidate drawer emits a route ID, `App` owns pending-confirmation and deletion state, and a dedicated accessible dialog presents the destructive action. Styling stays scoped to the drawer action and dialog surfaces.

**Tech Stack:** React 19, TypeScript, Vitest, Vite, CSS

---

### Task 1: Route workspace deletion state

**Files:**
- Modify: `src/domain/routeCollection.ts`
- Test: `src/domain/routeCollection.test.ts`

- [ ] **Step 1: Write failing state-transition tests**

Add tests that call the wished-for `removeGeneratedRoute` API:

```ts
import { removeGeneratedRoute, upsertGeneratedRoute } from "./routeCollection";

it("removes a generated route and clears its comparison state", () => {
  const other = { ...baseRoute, id: "other" };
  expect(removeGeneratedRoute([baseRoute, other], baseRoute.id, [baseRoute.id, other.id], other.id)).toEqual({
    routes: [baseRoute],
    activeRouteId: baseRoute.id,
    comparedRouteIds: [baseRoute.id]
  });
});

it("selects the first remaining route when the active route is deleted", () => {
  const other = { ...baseRoute, id: "other" };
  expect(removeGeneratedRoute([baseRoute, other], baseRoute.id, [baseRoute.id], baseRoute.id)).toEqual({
    routes: [other],
    activeRouteId: other.id,
    comparedRouteIds: []
  });
});

it("clears route workspace IDs after deleting the final route", () => {
  expect(removeGeneratedRoute([baseRoute], baseRoute.id, [baseRoute.id], baseRoute.id)).toEqual({
    routes: [],
    activeRouteId: "",
    comparedRouteIds: []
  });
});
```

- [ ] **Step 2: Run the test and verify the RED state**

Run:

```powershell
npm.cmd test -- src/domain/routeCollection.test.ts
```

Expected: FAIL because `removeGeneratedRoute` is not exported.

- [ ] **Step 3: Implement the minimal pure helper**

Add:

```ts
export interface RouteWorkspaceState {
  routes: MarathonRoute[];
  activeRouteId: string;
  comparedRouteIds: string[];
}

export function removeGeneratedRoute(
  routes: MarathonRoute[],
  activeRouteId: string,
  comparedRouteIds: string[],
  routeId: string
): RouteWorkspaceState {
  const nextRoutes = routes.filter((route) => route.id !== routeId);
  return {
    routes: nextRoutes,
    activeRouteId: activeRouteId === routeId ? nextRoutes[0]?.id ?? "" : activeRouteId,
    comparedRouteIds: comparedRouteIds.filter((id) => id !== routeId)
  };
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```powershell
npm.cmd test -- src/domain/routeCollection.test.ts
```

Expected: all route collection tests pass.

- [ ] **Step 5: Commit the domain behavior**

```powershell
git add src/domain/routeCollection.ts src/domain/routeCollection.test.ts
git commit -m "Add generated route removal state"
```

### Task 2: Candidate card delete action

**Files:**
- Modify: `src/components/CandidateRouteDrawer.tsx`
- Test: `src/components/CandidateRouteDrawer.test.tsx`

- [ ] **Step 1: Write a failing rendering test**

Pass `onDeleteRoute={() => {}}` to the existing render and assert:

```ts
expect(html).toContain('aria-label="删除路线 组织保障路线"');
expect(html).toContain('class="delete-route-button"');
expect(html).toContain(">删除</button>");
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd test -- src/components/CandidateRouteDrawer.test.tsx
```

Expected: FAIL because the component has no deletion callback or button.

- [ ] **Step 3: Add the callback and accessible button**

Extend the props:

```ts
onDeleteRoute: (id: string) => void;
```

Destructure it and add to `.drawer-actions`:

```tsx
<button
  type="button"
  className="delete-route-button"
  aria-label={`删除路线 ${route.name}`}
  onClick={() => onDeleteRoute(route.id)}
>
  删除
</button>
```

- [ ] **Step 4: Run the component test and verify GREEN**

Run:

```powershell
npm.cmd test -- src/components/CandidateRouteDrawer.test.tsx
```

Expected: the candidate drawer tests pass.

- [ ] **Step 5: Commit the UI contract**

```powershell
git add src/components/CandidateRouteDrawer.tsx src/components/CandidateRouteDrawer.test.tsx
git commit -m "Add candidate route delete action"
```

### Task 3: Confirm and apply deletion in the application

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`
- Create: `src/components/RouteDeleteDialog.tsx`
- Test: `src/components/RouteDeleteDialog.test.tsx`

- [ ] **Step 1: Add a failing confirmation-dialog contract test**

Render the wished-for dialog and verify its accessible contract:

```ts
it("explains the destructive action and how to recover", () => {
  const html = renderToStaticMarkup(
    <RouteDeleteDialog routeName="测试路线" onCancel={() => {}} onConfirm={() => {}} />
  );
  expect(html).toContain('role="alertdialog"');
  expect(html).toContain("删除后可使用原控制点重新生成。");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd test -- src/App.test.tsx
```

Expected: FAIL because `RouteDeleteDialog` does not exist.

- [ ] **Step 3: Implement the in-page confirmation and state synchronization**

Add `RouteDeleteDialog` with `role="alertdialog"`, `aria-modal="true"`, visible route name, “取消” and “确认删除” buttons. In `App`, track the pending route:

```ts
const [pendingDeleteRouteId, setPendingDeleteRouteId] = useState("");
const pendingDeleteRoute = routes.find((route) => route.id === pendingDeleteRouteId) ?? null;
```

Confirm with:

```ts
const confirmDeleteRoute = () => {
  if (!pendingDeleteRoute) return;
  const next = removeGeneratedRoute(routes, activeRouteId, comparedRouteIds, pendingDeleteRoute.id);
  setRoutes(next.routes);
  setActiveRouteId(next.activeRouteId);
  setComparedRouteIds(next.comparedRouteIds);
  setGenerationStatus(`已删除 ${pendingDeleteRoute.name}，可使用原控制点重新生成。`);
  setPendingDeleteRouteId("");
};
```

Pass `onDeleteRoute={setPendingDeleteRouteId}` to `CandidateRouteDrawer`, and render the dialog while `pendingDeleteRoute` exists.

- [ ] **Step 4: Run the application and component tests**

Run:

```powershell
npm.cmd test -- src/App.test.tsx src/components/RouteDeleteDialog.test.tsx src/components/CandidateRouteDrawer.test.tsx src/domain/routeCollection.test.ts
```

Expected: all targeted tests pass.

- [ ] **Step 5: Commit application integration**

```powershell
git add src/App.tsx src/App.test.tsx src/components/RouteDeleteDialog.tsx src/components/RouteDeleteDialog.test.tsx
git commit -m "Integrate generated route deletion"
```

### Task 4: Destructive-action visual treatment

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add the scoped button states**

Add styles near `.drawer-actions`:

```css
.drawer-actions .delete-route-button {
  margin-left: auto;
  border-color: rgba(190, 58, 58, 0.24);
  background: #fff;
  color: #a93838;
}

.drawer-actions .delete-route-button:hover,
.drawer-actions .delete-route-button:focus-visible {
  border-color: rgba(190, 58, 58, 0.48);
  background: #fff4f2;
  color: #8f2525;
}

.drawer-actions .delete-route-button:focus-visible {
  outline: 3px solid rgba(190, 58, 58, 0.16);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Build to catch CSS and TypeScript integration errors**

Run:

```powershell
npm.cmd run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 3: Commit the visual treatment**

```powershell
git add src/styles.css
git commit -m "Style candidate route delete action"
```

### Task 5: Final verification and browser acceptance

**Files:**
- No production file changes expected

- [ ] **Step 1: Run the complete test suite**

```powershell
npm.cmd test
```

Expected: all test files pass with zero failures.

- [ ] **Step 2: Run a fresh production build**

```powershell
npm.cmd run build
```

Expected: exit code 0.

- [ ] **Step 3: Verify in the browser**

At desktop width:

1. Generate a route and confirm a red-toned “删除” action appears on its card.
2. Click “删除”, cancel the confirmation, and verify the route remains.
3. Click “删除”, confirm, and verify the route disappears from both card list and map.
4. Verify deleting the last route collapses the candidate drawer.
5. Generate the same route again to prove the control points were retained.
6. Use keyboard focus to confirm the button has a visible focus state.

- [ ] **Step 4: Inspect the final diff and repository state**

```powershell
git diff --check main...HEAD
git status --short
```

Expected: no whitespace errors and a clean feature worktree.
