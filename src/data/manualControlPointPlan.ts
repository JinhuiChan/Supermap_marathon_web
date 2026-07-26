import type { Coordinate } from "../domain/routeMetrics";
import type { WaypointRoutePlan } from "./profileRoutePlanner";

export interface ManualControlPointRow {
  id: string;
  label: string;
  longitude: string;
  latitude: string;
}

type ManualControlPointInputRow = Pick<ManualControlPointRow, "label" | "longitude" | "latitude"> & Partial<Pick<ManualControlPointRow, "id">>;

export type ManualControlPointPlanResult =
  | { ok: true; plan: WaypointRoutePlan }
  | { ok: false; error: string };

export type ManualControlPointImportResult =
  | { ok: true; rows: ManualControlPointRow[]; routeName?: string }
  | { ok: false; error: string };

export const manualControlPointExampleRows: ManualControlPointRow[] = [
  createManualControlPointRow("起点：三阳路沿江大道", "114.30230", "30.60287", "example-start"),
  createManualControlPointRow("示例控制点：汉口江滩", "114.30010", "30.59570", "example-hankou-river"),
  createManualControlPointRow("示例控制点：武汉长江大桥", "114.29550", "30.54880", "example-yangtze-bridge"),
  createManualControlPointRow("示例控制点：楚河汉街", "114.34020", "30.55820", "example-hanjie"),
  createManualControlPointRow("终点：青山江滩", "114.30933", "30.60991", "example-finish")
];

interface BuildManualControlPointRoutePlanInput {
  id: string;
  name: string;
  rows: ManualControlPointInputRow[];
  targetDistanceKm?: number;
}

export function createManualControlPointRow(
  label = "",
  longitude = "",
  latitude = "",
  id = `manual-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
): ManualControlPointRow {
  return { id, label, longitude, latitude };
}

export function updateManualControlPointRow(
  rows: ManualControlPointRow[],
  id: string,
  field: keyof Omit<ManualControlPointRow, "id">,
  value: string
): ManualControlPointRow[] {
  return rows.map((row) => row.id === id ? { ...row, [field]: value } : row);
}

export function parseManualControlPointText(text: string): ManualControlPointImportResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "请输入 JSON 或 Markdown 控制点数据" };

  const jsonResult = parseJsonControlPoints(trimmed);
  if (jsonResult.ok) return jsonResult;

  const markdownResult = parseMarkdownControlPoints(trimmed);
  if (markdownResult.ok) return markdownResult;

  return { ok: false, error: "未识别控制点数据，请使用 JSON 数组或 Markdown 表格" };
}

export function buildManualControlPointRoutePlan(input: BuildManualControlPointRoutePlanInput): ManualControlPointPlanResult {
  const rows = input.rows.filter((row) =>
    row.label.trim() || row.longitude.trim() || row.latitude.trim()
  );
  if (rows.length < 2) {
    return { ok: false, error: "至少需要 2 个控制点" };
  }

  const waypoints: WaypointRoutePlan["waypoints"] = [];
  for (const [index, row] of rows.entries()) {
    const label = row.label.trim();
    if (!label) {
      return { ok: false, error: `第 ${index + 1} 个控制点名称不能为空` };
    }

    const coordinate = parseCoordinate(row.longitude, row.latitude);
    if (!coordinate) {
      return { ok: false, error: `第 ${index + 1} 个控制点经纬度无效` };
    }

    waypoints.push({ label, coordinate });
  }

  const name = input.name.trim() || "用户手动路线";
  const targetDistanceKm = input.targetDistanceKm ?? 42.195;

  return {
    ok: true,
    plan: {
      id: input.id,
      name,
      color: "#0f766e",
      targetDistanceKm,
      controlPointMode: "manual",
      controlPointSourceLabel: "用户手动输入控制点",
      selectionProfile: "balanced",
      seedPoints: waypoints.slice(0, 4).map((waypoint) => waypoint.coordinate),
      candidateProfileIds: ["osm-balanced", "osm-scenic", "osm-main-road", "osm-river-scenic"],
      waypoints,
      note: "用户在界面手动输入控制点，系统按输入顺序吸附到最近道路节点并生成路线。",
      description: "用户手动输入控制点 / 路网生成",
      positioning: "用户按赛事意图输入起点、途经控制点和终点，系统按控制点顺序生成并进入质量复核。",
      audience: "自定义方案、专家复核、现场演示",
      features: [
        "用户在界面输入控制点后生成路线，展示人工意图驱动的选线能力",
        "控制点按输入顺序吸附到最近道路节点并分段连通",
        "生成结果仍进入距离、拓扑、坡度和道路贴合质量闸门"
      ]
    }
  };
}

function parseJsonControlPoints(text: string): ManualControlPointImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "不是 JSON" };
  }

  const record = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
  const source = Array.isArray(parsed)
    ? parsed
    : Array.isArray(record.controlPoints)
      ? record.controlPoints
      : Array.isArray(record.waypoints)
        ? record.waypoints
        : [];
  const rows = source
    .map((item, index) => rowFromUnknown(item, `json-${index}`))
    .filter((row): row is ManualControlPointRow => Boolean(row));
  return rows.length >= 2
    ? { ok: true, rows, routeName: textValue(record.routeName ?? record.name) }
    : { ok: false, error: "JSON 中至少需要 2 个控制点" };
}

function parseMarkdownControlPoints(text: string): ManualControlPointImportResult {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^[-|:\s]+$/.test(line))
    .flatMap((line, index) => rowFromMarkdownLine(line, index));

  return rows.length >= 2
    ? { ok: true, rows }
    : { ok: false, error: "Markdown 中至少需要 2 个控制点" };
}

function rowFromUnknown(value: unknown, id: string): ManualControlPointRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const label = textValue(record.label ?? record.name ?? record.title ?? record.point);
  const lon = numberValue(record.longitude ?? record.lon ?? record.lng ?? record.x);
  const lat = numberValue(record.latitude ?? record.lat ?? record.y);
  if (!label || lon === null || lat === null) return null;
  return createManualControlPointRow(label, formatCoordinateInput(lon), formatCoordinateInput(lat), id);
}

function rowFromMarkdownLine(line: string, index: number): ManualControlPointRow[] {
  if (/^\|/.test(line)) {
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 3 || cells.some((cell) => /^-+$/.test(cell))) return [];
    if (/^(名称|name|label)$/i.test(cells[0])) return [];
    const lon = Number(cells[1]);
    const lat = Number(cells[2]);
    return Number.isFinite(lon) && Number.isFinite(lat)
      ? [createManualControlPointRow(cells[0], formatCoordinateInput(lon), formatCoordinateInput(lat), `md-${index}`)]
      : [];
  }

  const match = line.match(/^(?:[-*]\s*)?(.+?)[,，\s]+(-?\d+(?:\.\d+)?)[,，\s]+(-?\d+(?:\.\d+)?)$/);
  if (!match) return [];
  return [createManualControlPointRow(match[1].trim(), formatCoordinateInput(Number(match[2])), formatCoordinateInput(Number(match[3])), `md-${index}`)];
}

function parseCoordinate(longitude: string, latitude: string): Coordinate | null {
  const lon = Number(longitude);
  const lat = Number(latitude);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return [lon, lat];
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatCoordinateInput(value: number): string {
  return value.toFixed(5);
}
