import { useCallback, useEffect, useState } from "react";
import { superMapConfig } from "../config/supermap";
import {
  checkSuperMapIserver,
  checkSuperMapResource,
  checkSuperMapWms,
  type SuperMapResourceStatus,
  type SuperMapStatus
} from "../services/supermapHealth";

const statusText: Record<SuperMapStatus, string> = {
  checking: "检测中",
  online: "已连接",
  offline: "未连接"
};

const resourceText: Record<SuperMapResourceStatus, string> = {
  checking: "检测中",
  ready: "已发布",
  pending: "待发布"
};

type ServiceKey = "roadMap" | "roadData" | "poiData" | "constraints" | "demSlope";

const serviceItems: Array<{ key: ServiceKey; label: string; kind: "wms" | "rest"; url: string }> = [
  { key: "roadMap", label: "道路底图服务", kind: "wms", url: superMapConfig.serviceUrls.roadMapWms },
  { key: "roadData", label: "道路数据服务", kind: "rest", url: superMapConfig.serviceUrls.roadDataRest },
  { key: "poiData", label: "POI 数据服务", kind: "rest", url: superMapConfig.serviceUrls.poiDataRest },
  { key: "constraints", label: "约束图层服务", kind: "rest", url: superMapConfig.serviceUrls.constraintMapRest },
  { key: "demSlope", label: "DEM/坡度图层服务", kind: "rest", url: superMapConfig.serviceUrls.demSlopeMapRest }
];

const initialServiceStatuses = Object.fromEntries(
  serviceItems.map((item) => [item.key, "checking"])
) as Record<ServiceKey, SuperMapResourceStatus>;

export function SuperMapStatusPanel() {
  const [status, setStatus] = useState<SuperMapStatus>("checking");
  const [serviceStatuses, setServiceStatuses] = useState<Record<ServiceKey, SuperMapResourceStatus>>(initialServiceStatuses);
  const [lastCheck, setLastCheck] = useState<string>("--");

  const runCheck = useCallback((isActive: () => boolean) => {
    const setIfActive = <T,>(setter: (value: T) => void, value: T) => {
      if (isActive()) setter(value);
    };

    checkSuperMapIserver(superMapConfig.iServerBaseUrl).then((s) => {
      setIfActive(setStatus, s);
    });
    for (const item of serviceItems) {
      const checker = item.kind === "wms" ? checkSuperMapWms : checkSuperMapResource;
      checker(item.url).then((s) => {
        if (!isActive()) return;
        setServiceStatuses((current) => ({ ...current, [item.key]: s }));
      });
    }

    if (isActive()) setLastCheck(new Date().toLocaleTimeString("zh-CN"));
  }, []);

  useEffect(() => {
    let active = true;
    const isActive = () => active;

    runCheck(isActive);
    const interval = window.setInterval(() => runCheck(isActive), 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [runCheck]);

  const publishedCount = serviceItems.filter((item) => serviceStatuses[item.key] === "ready").length;
  const allFoundationServicesReady = publishedCount === serviceItems.length;

  return (
    <section className="side-section supermap-status">
      <h2>SuperMap 接入</h2>

      <div className={`status-pill ${status}`}>
        <span>SuperMap iServer</span>
        <strong>{statusText[status]}</strong>
      </div>

      <div className="service-readiness" aria-label="SuperMap 二维 GIS 服务发布状态">
        {serviceItems.map((item) => (
          <div key={item.key} className={`readiness-item ${serviceStatuses[item.key]}`}>
            <span>{item.label}</span>
            <strong>{resourceText[serviceStatuses[item.key]]}</strong>
          </div>
        ))}
      </div>

      {allFoundationServicesReady ? (
        <div className="service-ready-banner">
          武汉马拉松基础二维 GIS 服务已齐备，Web 端可同时使用道路、POI、约束和 DEM/坡度服务。
        </div>
      ) : (
        <div className="service-pending-hint">
          已发布 {publishedCount}/{serviceItems.length} 个基础 GIS 服务。约束和 DEM/坡度如显示待发布，请在 iDesktopX 中保存地图后通过 iServer 发布。
        </div>
      )}

      <dl className="service-list">
        <div>
          <dt>版本要求</dt>
          <dd>{superMapConfig.version}</dd>
        </div>
        <div>
          <dt>iServer 地址</dt>
          <dd>{superMapConfig.iServerBaseUrl}</dd>
        </div>
        <div>
          <dt>WMS 底图源</dt>
          <dd title={superMapConfig.wmsMapUrl}>图层 {superMapConfig.wmsLayerName} · iDesktop 发布图</dd>
        </div>
        <div>
          <dt>约束图层服务</dt>
          <dd title={superMapConfig.serviceUrls.constraintMapRest}>map-wuhan-constraints</dd>
        </div>
        <div>
          <dt>DEM/坡度服务</dt>
          <dd title={superMapConfig.serviceUrls.demSlopeMapRest}>map-wuhan-dem-slope</dd>
        </div>
        <div>
          <dt>iClient JavaScript</dt>
          <dd>{superMapConfig.iClientJavaScriptUrl}</dd>
        </div>
        <div>
          <dt>武汉 DEM / 坡度数据</dt>
          <dd>{superMapConfig.demMetadata.name} · {superMapConfig.demMetadata.crs}</dd>
        </div>
        <div>
          <dt>DEM 范围 / 高程</dt>
          <dd>{superMapConfig.demMetadata.bounds} · {superMapConfig.demMetadata.elevationRange}</dd>
        </div>
      </dl>

      <p className="integration-note">
        地图面板默认使用 iDesktop 发布到 iServer 的武汉道路 WMS 地图；候选路线、路网、约束和 POI 由前端矢量图层叠加。
        上次检测：{lastCheck}
      </p>
    </section>
  );
}
