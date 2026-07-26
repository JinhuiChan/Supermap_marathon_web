import { activeCityPackage, type CityPackage } from "../config/cityPackages";
import { getCityPackageChecklist, summarizeCityPackageChecklist } from "../config/cityPackageChecklist";
import {
  controlPointModeForPlan,
  controlPointSourceLabelForPlan,
  type WaypointRoutePlan
} from "../data/profileRoutePlanner";

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
      "control_point_source",
      "control_point_mode",
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
        controlPointSourceLabelForPlan(plan),
        controlPointModeForPlan(plan),
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
  const checklist = getCityPackageChecklist(cityPackage);
  const checklistSummary = summarizeCityPackageChecklist(checklist);
  const blockingItems = checklist.filter((item) => item.status === "blocking");
  return (
    <section className="side-section data-package">
      <h2>GIS 数据包</h2>
      <p className="muted">可导入 SuperMap iDesktopX，用于制作{cityPackage.displayName}二维地图和后续 iServer 服务。</p>
      <div className="city-package-readiness">
        <strong>城市包完整度 {checklistSummary.ready}/{checklistSummary.total}</strong>
        <span>{checklistSummary.blocking === 0 ? "切换城市所需核心数据已就绪" : `${checklistSummary.blocking} 项待补齐`}</span>
        {blockingItems.length > 0 && (
          <ul>
            {blockingItems.map((item) => (
              <li key={item.id}>{item.label}：{item.evidence}</li>
            ))}
          </ul>
        )}
      </div>
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
