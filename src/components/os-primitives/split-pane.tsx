"use client";

import {
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
  type CSSProperties,
} from "react";

// ---------------------------------------------------------------------------
// SplitPane — resizable two-panel layout (horizontal or vertical).
//
// Usage:
//   <SplitPane defaultSize={240} min={120} max={400}>
//     <SplitPane.Panel>Sidebar</SplitPane.Panel>
//     <SplitPane.Panel>Main</SplitPane.Panel>
//   </SplitPane>
//
//   <SplitPane direction="vertical" defaultSize={200} min={100}>
//     <SplitPane.Panel>Top</SplitPane.Panel>
//     <SplitPane.Panel>Bottom</SplitPane.Panel>
//   </SplitPane>
// ---------------------------------------------------------------------------

interface SplitPaneProps {
  children: [ReactNode, ReactNode];
  direction?: "horizontal" | "vertical";
  defaultSize?: number;
  min?: number;
  max?: number;
  /** On narrow viewports, stack panels vertically and hide the resize handle */
  collapseBelow?: number;
  onResize?: (size: number) => void;
  className?: string;
}

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function SplitPaneRoot({
  children,
  direction = "horizontal",
  defaultSize = 240,
  min = 100,
  max = 600,
  collapseBelow = 640,
  onResize,
  className = "",
}: SplitPaneProps) {
  const [size, setSize] = useState(defaultSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(0);
  const isMobile = useMediaQuery(`(max-width: ${collapseBelow}px)`);

  const isHorizontal = direction === "horizontal" && !isMobile;
  const [first, second] = children;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      startPos.current = isHorizontal ? e.clientX : e.clientY;
      startSize.current = size;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isHorizontal, size],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const delta = (isHorizontal ? e.clientX : e.clientY) - startPos.current;
      const next = Math.min(max, Math.max(min, startSize.current + delta));
      setSize(next);
      onResize?.(next);
    },
    [isHorizontal, min, max, onResize],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // On mobile, stack vertically with no resize handle
  if (isMobile) {
    return (
      <div ref={containerRef} className={`flex flex-col h-full w-full overflow-hidden ${className}`}>
        <div className="shrink-0 overflow-auto border-b border-gray-alpha-200">{first}</div>
        <div className="flex-1 overflow-hidden">{second}</div>
      </div>
    );
  }

  const firstStyle: CSSProperties = isHorizontal
    ? { width: size, minWidth: min, maxWidth: max, flexShrink: 0 }
    : { height: size, minHeight: min, maxHeight: max, flexShrink: 0 };

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? "flex-row" : "flex-col"} h-full w-full overflow-hidden ${className}`}
    >
      <div style={firstStyle} className="overflow-hidden">
        {first}
      </div>
      <div
        className={`shrink-0 ${
          isHorizontal
            ? "w-px cursor-col-resize hover:w-0.5 hover:bg-blue-700/50 active:w-0.5 active:bg-blue-700"
            : "h-px cursor-row-resize hover:h-0.5 hover:bg-blue-700/50 active:h-0.5 active:bg-blue-700"
        } bg-gray-alpha-200 transition-colors`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="separator"
        aria-orientation={isHorizontal ? "vertical" : "horizontal"}
        tabIndex={0}
      />
      <div className="flex-1 overflow-hidden">{second}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SplitPane.Panel — thin wrapper for semantic clarity
// ---------------------------------------------------------------------------

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`h-full w-full overflow-auto ${className}`}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Export as compound component
// ---------------------------------------------------------------------------

export const SplitPane = Object.assign(SplitPaneRoot, {
  Panel,
});
