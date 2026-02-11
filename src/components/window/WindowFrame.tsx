"use client";

import type { WindowState } from "@/types/window";
import { useWindowStore } from "@/stores/window-store";
import { X, Minus, Maximize2, Minimize2 } from "lucide-react";
import { AppIcon } from "@/components/app-icon";

interface WindowFrameProps {
  window: WindowState;
  onPointerDownTitleBar: (e: React.PointerEvent) => void;
  onDoubleClickTitleBar?: () => void;
}

export function WindowFrame({ window: win, onPointerDownTitleBar, onDoubleClickTitleBar }: WindowFrameProps) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);

  return (
    <header
      className="flex h-10 shrink-0 items-center justify-between border-b border-gray-alpha-400 bg-background-200 px-3 select-none"
      onPointerDown={onPointerDownTitleBar}
      onDoubleClick={onDoubleClickTitleBar}
    >
      <div className="flex min-w-0 items-center gap-2">
        <AppIcon appId={win.appId} size={16} className="h-4 w-4 shrink-0" />
        <h2 className="truncate text-label-13 text-gray-1000">{win.title}</h2>
      </div>

      <div
        className="flex items-center gap-0.5"
        onPointerDown={(e) => e.stopPropagation()}
        role="toolbar"
        aria-label="Window controls"
      >
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000"
          onClick={() => minimizeWindow(win.id)}
          aria-label="Minimize window"
        >
          <Minus size={14} />
        </button>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000"
          onClick={() =>
            win.maximized ? restoreWindow(win.id) : maximizeWindow(win.id)
          }
          aria-label={win.maximized ? "Restore window" : "Maximize window"}
        >
          {win.maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-red-200 hover:text-red-900"
          onClick={() => closeWindow(win.id)}
          aria-label="Close window"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
