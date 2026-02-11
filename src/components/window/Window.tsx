"use client";

import { useCallback, useRef, useState } from "react";
import type { WindowState, SnapZone } from "@/types/window";
import { useWindowStore } from "@/stores/window-store";
import { WindowFrame } from "./WindowFrame";
import { WindowContent } from "./WindowContent";
import { SnapPreview } from "./SnapPreview";
import { TASKBAR_HEIGHT } from "@/lib/constants";

interface WindowProps {
  window: WindowState;
  children: React.ReactNode;
}
const MIN_WIDTH = 320;
const MIN_HEIGHT = 200;
const SNAP_THRESHOLD = 8;
const CORNER_SIZE = 80;

const RESIZE_EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
const CURSOR_MAP: Record<string, string> = {
  n: "cursor-n-resize",
  s: "cursor-s-resize",
  e: "cursor-e-resize",
  w: "cursor-w-resize",
  ne: "cursor-ne-resize",
  nw: "cursor-nw-resize",
  se: "cursor-se-resize",
  sw: "cursor-sw-resize",
};
const EDGE_STYLE: Record<string, React.CSSProperties> = {
  n: { top: -3, left: 4, right: 4, height: 6 },
  s: { bottom: -3, left: 4, right: 4, height: 6 },
  e: { right: -3, top: 4, bottom: 4, width: 6 },
  w: { left: -3, top: 4, bottom: 4, width: 6 },
  ne: { top: -3, right: -3, width: 12, height: 12 },
  nw: { top: -3, left: -3, width: 12, height: 12 },
  se: { bottom: -3, right: -3, width: 12, height: 12 },
  sw: { bottom: -3, left: -3, width: 12, height: 12 },
};

function detectSnapZone(clientX: number, clientY: number): SnapZone {
  const vw = window.innerWidth;
  const vh = window.innerHeight - TASKBAR_HEIGHT;
  const nearLeft = clientX <= SNAP_THRESHOLD;
  const nearRight = clientX >= vw - SNAP_THRESHOLD;
  const nearTop = clientY <= SNAP_THRESHOLD;
  const nearBottom = clientY >= vh - SNAP_THRESHOLD;

  if (nearLeft && clientY < CORNER_SIZE) return "top-left";
  if (nearLeft && clientY > vh - CORNER_SIZE) return "bottom-left";
  if (nearRight && clientY < CORNER_SIZE) return "top-right";
  if (nearRight && clientY > vh - CORNER_SIZE) return "bottom-right";
  if (nearLeft) return "left";
  if (nearRight) return "right";
  if (nearTop && clientX < CORNER_SIZE) return "top-left";
  if (nearTop && clientX > vw - CORNER_SIZE) return "top-right";
  if (nearTop) return "top";
  if (nearBottom && clientX < CORNER_SIZE) return "bottom-left";
  if (nearBottom && clientX > vw - CORNER_SIZE) return "bottom-right";
  return null;
}

