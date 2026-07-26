import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type ResizeOrientation = "vertical" | "horizontal";

interface ResizeHandleProps {
  orientation: ResizeOrientation;
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  className?: string;
  onResize: (delta: number) => void;
  onReset: () => void;
}

export function resizeDeltaForKey(
  key: string,
  orientation: ResizeOrientation,
  largeStep: boolean
): number | null {
  const step = largeStep ? 24 : 10;
  if (orientation === "vertical") {
    if (key === "ArrowLeft") return -step;
    if (key === "ArrowRight") return step;
  } else {
    if (key === "ArrowUp") return -step;
    if (key === "ArrowDown") return step;
  }
  return null;
}

export function shouldResetFromClickDetail(detail: number): boolean {
  return detail >= 2;
}

export function ResizeHandle({
  orientation,
  ariaLabel,
  value,
  min,
  max,
  className = "",
  onResize,
  onReset
}: ResizeHandleProps) {
  const pointerId = useRef<number | null>(null);
  const lastAxisPosition = useRef(0);
  const [active, setActive] = useState(false);

  const axisPosition = (event: PointerEvent<HTMLDivElement>) =>
    orientation === "vertical" ? event.clientX : event.clientY;

  const finishPointerResize = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    setActive(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = resizeDeltaForKey(event.key, orientation, event.shiftKey);
    if (delta === null) return;
    event.preventDefault();
    onResize(delta);
  };

  return (
    <div
      className={`workspace-resize-handle ${orientation} ${className} ${active ? "active" : ""}`.trim()}
      role="separator"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-orientation={orientation}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      onClick={(event) => {
        if (shouldResetFromClickDetail(event.detail)) onReset();
      }}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        pointerId.current = event.pointerId;
        lastAxisPosition.current = axisPosition(event);
        event.currentTarget.setPointerCapture(event.pointerId);
        setActive(true);
      }}
      onPointerMove={(event) => {
        if (pointerId.current !== event.pointerId) return;
        const nextPosition = axisPosition(event);
        const delta = nextPosition - lastAxisPosition.current;
        lastAxisPosition.current = nextPosition;
        if (delta !== 0) onResize(delta);
      }}
      onPointerUp={finishPointerResize}
      onPointerCancel={finishPointerResize}
    >
      <span aria-hidden="true" />
    </div>
  );
}
