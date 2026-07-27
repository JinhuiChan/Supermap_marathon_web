interface RouteDeleteDialogProps {
  routeName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RouteDeleteDialog({
  routeName,
  onCancel,
  onConfirm
}: RouteDeleteDialogProps) {
  return (
    <div className="route-delete-backdrop">
      <section
        className="route-delete-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="route-delete-title"
        aria-describedby="route-delete-description"
      >
        <span className="route-delete-eyebrow">删除候选路线</span>
        <h2 id="route-delete-title">删除这条路线？</h2>
        <p id="route-delete-description">
          <strong>{routeName}</strong>
          将从地图、候选列表和对比结果中移除。删除后可使用原控制点重新生成。
        </p>
        <div className="route-delete-dialog-actions">
          <button type="button" className="route-delete-cancel" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="route-delete-confirm" onClick={onConfirm} autoFocus>
            确认删除
          </button>
        </div>
      </section>
    </div>
  );
}
