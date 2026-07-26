import { describe, expect, test } from "vitest";
import {
  buildManualControlPointRoutePlan,
  manualControlPointExampleRows
} from "./manualControlPointPlan";

describe("manualControlPointPlan", () => {
  test("provides editable example control points for the manual input UI", () => {
    expect(manualControlPointExampleRows.length).toBeGreaterThanOrEqual(4);
    expect(manualControlPointExampleRows[0]).toMatchObject({
      label: expect.stringContaining("起点"),
      longitude: expect.any(String),
      latitude: expect.any(String)
    });
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
