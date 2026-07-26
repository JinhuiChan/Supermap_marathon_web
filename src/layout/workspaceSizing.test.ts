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
