import type { Coordinate, MarathonRoute } from "./routeMetrics";

export type SupportPlanningMapPointType = "补给" | "医疗" | "厕所" | "引导";

export interface SupportPlanningMapPoint {
  id: string;
  routeId: string;
  type: SupportPlanningMapPointType;
  label: string;
  coordinate: Coordinate;
  mileageKm: number;
  mileageLabel: string;
}

export function buildSupportPlanningMapPoints(route: MarathonRoute): SupportPlanningMapPoint[] {
  const supplyMileages = rangeByStep(5, route.lengthKm, 5);
  const restroomMileages = uniqueMileages([0, ...rangeByStep(10, route.lengthKm, 10), route.lengthKm]);
  const medicalMileages = uniqueMileages([0, route.lengthKm / 2, Math.min(30, route.lengthKm * 0.72), route.lengthKm]);
  const guideMileages = uniqueMileages([
    route.lengthKm * 0.12,
    route.lengthKm * 0.25,
    route.lengthKm * 0.5,
    route.lengthKm * 0.72,
    route.lengthKm * 0.9
  ]);

  return [
    ...supplyMileages.map((mileage) => point(route, "补给", mileage, `补给站 ${formatMileage(mileage)}`)),
    ...medicalMileages.map((mileage) => point(route, "医疗", mileage, medicalLabel(route, mileage))),
    ...restroomMileages.map((mileage) => point(route, "厕所", mileage, `厕所服务 ${formatMileage(mileage)}`)),
    ...guideMileages.map((mileage) => point(route, "引导", mileage, `引导与隔离 ${formatMileage(mileage)}`))
  ];
}

function point(
  route: MarathonRoute,
  type: SupportPlanningMapPointType,
  mileageKm: number,
  label: string
): SupportPlanningMapPoint {
  const roundedMileage = roundMileage(mileageKm);
  return {
    id: `${route.id}-${type}-${roundedMileage.toFixed(1).replace(".", "-")}`,
    routeId: route.id,
    type,
    label,
    coordinate: coordinateAtMileage(route, mileageKm),
    mileageKm: roundedMileage,
    mileageLabel: formatMileage(roundedMileage)
  };
}

function coordinateAtMileage(route: MarathonRoute, mileageKm: number): Coordinate {
  if (route.coordinates.length === 0) return [0, 0];
  if (route.coordinates.length === 1 || route.lengthKm <= 0) return route.coordinates[0];
  const ratio = Math.max(0, Math.min(1, mileageKm / route.lengthKm));
  const index = Math.max(0, Math.min(route.coordinates.length - 1, Math.round((route.coordinates.length - 1) * ratio)));
  return route.coordinates[index];
}

function rangeByStep(stepKm: number, lengthKm: number, maxKm: number): number[] {
  const mileages: number[] = [];
  for (let mileage = stepKm; mileage < lengthKm; mileage += maxKm) {
    mileages.push(roundMileage(mileage));
  }
  return mileages;
}

function uniqueMileages(mileages: number[]): number[] {
  return [...new Set(mileages.map(roundMileage))].sort((a, b) => a - b);
}

function roundMileage(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatMileage(value: number): string {
  return `${roundMileage(value).toFixed(1)}km`;
}

function medicalLabel(route: MarathonRoute, mileageKm: number): string {
  if (mileageKm <= 0) return "起点医疗点";
  if (Math.abs(mileageKm - route.lengthKm) < 0.2) return "终点医疗点";
  if (Math.abs(mileageKm - route.lengthKm / 2) < 0.2) return "半程医疗观察点";
  return `30km 后医疗观察点 ${formatMileage(mileageKm)}`;
}
