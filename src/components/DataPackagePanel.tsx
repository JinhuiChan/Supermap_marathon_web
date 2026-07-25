import { activeCityPackage, type CityPackage } from "../config/cityPackages";
import type { WaypointRoutePlan } from "../data/profileRoutePlanner";

interface DataPackageItem {
  name: string;
  file: string;
  href: string;
}

function buildWaypointCsvHref(routePlans: WaypointRoutePlan[]): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${buildWaypointCsv(routePlans)}`)}`;
}

function buildDataItems(cityPackage: CityPackage): DataPackageItem[] {
  const routeFile = `${cityPackage.id}-marathon-routes.geojson`;
  const waypointFile = `${cityPackage.id}-marathon-waypoints.csv`;
  return [
    {
      name: "候选赛道线数据",
      file: routeFile,
      href: `/data/${routeFile}`
    },
    {
      name: `${cityPackage.routePlans.length} 条路线途经控制点 CSV`,
      file: waypointFile,
      href: buildWaypointCsvHref(cityPackage.routePlans)
    }
  ];
}

export function buildWaypointCsv(routePlans: WaypointRoutePlan[] = activeCityPackage.routePlans): string {
  const rows = [
    [
      "route_id",
      "route_name",
      "sequence",
      "label",
      "longitude",
      "latitude",
      "target_distance_km",
      "positioning",
      "audience",
      "features"
    ],
    ...routePlans.flatMap((plan) =>
      plan.waypoints.map((waypoint, index) => [
        plan.id,
        plan.name,
        String(index + 1),
        waypoint.label,
        waypoint.coordinate[0].toFixed(5),
        waypoint.coordinate[1].toFixed(5),
        String(plan.targetDistanceKm),
        plan.positioning,
        plan.audience,
        plan.features.join("；")
      ])
    )
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function DataPackagePanel({ cityPackage = activeCityPackage }: { cityPackage?: CityPackage }) {
  const dataItems = buildDataItems(cityPackage);
  return (
    <section className="side-section data-package">
      <h2>GIS 数据包</h2>
      <p className="muted">可导入 SuperMap iDesktopX，用于制作{cityPackage.displayName}二维地图和后续 iServer 服务。</p>
      <div className="data-file-list">
        {dataItems.map((item) => (
          <a href={item.href} key={item.file} download={item.file}>
            <span>{item.name}</span>
            <strong>{item.file}</strong>
          </a>
        ))}
      </div>
    </section>
  );
}
