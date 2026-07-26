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
    // Persistence is optional; the live layout still works without it.
  }
}
