import { waypointRoutePlans } from "../data/profileRoutePlanner";

interface DataPackageItem {
  name: string;
  file: string;
  href: string;
}

const dataItems = [
  {
    name: "候选赛道线数据",
    file: "wuhan-marathon-routes.geojson",
    href: "/data/wuhan-marathon-routes.geojson"
  },
  {
    name: "三条路线途经控制点 CSV",
    file: "wuhan-marathon-waypoints.csv",
    href: buildWaypointCsvHref()
  }
] satisfies DataPackageItem[];

function buildWaypointCsvHref(): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${buildWaypointCsv()}`)}`;
}

export function buildWaypointCsv(): string {
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
    ...waypointRoutePlans.flatMap((plan) =>
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

export function DataPackagePanel() {
  return (
    <section className="side-section data-package">
      <h2>GIS 数据包</h2>
      <p className="muted">可导入 SuperMap iDesktopX，用于制作武汉马拉松二维地图和后续 iServer 服务。</p>
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
