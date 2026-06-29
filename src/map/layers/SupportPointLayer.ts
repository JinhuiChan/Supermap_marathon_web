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
  停车: "#8a5b15"
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
