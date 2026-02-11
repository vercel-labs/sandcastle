import { useXpraStore } from "@/stores/xpra-store";
import { useDesktopStore } from "@/stores/desktop-store";

function getXpraWid(appId: string): number | null {
  if (!appId.startsWith("xpra:")) return null;
  const wid = parseInt(appId.split(":")[1], 10);
  return isNaN(wid) ? null : wid;
}

/**
 * Resolve the best icon URL for a given appId.
 *
 * Priority:
 * 1. Xpra windowIcons (data: URI blobs from X11 _NET_WM_ICON)
 * 2. DesktopEntry.icon (Dusk SVGs for builtins, sandbox-proxied Linux icons for X11 apps)
 * 3. null (caller renders a fallback)
 *
 * This reads directly from store state (not hooks) so it can be called
 * from either React components or plain functions.
 */
export function resolveWindowIcon(appId: string): string | null {
  const xpraWid = getXpraWid(appId);
  if (xpraWid !== null) {
    const xpraIcon = useXpraStore.getState().windowIcons.get(xpraWid);
    if (xpraIcon) return xpraIcon;
  }

  const apps = useDesktopStore.getState().apps;
  const entry = apps.find((a) => a.id === appId || a.component === appId);
  return entry?.icon ?? null;
}

/**
 * React hook version — subscribes to both stores so the component
 * re-renders when icons change (e.g. Xpra sends a windowIcon event
 * after the window first appears).
 */
export function useResolvedIcon(appId: string): string | null {
  const windowIcons = useXpraStore((s) => s.windowIcons);
  const apps = useDesktopStore((s) => s.apps);

  const xpraWid = getXpraWid(appId);
  if (xpraWid !== null) {
    const xpraIcon = windowIcons.get(xpraWid);
    if (xpraIcon) return xpraIcon;
  }

  const entry = apps.find((a) => a.id === appId || a.component === appId);
  return entry?.icon ?? null;
}
