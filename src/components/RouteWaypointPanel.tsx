import type { WaypointRoutePlan } from "../data/profileRoutePlanner";
import type { Coordinate } from "../domain/routeMetrics";

interface RouteWaypointPanelProps {
  activeRouteId: string;
  routePlans: WaypointRoutePlan[];
}

function formatCoordinate(coordinate: Coordinate): string {
  return `${coordinate[0].toFixed(5)}, ${coordinate[1].toFixed(5)}`;
}

function displayLabel(label: string): string {
  return label.replace(/^(起点|终点)[：:]\s*/, "");
}

export function RouteWaypointPanel({ activeRouteId, routePlans }: RouteWaypointPanelProps) {
  const plan = routePlans.find((item) => item.id === activeRouteId) ?? null;

  return (
    <section className="route-waypoint-panel" aria-label="当前路线控制点">
      <div className="route-waypoint-heading">
        <span>当前路线控制点</span>
        <strong>{plan?.name ?? "未选择路线"}</strong>
      </div>

      {!plan ? (
        <p className="route-waypoint-empty">点击生成或选择路线后查看起点、途经控制点和终点。</p>
      ) : (
        <ol className="route-waypoint-list">
          {plan.waypoints.map((waypoint, index) => {
            const isStart = index === 0;
            const isEnd = index === plan.waypoints.length - 1;
            const role = isStart ? "起点" : isEnd ? "终点" : "途经控制点";

            return (
              <li key={`${plan.id}-${waypoint.label}-${index}`}>
                <b className={isStart ? "start" : isEnd ? "end" : "control"}>{role}</b>
                <div>
                  <strong>{displayLabel(waypoint.label)}</strong>
                  <span>{formatCoordinate(waypoint.coordinate)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
