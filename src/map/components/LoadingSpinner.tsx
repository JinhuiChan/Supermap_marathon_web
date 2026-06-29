interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = "加载地图中..." }: LoadingSpinnerProps) {
  return (
    <div className="map-loading">
      <div className="map-loading-spinner" />
      <span>{message}</span>
    </div>
  );
}
