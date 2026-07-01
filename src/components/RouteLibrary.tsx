import type { MarathonRoute } from "../domain/routeMetrics";

interface RouteLibraryProps {
  routes: MarathonRoute[];
  activeRouteId: string;
  comparedRouteIds: string[];
  onSelectRoute: (id: string) => void;
  onToggleCompare: (id: string) => void;
}

export function RouteLibrary({
  routes,
  activeRouteId,
  comparedRouteIds,
  onSelectRoute,
  onToggleCompare
}: RouteLibraryProps) {
  return (
    <section className="side-section">
      <h2>候选赛道库</h2>
      <div className="route-list">
        {routes.map((route) => {
          const selected = comparedRouteIds.includes(route.id);
          const roadAligned = route.lineage?.roadAligned === true;

          return (
            <article className={`route-card ${route.id === activeRouteId ? "active" : ""}`} key={route.id}>
              <button type="button" className="route-title" onClick={() => onSelectRoute(route.id)}>
                <span style={{ backgroundColor: route.color }} />
                {route.name}
              </button>
              <span className={`route-lineage ${roadAligned ? "aligned" : "pending"}`}>
                {roadAligned ? "已贴合道路参考线" : "待贴合真实路网"}
              </span>
              <p>
                {route.lengthKm.toFixed(3)} km · {route.closedLoop ? "闭环" : "非闭环"}
              </p>
              <label className="compare-toggle">
                <input type="checkbox" checked={selected} onChange={() => onToggleCompare(route.id)} />
                加入对比
              </label>
            </article>
          );
        })}
      </div>
    </section>
  );
}
