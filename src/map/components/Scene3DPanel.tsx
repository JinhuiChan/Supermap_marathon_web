import { useEffect, useState } from "react";
import { superMapConfig } from "../../config/supermap";

type Scene3DStatus = "checking" | "available" | "unavailable";

export function Scene3DPanel() {
  const [status, setStatus] = useState<Scene3DStatus>("checking");
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const resp = await fetch(superMapConfig.iClient3DUrl, {
          method: "HEAD",
          cache: "no-store"
        });
        if (!cancelled) setStatus(resp.ok ? "available" : "unavailable");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

  const statusText: Record<Scene3DStatus, string> = {
    checking: "检测中...",
    available: "三维可用",
    unavailable: "待安装"
  };

  const statusClass: Record<Scene3DStatus, string> = {
    checking: "checking",
    available: "ready",
    unavailable: "pending"
  };

  return (
    <section className="side-section scene3d-panel">
      <button
        type="button"
        className="scene3d-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <h2>三维地形预览</h2>
        <span className={`readiness-item ${statusClass[status]}`}>
          <strong>{statusText[status]}</strong>
        </span>
      </button>

      {!collapsed && (
        <div className="scene3d-body">
          {status === "available" ? (
            <div className="scene3d-container">
              <p className="muted">
                三维场景已就绪。当前使用 SuperMap iClient3D for WebGL 加载三维地形。
              </p>
              <div className="scene3d-viewport" id="scene3d-container">
                <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>
                  三维场景加载中...
                </p>
              </div>
            </div>
          ) : status === "unavailable" ? (
            <div className="scene3d-unavailable">
              <p className="muted">
                SuperMap iClient3D for WebGL/WebGPU 客户端当前不可用。
              </p>
              <p className="muted">
                预期路径：{superMapConfig.iClient3DUrl}
              </p>
              <p className="muted">
                请确认 iServer 已安装 iClient3D 组件，或检查路径配置是否正确。
              </p>
            </div>
          ) : (
            <p className="muted">正在检测三维客户端...</p>
          )}

          <dl className="service-list">
            <div>
              <dt>三维场景服务</dt>
              <dd>{superMapConfig.fallbackSceneService}</dd>
            </div>
            <div>
              <dt>目标服务（待发布）</dt>
              <dd>{superMapConfig.expectedSceneServiceUrl}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
