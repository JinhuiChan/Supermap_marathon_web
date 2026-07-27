import { describe, expect, test } from "vitest";
import {
  buildManualControlPointRoutePlan,
  isJsonControlPointFileName,
  manualControlPointExampleRows,
  parseManualControlPointText,
  updateManualControlPointRow
} from "./manualControlPointPlan";

describe("manualControlPointPlan", () => {
  test("provides editable example control points for the manual input UI", () => {
    expect(manualControlPointExampleRows.length).toBeGreaterThanOrEqual(4);
    expect(manualControlPointExampleRows[0]).toMatchObject({
      id: expect.any(String),
      label: expect.stringContaining("起点"),
      longitude: expect.any(String),
      latitude: expect.any(String)
    });
  });

  test("keeps row identity stable when users edit a control-point name", () => {
    const [updated] = updateManualControlPointRow(manualControlPointExampleRows, manualControlPointExampleRows[0].id, "label", "新起点");

    expect(updated.id).toBe(manualControlPointExampleRows[0].id);
    expect(updated.label).toBe("新起点");
  });

  test("parses local JSON control-point data into editable rows", () => {
    const result = parseManualControlPointText(JSON.stringify({
      routeName: "JSON 导入路线",
      controlPoints: [
        { name: "起点", lon: 114.3023, lat: 30.60287 },
        { name: "终点", longitude: 114.30933, latitude: 30.60991 }
      ]
    }));

    expect(result).toMatchObject({
      ok: true,
      routeName: "JSON 导入路线",
      rows: [
        expect.objectContaining({ label: "起点", longitude: "114.30230", latitude: "30.60287" }),
        expect.objectContaining({ label: "终点", longitude: "114.30933", latitude: "30.60991" })
      ]
    });
  });

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

  test("accepts only JSON file names for local import", () => {
    expect(isJsonControlPointFileName("route.JSON")).toBe(true);
    expect(isJsonControlPointFileName("route.md")).toBe(false);
    expect(isJsonControlPointFileName("route.txt")).toBe(false);
  });

  test("builds a route plan from user-entered control points without touching preset routes", () => {
    const result = buildManualControlPointRoutePlan({
      id: "manual-user-1",
      name: "用户自定义滨水线",
      rows: manualControlPointExampleRows
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan).toMatchObject({
      id: "manual-user-1",
      name: "用户自定义滨水线",
      targetDistanceKm: 42.195,
      controlPointMode: "manual",
      controlPointSourceLabel: "用户手动输入控制点",
      selectionProfile: "balanced"
    });
    expect(result.plan.waypoints[0].coordinate).toEqual([114.3023, 30.60287]);
    expect(result.plan.waypoints).toHaveLength(manualControlPointExampleRows.length);
    expect(result.plan.features[0]).toContain("界面输入控制点");
  });

  test("rejects invalid coordinates before route generation starts", () => {
    const result = buildManualControlPointRoutePlan({
      id: "manual-user-invalid",
      name: "错误路线",
      rows: [
        { label: "起点", longitude: "114.3", latitude: "30.6" },
        { label: "错误点", longitude: "not-a-number", latitude: "30.7" }
      ]
    });

    expect(result).toEqual({
      ok: false,
      error: "第 2 个控制点经纬度无效"
    });
  });
});
