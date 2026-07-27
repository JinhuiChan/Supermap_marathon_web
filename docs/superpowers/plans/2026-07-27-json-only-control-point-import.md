# JSON-Only Control Point Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Markdown and text-file support so manual control-point imports accept and describe JSON only.

**Architecture:** Keep the existing JSON parser and manual route workflow. Remove the Markdown fallback from the domain parser, then align the file picker, editor label, and validation copy with the reduced format contract.

**Tech Stack:** React 19, TypeScript, Vitest, Vite

---

### Task 1: Define the JSON-only behavior with failing tests

**Files:**
- Modify: `src/data/manualControlPointPlan.test.ts`
- Modify: `src/components/GisSelectionPanel.test.tsx`

- [ ] **Step 1: Replace the Markdown success test with a rejection test**

```ts
test("rejects Markdown control-point data", () => {
  const result = parseManualControlPointText([
    "| 名称 | 经度 | 纬度 |",
    "| --- | --- | --- |",
    "| 起点 | 114.30230 | 30.60287 |",
    "| 终点 | 114.30933 | 30.60991 |"
  ].join("\n"));

  expect(result).toEqual({
    ok: false,
    error: "控制点数据必须是有效的 JSON"
  });
});
```

- [ ] **Step 2: Update the panel contract assertions**

```ts
expect(html).toContain("读取本地 JSON");
expect(html).toContain('accept=".json"');
expect(html).toContain("JSON 控制点");
expect(html).not.toContain("JSON/MD");
expect(html).not.toContain("Markdown");
expect(html).not.toContain(".md");
expect(html).not.toContain(".txt");
```

- [ ] **Step 3: Run the tests and verify RED**

```powershell
npm.cmd test -- src/data/manualControlPointPlan.test.ts src/components/GisSelectionPanel.test.tsx
```

Expected: Markdown is still accepted and the rendered picker still lists JSON/MD extensions.

### Task 2: Remove Markdown support and align the interface

**Files:**
- Modify: `src/data/manualControlPointPlan.ts`
- Modify: `src/components/GisSelectionPanel.tsx`

- [ ] **Step 1: Make the parser JSON-only**

Replace `parseManualControlPointText` with:

```ts
export function parseManualControlPointText(text: string): ManualControlPointImportResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "请输入 JSON 控制点数据" };

  const jsonResult = parseJsonControlPoints(trimmed);
  return jsonResult.ok
    ? jsonResult
    : { ok: false, error: "控制点数据必须是有效的 JSON" };
}
```

Delete `parseMarkdownControlPoints` and `rowFromMarkdownLine`.

- [ ] **Step 2: Restrict and relabel the file picker**

Use:

```tsx
读取本地 JSON
<input
  type="file"
  accept=".json"
  onChange={(event) => readManualControlPointFile(event.currentTarget.files?.[0])}
/>
```

Change the editor label to:

```tsx
<span>JSON 控制点</span>
```

- [ ] **Step 3: Run targeted tests and verify GREEN**

```powershell
npm.cmd test -- src/data/manualControlPointPlan.test.ts src/components/GisSelectionPanel.test.tsx src/App.test.tsx
```

Expected: all targeted tests pass.

- [ ] **Step 4: Commit the behavior**

```powershell
git add src/data/manualControlPointPlan.ts src/data/manualControlPointPlan.test.ts src/components/GisSelectionPanel.tsx src/components/GisSelectionPanel.test.tsx
git commit -m "Restrict control point imports to JSON"
```

### Task 3: Verify and deliver

**Files:**
- No additional source changes expected

- [ ] **Step 1: Run the complete test suite**

```powershell
npm.cmd test
```

Expected: every test file passes with zero failures.

- [ ] **Step 2: Run a fresh production build**

```powershell
npm.cmd run build -- --outDir tmp/json-only-import-final
```

Expected: TypeScript and Vite complete with exit code 0.

- [ ] **Step 3: Verify repository and running app state**

```powershell
git diff --check
git status --short
```

Confirm `http://127.0.0.1:5174/` returns HTTP 200 and the rendered file input uses `accept=".json"`.