export function Window({ window: win, children }: WindowProps) {
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const resizeWindow = useWindowStore((s) => s.resizeWindow);
  const snapWindow = useWindowStore((s) => s.snapWindow);
  const unsnapWindow = useWindowStore((s) => s.unsnapWindow);
  const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
  const [snapPreview, setSnapPreview] = useState<SnapZone>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    wasSnapped: boolean;
    preSnapW: number;
    preSnapH: number;
  } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    origW: number;
    origH: number;
    origX: number;
    origY: number;
    edge: string;
  } | null>(null);

  const restoreWindow = useWindowStore((s) => s.restoreWindow);

  const handleTitleBarPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      focusWindow(win.id);

      const wasSnapped = !!win.snapped;
      const wasMaximized = win.maximized;
      const preSnapW = win.preSnapSize?.width ?? win.size.width;
      const preSnapH = win.preSnapSize?.height ?? win.size.height;

      if (wasMaximized) {
        restoreWindow(win.id);
      } else if (wasSnapped) {
        unsnapWindow(win.id);
      }

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: wasSnapped || wasMaximized ? e.clientX - preSnapW / 2 : win.position.x,
        origY: wasSnapped || wasMaximized ? e.clientY - 20 : win.position.y,
        wasSnapped,
        preSnapW,
        preSnapH,
      };

      if (wasSnapped || wasMaximized) {
        moveWindow(win.id, {
          x: dragRef.current.origX,
          y: dragRef.current.origY,
        });
      }

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        moveWindow(win.id, {
          x: dragRef.current.origX + dx,
          y: Math.max(0, dragRef.current.origY + dy),
        });

        const zone = detectSnapZone(ev.clientX, ev.clientY);
        setSnapPreview(zone);
      };

      const onUp = (ev: PointerEvent) => {
        dragRef.current = null;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);

        const zone = detectSnapZone(ev.clientX, ev.clientY);
        setSnapPreview(null);
        if (zone === "top") {
          maximizeWindow(win.id);
        } else if (zone) {
          snapWindow(win.id, zone);
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [win.id, win.position, win.size, win.maximized, win.snapped, win.preSnapSize, focusWindow, moveWindow, snapWindow, unsnapWindow, maximizeWindow, restoreWindow],
  );

  const handleTitleBarDoubleClick = useCallback(() => {
    if (win.snapped) {
      unsnapWindow(win.id);
    } else {
      maximizeWindow(win.id);
    }
  }, [win.id, win.snapped, unsnapWindow, maximizeWindow]);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (win.maximized) return;
      const edge = (e.currentTarget as HTMLElement).dataset.edge!;
      e.preventDefault();
      e.stopPropagation();
      focusWindow(win.id);

      if (win.snapped) {
        unsnapWindow(win.id);
      }

      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: win.size.width,
        origH: win.size.height,
        origX: win.position.x,
        origY: win.position.y,
        edge,
      };

      const onMove = (ev: PointerEvent) => {
        if (!resizeRef.current) return;
        const dx = ev.clientX - resizeRef.current.startX;
        const dy = ev.clientY - resizeRef.current.startY;
        const { origW, origH, origX, origY, edge: e } = resizeRef.current;

        let newW = origW;
        let newH = origH;
        let newX = origX;
        let newY = origY;

        if (e.includes("e")) newW = Math.max(MIN_WIDTH, origW + dx);
        if (e.includes("s")) newH = Math.max(MIN_HEIGHT, origH + dy);
        if (e.includes("w")) {
          newW = Math.max(MIN_WIDTH, origW - dx);
          if (newW !== MIN_WIDTH) newX = origX + dx;
        }
        if (e.includes("n")) {
          newH = Math.max(MIN_HEIGHT, origH - dy);
          if (newH !== MIN_HEIGHT) newY = Math.max(0, origY + dy);
        }

        resizeWindow(win.id, { width: newW, height: newH });
        moveWindow(win.id, { x: newX, y: newY });
      };

      const onUp = () => {
        resizeRef.current = null;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [win.id, win.position, win.size, win.maximized, win.snapped, focusWindow, resizeWindow, moveWindow, unsnapWindow],
  );

  if (win.minimized) return null;

  const isSnapped = !!win.snapped;
  const style: React.CSSProperties = win.maximized
    ? {
        top: 0,
        left: 0,
        width: "100%",
        height: `calc(100% - ${TASKBAR_HEIGHT}px)`,
        zIndex: win.zIndex,
      }
    : {
        top: win.position.y,
        left: win.position.x,
        width: win.size.width,
        height: win.size.height,
        zIndex: win.zIndex,
      };

  return (
    <>
      <section
        className={`absolute flex flex-col overflow-hidden transition-shadow ${
          isSnapped || win.maximized ? "rounded-none" : "rounded-xl"
        } ${win.focused ? "shadow-lg" : "shadow-md"}`}
        style={{
          ...style,
          boxShadow: win.focused
            ? "var(--ds-shadow-border-large)"
            : "var(--ds-shadow-border-small)",
          transition: isSnapped ? "none" : undefined,
        }}
        onPointerDown={() => focusWindow(win.id)}
        onFocus={() => focusWindow(win.id)}
        role="dialog"
        aria-label={`${win.title} window`}
        tabIndex={0}
      >
        <WindowFrame
          window={win}
          onPointerDownTitleBar={handleTitleBarPointerDown}
          onDoubleClickTitleBar={handleTitleBarDoubleClick}
        />
        <WindowContent>{children}</WindowContent>

        {!win.maximized && !isSnapped &&
          RESIZE_EDGES.map((edge) => (
            <div
              key={edge}
              data-edge={edge}
              className={`absolute ${CURSOR_MAP[edge]}`}
              style={EDGE_STYLE[edge]}
              onPointerDown={handleResizePointerDown}
              aria-hidden="true"
            />
          ))}
      </section>

      <SnapPreview zone={snapPreview} />
    </>
  );
}
