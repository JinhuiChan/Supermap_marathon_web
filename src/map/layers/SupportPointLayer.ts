import type { SupportPoint, SupportPointType } from "../../data/supportPoints";

export interface SupportPointStyle {
  [key: string]: string | number | boolean;
  radius: number;
  color: string;
  weight: number;
  opacity: number;
  fillColor: string;
  fillOpacity: number;
}

const pointColors: Record<SupportPointType, string> = {
  起终点: "#173a52",
  补给: "#23836f",
  医疗: "#c43d32",
  地铁站: "#2563eb",
  停车场: "#8a5b15",
  公园: "#2f855a",
  公厕: "#7c3aed",
  "商圈/补给": "#d97706",
  应急集结: "#be123c"
};

export function toLeafletLatLng(point: SupportPoint): [number, number] {
  const [lon, lat] = point.coordinate;
  return [lat, lon];
}

export function computeSupportPointStyle(point: SupportPoint, isHighlighted: boolean): SupportPointStyle {
  return {
    radius: isHighlighted ? 8 : 5,
    color: "#ffffff",
    weight: isHighlighted ? 3 : 2,
    opacity: 1,
    fillColor: pointColors[point.type],
    fillOpacity: isHighlighted ? 0.95 : 0.72
  };
}

export function formatSupportPointLabel(point: SupportPoint): string {
  return `${point.name} · ${point.type} · ${point.serviceLevel}级`;
}

export function formatSupportPointPopup(point: SupportPoint): string {
  return [
    `<strong>${escapeHtml(point.name)}</strong>`,
    `类型：${escapeHtml(point.type)}`,
    `服务等级：${escapeHtml(point.serviceLevel)}级`,
    `关联路线：${escapeHtml(point.routeId)}`,
    `坐标：${point.coordinate[0].toFixed(5)}, ${point.coordinate[1].toFixed(5)}`
  ].join("<br>");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
