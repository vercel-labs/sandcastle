import { useCallback } from "react";
import { useWindowStore } from "@/stores/window-store";
import { useXpraStore } from "@/stores/xpra-store";
import { APP_COMPONENTS } from "@/components/apps/app-registry";
import type { DesktopEntry } from "@/types/desktop-entry";

/**
 * Resolve the canonical app identifier for a desktop entry.
 * Prefer `component` (builtin React app), then `exec` (X11 command), then `id`.
 */
export function getAppId(entry: DesktopEntry): string {
  return entry.component || entry.exec || entry.id;
}

/** Default window dimensions keyed by appId. */
const APP_WINDOW_DEFAULTS: Record<string, { width: number; height: number }> = {
  terminal: { width: 720, height: 480 },
};

const DEFAULT_WINDOW_SIZE = { width: 800, height: 600 };

/**
 * Hook that returns a stable callback to launch any desktop entry.
 *
 * Builtin apps (those registered in APP_COMPONENTS) open a React window via
 * the window store. Everything else is dispatched to Xpra as an X11 launch.
 */
export function useLaunchApp() {
  const openWindow = useWindowStore((s) => s.openWindow);
  const launchX11App = useXpraStore((s) => s.launchApp);

  const launch = useCallback(
    (entry: DesktopEntry) => {
      const appId = getAppId(entry);

      if (appId in APP_COMPONENTS) {
        const { width, height } =
          APP_WINDOW_DEFAULTS[appId] ?? DEFAULT_WINDOW_SIZE;
        openWindow({ title: entry.name, appId, width, height });
      } else {
        launchX11App(appId);
      }
    },
    [openWindow, launchX11App],
  );

  return launch;
}
