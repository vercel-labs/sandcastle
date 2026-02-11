"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useKeybindStore } from "@/stores/keybind-store";
import { useWindowStore } from "@/stores/window-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useNotificationStore } from "@/stores/notification-store";
import { matchesCombo } from "./types";
import type { WindowState } from "@/types/window";

interface WindowSwitcherState {
  visible: boolean;
  windows: WindowState[];
  selectedIndex: number;
}

export function useGlobalKeybinds() {
  const [switcher, setSwitcher] = useState<WindowSwitcherState>({
    visible: false,
    windows: [],
    selectedIndex: 0,
  });
  const switcherRef = useRef(switcher);
  switcherRef.current = switcher;

  const [launcherToggle, setLauncherToggle] = useState(0);

  const handleAction = useCallback((id: string) => {
    const windowStore = useWindowStore.getState();
    const workspaceStore = useWorkspaceStore.getState();

    switch (id) {
      // ── Window Cycling ───────────────────────────────────────────
      case "window.cycle-next":
      case "window.cycle-prev": {
        const windows = windowStore.getWindows();
        if (windows.length === 0) return;
        const sorted = [...windows].sort((a, b) => b.zIndex - a.zIndex);
        const current = switcherRef.current;

        if (!current.visible) {
          const startIndex = id === "window.cycle-next" ? 1 : sorted.length - 1;
          setSwitcher({
            visible: true,
            windows: sorted,
            selectedIndex: Math.min(startIndex, sorted.length - 1),
          });
        } else {
          const dir = id === "window.cycle-next" ? 1 : -1;
          const next = (current.selectedIndex + dir + current.windows.length) % current.windows.length;
          setSwitcher((prev) => ({ ...prev, selectedIndex: next }));
        }
        return;
      }

      // ── Window Management ────────────────────────────────────────
      case "window.close": {
        const top = windowStore.getTopmostWindow();
        if (top) windowStore.closeWindow(top.id);
        return;
      }
      case "window.minimize": {
        const top = windowStore.getTopmostWindow();
        if (top) windowStore.minimizeWindow(top.id);
        return;
      }
      case "window.maximize": {
        const top = windowStore.getTopmostWindow();
        if (top) {
          if (top.maximized) windowStore.restoreWindow(top.id);
          else windowStore.maximizeWindow(top.id);
        }
        return;
      }
      case "window.snap-left": {
        const top = windowStore.getTopmostWindow();
        if (top) {
          if (top.snapped === "left") windowStore.unsnapWindow(top.id);
          else windowStore.snapWindow(top.id, "left");
        }
        return;
      }
      case "window.snap-right": {
        const top = windowStore.getTopmostWindow();
        if (top) {
          if (top.snapped === "right") windowStore.unsnapWindow(top.id);
          else windowStore.snapWindow(top.id, "right");
        }
        return;
      }

      // ── Workspace Switching ──────────────────────────────────────
      default: {
        const wsMatch = id.match(/^workspace\.(\d+)$/);
        if (wsMatch) {
          const index = parseInt(wsMatch[1], 10) - 1;
          const visible = workspaceStore.workspaces.filter(
            (w) => w.status === "active" || w.status === "creating",
          );
          if (index < visible.length) {
            workspaceStore.setActiveWorkspace(visible[index].id);
          }
          return;
        }

        // ── Launcher shortcuts ───────────────────────────────────
        if (id === "launcher.open") {
          setLauncherToggle((n) => n + 1);
          return;
        }
        if (id === "launcher.terminal") {
          windowStore.openWindow({ title: "Terminal", appId: "terminal", width: 720, height: 480 });
          return;
        }
        if (id === "launcher.file-manager") {
          windowStore.openWindow({ title: "Files", appId: "file-manager", width: 800, height: 500 });
          return;
        }
        if (id === "launcher.settings") {
          windowStore.openWindow({ title: "Settings", appId: "settings", width: 700, height: 500 });
          return;
        }

        // ── System ───────────────────────────────────────────────
        if (id === "system.notification-center") {
          useNotificationStore.getState().toggleCenter();
          return;
        }
      }
    }
  }, []);

  // Commit the Alt-Tab selection when Alt is released
  const commitSwitcher = useCallback(() => {
    const current = switcherRef.current;
    if (!current.visible) return;
    const selected = current.windows[current.selectedIndex];
    if (selected) {
      useWindowStore.getState().focusWindow(selected.id);
    }
    setSwitcher({ visible: false, windows: [], selectedIndex: 0 });
  }, []);

  useEffect(() => {
    const store = useKeybindStore.getState();
    const { definitions } = store;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const state = useKeybindStore.getState();
      if (state.suspended) return;
      const { getBinding } = state;
      for (const def of definitions) {
        if (def.onKeyUp) continue;
        const binding = getBinding(def.id);
        if (!binding) continue;
        if (!def.repeat && e.repeat) continue;
        if (matchesCombo(e, binding)) {
          e.preventDefault();
          e.stopPropagation();
          handleAction(def.id);
          return;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Commit Alt-Tab switcher when Alt is released
      if (e.key === "Alt" && switcherRef.current.visible) {
        commitSwitcher();
        return;
      }

      const upState = useKeybindStore.getState();
      if (upState.suspended) return;
      const { getBinding } = upState;
      for (const def of definitions) {
        if (!def.onKeyUp) continue;
        const binding = getBinding(def.id);
        if (!binding) continue;
        if (matchesCombo(e, binding)) {
          e.preventDefault();
          handleAction(def.id);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
    };
  }, [handleAction, commitSwitcher]);

  return { switcher, launcherToggle };
}
