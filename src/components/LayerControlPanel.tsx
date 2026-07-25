import { activeCityPackage, type CityPackage } from "../config/cityPackages";
import type { MapLayerVisibility } from "../map/components/SuperMapMap";

interface LayerControlPanelProps {
  cityPackage?: CityPackage;
  visibility: MapLayerVisibility;
  onChange: (visibility: MapLayerVisibility) => void;
}

export function LayerControlPanel({
  cityPackage = activeCityPackage,
  visibility,
  onChange
}: LayerControlPanelProps) {
  const superMapConfig = cityPackage.superMap;
  const updateLayer = (key: keyof MapLayerVisibility) => {
    onChange({
      ...visibility,
      [key]: !visibility[key]
    });
  };

  return (
    <section className="side-section layer-control">
      <h2>图层控制</h2>
      <div className="basemap-lock" aria-label="底图来源">
        <strong>iDesktop 发布图</strong>
        <small>比赛指定底图 · {superMapConfig.wmsLayerName} 图层</small>
        <p>{superMapConfig.basemapPolicy}</p>
      </div>
      <label className="layer-toggle">
        <input type="checkbox" checked={visibility.routes} onChange={() => updateLayer("routes")} />
        <span>
          <strong>候选赛道</strong>
          <small>显示路线走向、起终点和点击选线</small>
        </span>
      </label>
      <label className="layer-toggle">
        <input type="checkbox" checked={visibility.roadNetwork} onChange={() => updateLayer("roadNetwork")} />
        <span>
          <strong>{cityPackage.name}道路网络</strong>
          <small>显示用于算法生成和校核的真实 OSM 道路网络</small>
        </span>
      </label>
    </section>
  );
}
