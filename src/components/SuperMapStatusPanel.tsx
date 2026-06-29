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

export function SuperMapStatusPanel() {
  const [status, setStatus] = useState<SuperMapStatus>("checking");
  const [mapStatus, setMapStatus] = useState<SuperMapResourceStatus>("checking");
  const [sceneStatus, setSceneStatus] = useState<SuperMapResourceStatus>("checking");
  const [wmsStatus, setWmsStatus] = useState<SuperMapResourceStatus>("checking");
  const [lastCheck, setLastCheck] = useState<string>("—");

  const runCheck = useCallback((isActive: () => boolean) => {
    const setIfActive = <T,>(setter: (value: T) => void, value: T) => {
      if (isActive()) setter(value);
    };

    checkSuperMapIserver(superMapConfig.iServerBaseUrl).then((s) => {
      setIfActive(setStatus, s);
    });
    checkSuperMapResource(superMapConfig.expectedMapServiceUrl).then((s) => {
      setIfActive(setMapStatus, s);
    });
    checkSuperMapResource(superMapConfig.expectedSceneServiceUrl).then((s) => {
      setIfActive(setSceneStatus, s);
    });
    checkSuperMapWms(superMapConfig.wmsMapUrl).then((s) => {
      setIfActive(setWmsStatus, s);
    });

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

  const servicesReady = mapStatus === "ready" && sceneStatus === "ready";

  return (
    <section className="side-section supermap-status">
      <h2>SuperMap 接入</h2>

      <div className={`status-pill ${status}`}>
        <span>SuperMap iServer</span>
        <strong>{statusText[status]}</strong>
      </div>

      <div className="service-readiness" aria-label="SuperMap 服务发布状态">
        <div className={`readiness-item ${wmsStatus}`}>
          <span>WMS 底图服务</span>
          <strong>{resourceText[wmsStatus]}</strong>
        </div>
        <div className={`readiness-item ${mapStatus}`}>
          <span>二维地图服务</span>
          <strong>{resourceText[mapStatus]}</strong>
        </div>
        <div className={`readiness-item ${sceneStatus}`}>
          <span>三维地形服务</span>
          <strong>{resourceText[sceneStatus]}</strong>
        </div>
      </div>

      {servicesReady && (
        <div className="service-ready-banner">
          武汉马拉松地图服务已就绪，页面使用 DEM WMS 底图叠加业务矢量图层。
        </div>
      )}

      {status === "online" && !servicesReady && (
        <div className="service-pending-hint">
          iServer 已连接。二维地图和三维服务可继续通过 iDesktopX 发布向导完善。
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
          <dd title={superMapConfig.wmsMapUrl}>{superMapConfig.wmsLayerName} DEM (SuperMap iServer)</dd>
        </div>
        <div>
          <dt>在线真实底图</dt>
          <dd>{superMapConfig.onlineBasemap.name} · OpenStreetMap</dd>
        </div>
        <div>
          <dt>iClient JavaScript</dt>
          <dd>{superMapConfig.iClientJavaScriptUrl}</dd>
        </div>
        <div>
          <dt>iClient3D WebGL</dt>
          <dd>{superMapConfig.iClient3DUrl}</dd>
        </div>
        <div>
          <dt>武汉 DEM 数据</dt>
          <dd>
            {superMapConfig.demMetadata.name} · {superMapConfig.demMetadata.crs}
          </dd>
        </div>
        <div>
          <dt>DEM 范围 / 高程</dt>
          <dd>
            {superMapConfig.demMetadata.bounds} · {superMapConfig.demMetadata.elevationRange}
          </dd>
        </div>
      </dl>

      <p className="integration-note">
        地图面板默认使用在线真实地图，保留 SuperMap iServer WMS 的 DEM 子图层作为可切换底图；2026 官方路线、备选路线和服务点由前端矢量图层叠加。
        上次检测：{lastCheck}
      </p>
    </section>
  );
}
