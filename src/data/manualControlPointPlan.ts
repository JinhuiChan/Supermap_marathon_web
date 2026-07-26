import type { Coordinate } from "../domain/routeMetrics";
import type { WaypointRoutePlan } from "./profileRoutePlanner";

export interface ManualControlPointRow {
  label: string;
  longitude: string;
  latitude: string;
}

export type ManualControlPointPlanResult =
  | { ok: true; plan: WaypointRoutePlan }
  | { ok: false; error: string };

export const manualControlPointExampleRows: ManualControlPointRow[] = [
  { label: "起点：三阳路沿江大道", longitude: "114.30230", latitude: "30.60287" },
  { label: "示例控制点：汉口江滩", longitude: "114.30010", latitude: "30.59570" },
  { label: "示例控制点：武汉长江大桥", longitude: "114.29550", latitude: "30.54880" },
  { label: "示例控制点：楚河汉街", longitude: "114.34020", latitude: "30.55820" },
  { label: "终点：青山江滩", longitude: "114.30933", latitude: "30.60991" }
];

interface BuildManualControlPointRoutePlanInput {
  id: string;
  name: string;
  rows: ManualControlPointRow[];
  targetDistanceKm?: number;
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

function parseCoordinate(longitude: string, latitude: string): Coordinate | null {
  const lon = Number(longitude);
  const lat = Number(latitude);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return [lon, lat];
}
