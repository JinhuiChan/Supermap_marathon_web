const dataItems = [
  {
    name: "候选赛道线数据",
    file: "wuhan-marathon-routes.geojson",
    href: "/data/wuhan-marathon-routes.geojson"
  },
  {
    name: "赛事保障点数据",
    file: "wuhan-marathon-support-points.geojson",
    href: "/data/wuhan-marathon-support-points.geojson"
  }
];

export function DataPackagePanel() {
  return (
    <section className="side-section data-package">
      <h2>GIS 数据包</h2>
      <p className="muted">可导入 SuperMap iDesktopX，用于制作武汉马拉松二维地图和后续 iServer 服务。</p>
      <div className="data-file-list">
        {dataItems.map((item) => (
          <a href={item.href} key={item.file} download>
            <span>{item.name}</span>
            <strong>{item.file}</strong>
          </a>
        ))}
      </div>
    </section>
  );
}
