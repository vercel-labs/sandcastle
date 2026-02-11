"use client";

import { useWindowStore } from "@/stores/window-store";
import { Tooltip } from "@/components/ui/tooltip";
import { AppIcon } from "@/components/app-icon";

export function RunningApps() {
  const windowsByWorkspace = useWindowStore((s) => s.windowsByWorkspace);
  const activeWorkspaceId = useWindowStore((s) => s.activeWorkspaceId);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);

  const windows = activeWorkspaceId
    ? windowsByWorkspace[activeWorkspaceId] || []
    : [];

  if (windows.length === 0) {
    return <div className="flex flex-1 items-center px-1" />;
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 no-scrollbar" role="tablist" aria-label="Running applications">
      {windows.map((win) => {
        const isActive = win.focused && !win.minimized;

        return (
          <Tooltip key={win.id} text={win.title} position="top" delay delayTime={400} desktopOnly>
            <button
              role="tab"
              aria-selected={isActive}
              aria-label={`${win.title}${isActive ? " (active)" : win.minimized ? " (minimized)" : ""}`}
              className={`group relative flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-label-13 transition-all sm:max-w-44 sm:px-2.5 ${
                isActive
                  ? "bg-gray-alpha-300 text-gray-1000"
                  : "text-gray-900 hover:bg-gray-alpha-200 hover:text-gray-1000"
              }`}
              onClick={() => {
                if (isActive) {
                  minimizeWindow(win.id);
                } else {
                  focusWindow(win.id);
                }
              }}
            >
              <AppIcon appId={win.appId} size={16} className="h-4 w-4 shrink-0" />
              <span className="hidden truncate sm:inline">{win.title}</span>
              <span
                className={`absolute bottom-0 left-1/2 h-[2px] -translate-x-1/2 rounded-full transition-all ${
                  isActive
                    ? "w-4 bg-blue-700"
                    : "w-2 bg-gray-600 group-hover:w-3 group-hover:bg-gray-500"
                }`}
              />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
