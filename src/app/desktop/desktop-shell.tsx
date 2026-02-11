"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useWindowStore, flushWindowSync } from "@/stores/window-store";
import { useDesktopStore } from "@/stores/desktop-store";
import { Desktop } from "@/components/desktop/Desktop";
import { DesktopBackground } from "@/components/desktop/DesktopBackground";
import { WindowRenderer } from "@/components/desktop/WindowRenderer";
import { Taskbar } from "@/components/taskbar/Taskbar";
import { XpraConnector } from "@/components/apps/xpra-window/XpraConnector";
import { NotificationToasts } from "@/components/notifications/NotificationToasts";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useSyncSandboxTheme } from "@/lib/hooks/use-sync-sandbox-theme";
import { useSandboxHeartbeat } from "@/lib/hooks/use-sandbox-heartbeat";
import { useDbusNotifications, useDesktopEntryMonitor } from "@/lib/hooks/use-sandbox-bridge";
import {
  useWorkspaces,
  useWorkspace,
  useWindowState,
  mutateWorkspaces,
} from "@/lib/hooks/use-swr-hooks";
import { Spinner } from "@/components/ui/spinner";
import { Note } from "@/components/ui/note";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/workspace-slug";
import { useGlobalKeybinds } from "@/lib/keyboard/use-global-keybinds";
import { WindowSwitcher } from "@/components/desktop/WindowSwitcher";
import type { SandboxInfo } from "@/types/sandbox";

interface DesktopShellProps {
  user: { id: string; email: string | null; name: string | null };
  /** If set, resolve this slug (workspace name or ID) and auto-select it */
  targetSlug?: string;
}

// ---------------------------------------------------------------------------
// WorkspaceStatusToast (unchanged)
// ---------------------------------------------------------------------------

function WorkspaceStatusToast() {
  const creatingStatus = useWorkspaceStore((s) => s.creatingStatus);
  const creatingError = useWorkspaceStore((s) => s.creatingError);
  const reconnectWorkspace = useWorkspaceStore((s) => s.reconnectWorkspace);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId),
  );
  const activeSandbox = useWorkspaceStore((s) =>
    s.activeWorkspaceId ? s.sandboxes[s.activeWorkspaceId] : null,
  );

  const isCreating = activeWorkspace?.status === "creating";
  const isWaitingForSandbox =
    activeWorkspace?.status === "active" && !activeSandbox;

  if (!creatingStatus && !creatingError && !isCreating && !isWaitingForSandbox) return null;

  let message: string;
  let detail: string | null = null;
  const isError = !!creatingError && !creatingStatus;

  if (isError) {
    message = "Failed to connect to workspace";
    detail = creatingError;
  } else if (creatingStatus) {
    message = "Setting up workspace";
    detail = creatingStatus;
  } else if (isCreating) {
    message = "Workspace is starting up";
    detail = `"${activeWorkspace.name}" is being provisioned...`;
  } else {
    message = "Connecting to workspace";
    detail = "Waiting for sandbox to become available...";
  }

  return (
    <div className="fixed bottom-14 left-1/2 z-[9999] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2">
      <div
        className={`flex items-center gap-3 rounded-xl border px-5 py-3 backdrop-blur-md ${isError ? "border-red-500/30" : "border-gray-alpha-200"}`}
        style={{
          boxShadow: "var(--ds-shadow-modal)",
          background: "var(--ds-background-200)",
        }}
        role="status"
      >
        {!isError && <Spinner size="sm" />}
        <div>
          <p className={`text-label-13 ${isError ? "text-red-900" : "text-gray-1000"}`}>{message}</p>
          {detail && (
            <p className="text-label-12 text-gray-900">{detail}</p>
          )}
        </div>
        {isError && activeWorkspaceId && (
          <button
            className="ml-2 rounded-md bg-gray-1000 px-3 py-1 text-label-12 text-gray-100 transition-opacity hover:opacity-90"
            onClick={() => {
              reconnectWorkspace(activeWorkspaceId).catch(() => {});
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DesktopShell
// ---------------------------------------------------------------------------

function useDocumentTitle() {
  const name = useWorkspaceStore((s) => {
    const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
    return ws?.name ?? null;
  });

  useEffect(() => {
    document.title = name ? `${name} \u2014 Sandcastle` : "Sandcastle";
  }, [name]);
}

/** Sync the URL to /desktop/<slug> when the active workspace changes. */
function useUrlSync() {
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId),
  );

  useEffect(() => {
    if (!activeWorkspace) return;
    const slug = slugify(activeWorkspace.name);
    if (!slug) return;
    const target = `/desktop/${encodeURIComponent(slug)}`;
    if (window.location.pathname !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [activeWorkspace]);
}

export function DesktopShell({ user, targetSlug }: DesktopShellProps) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const setSandboxInfo = useWorkspaceStore((s) => s.setSandboxInfo);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const sandboxes = useWorkspaceStore((s) => s.sandboxes);

  useDocumentTitle();
  useUrlSync();
  useSyncSandboxTheme();
  useSandboxHeartbeat();
  useDbusNotifications();
  useDesktopEntryMonitor();
  const { switcher, launcherToggle } = useGlobalKeybinds();

  // ---- SWR: workspace list ----
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces(!!user);

  // Sync SWR workspace data into Zustand store so existing consumers work.
  // Always push -- including empty lists -- so that remotely-deleted workspaces
  // are pruned from Zustand (setWorkspaces handles active-id reconciliation).
  useEffect(() => {
    setWorkspaces(workspaces);
  }, [workspaces, setWorkspaces]);

  // ---- SWR: active workspace sandbox info ----
  const {
    sandbox: activeSandbox,
    sandboxLost,
    canRecover,
  } = useWorkspace(activeWorkspaceId);
  const reconnectWorkspace = useWorkspaceStore((s) => s.reconnectWorkspace);
  const creatingStatus = useWorkspaceStore((s) => s.creatingStatus);

  // Sync active sandbox info into Zustand store
  useEffect(() => {
    if (activeWorkspaceId && activeSandbox) {
      setSandboxInfo(activeWorkspaceId, activeSandbox);
    }
  }, [activeWorkspaceId, activeSandbox, setSandboxInfo]);

  // When sandbox is lost for the active workspace, update Zustand immediately
  // so the switcher shows a red dot and bridge hooks stop polling
  useEffect(() => {
    if (!activeWorkspaceId || !sandboxLost) return;
    useWorkspaceStore.getState().markSandboxLost(activeWorkspaceId);
  }, [activeWorkspaceId, sandboxLost]);

  // Auto-reconnect when sandbox is detected as dead (up to 3 attempts with backoff)
  const reconnectAttemptsRef = useRef<Record<string, number>>({});
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_RECONNECT_ATTEMPTS = 3;

  // Reset reconnect attempt counter when sandbox comes back (reconnect succeeded)
  useEffect(() => {
    if (activeWorkspaceId && activeSandbox && !sandboxLost) {
      delete reconnectAttemptsRef.current[activeWorkspaceId];
    }
  }, [activeWorkspaceId, activeSandbox, sandboxLost]);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId || !sandboxLost || creatingStatus) return;

    const attempts = reconnectAttemptsRef.current[activeWorkspaceId] ?? 0;
    if (attempts >= MAX_RECONNECT_ATTEMPTS) return;

    reconnectAttemptsRef.current[activeWorkspaceId] = attempts + 1;
    const delay = attempts === 0 ? 0 : Math.pow(2, attempts - 1) * 3000; // 0s, 3s, 6s

    console.log(
      `[desktop] Sandbox lost for workspace ${activeWorkspaceId}.` +
        ` Auto-reconnect attempt ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS}` +
        `${delay ? ` (after ${delay / 1000}s)` : ""}` +
        ` ${canRecover ? "from snapshot" : "(fresh)"}`,
    );

    if (delay === 0) {
      reconnectWorkspace(activeWorkspaceId);
    } else {
      reconnectTimerRef.current = setTimeout(() => {
        reconnectWorkspace(activeWorkspaceId);
      }, delay);
    }
  }, [activeWorkspaceId, sandboxLost, canRecover, creatingStatus, reconnectWorkspace]);

  // ---- Fetch desktop entries when sandbox becomes available ----
  const servicesDomain = activeSandbox?.domains?.services ?? null;
  const fetchedServicesRef = useRef<string | null>(null);
  useEffect(() => {
    if (!servicesDomain || fetchedServicesRef.current === servicesDomain) return;
    fetchedServicesRef.current = servicesDomain;
    useDesktopStore.getState().fetchRemoteApps(servicesDomain);
  }, [servicesDomain]);

  // ---- SWR: window state for active workspace ----
  const { windows: windowStateData } = useWindowState(activeWorkspaceId);

  // ---- Bootstrap: auto-select workspace + auto-create if empty ----
  const MAX_RETRIES = 3;
  const bootstrappedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const attemptCreateWorkspace = useCallback(() => {
    createWorkspace().catch((err) => {
      console.error(
        `Auto-create workspace failed (attempt ${retryCountRef.current + 1}/${MAX_RETRIES + 1}):`,
        err,
      );
      retryCountRef.current += 1;
      if (retryCountRef.current <= MAX_RETRIES) {
        const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
        retryTimerRef.current = setTimeout(() => {
          attemptCreateWorkspace();
        }, delay);
      }
    });
  }, [createWorkspace]);

  // Clean up retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const [slugError, setSlugError] = useState<string | null>(null);

  useEffect(() => {
    if (workspacesLoading || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    if (workspaces.length === 0) {
      retryCountRef.current = 0;
      attemptCreateWorkspace();
      return;
    }

    // If a target slug was provided via URL, resolve it
    if (targetSlug) {
      const decoded = decodeURIComponent(targetSlug);
      const match = workspaces.find(
        (w) => slugify(w.name) === slugify(decoded) || w.id === decoded,
      );
      if (match) {
        setActiveWorkspace(match.id);
        return;
      }
      // Not found in user's workspaces
      setSlugError(`Workspace "${decoded}" not found.`);
      // Fall through to default selection
    }

    // Auto-select workspace: prefer last-used from localStorage, then first active
    const currentActive = useWorkspaceStore.getState().activeWorkspaceId;
    if (!currentActive) {
      let lastId: string | null = null;
      try {
        lastId = localStorage.getItem("sandcastle:last-workspace");
      } catch {}

      const lastUsed = lastId
        ? workspaces.find((w) => w.id === lastId)
        : null;
      const connectable = workspaces.find(
        (w) => w.status === "active" && sandboxes[w.id],
      );
      const fallback = workspaces.find((w) => w.status === "active");
      const target = lastUsed || connectable || fallback || workspaces[0];
      if (target) {
        setActiveWorkspace(target.id);
      }
    }
  }, [workspacesLoading, workspaces, sandboxes, attemptCreateWorkspace, setActiveWorkspace, setWorkspaces, setSandboxInfo, targetSlug]);

  // ---- Sync window store when active workspace changes ----
  const prevWorkspaceRef = useRef<string | null>(null);
  const loadedWorkspacesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeWorkspaceId) return;

    if (prevWorkspaceRef.current && prevWorkspaceRef.current !== activeWorkspaceId) {
      flushWindowSync(prevWorkspaceRef.current);
    }
    prevWorkspaceRef.current = activeWorkspaceId;

    useWindowStore.getState().setActiveWorkspace(activeWorkspaceId);
  }, [activeWorkspaceId]);

  // Load window state from SWR into window store (once per workspace)
  // If no windows are persisted, auto-open a Files window as the welcome screen
  useEffect(() => {
    if (!activeWorkspaceId || !windowStateData) return;
    if (loadedWorkspacesRef.current.has(activeWorkspaceId)) return;
    loadedWorkspacesRef.current.add(activeWorkspaceId);

    if (windowStateData.length > 0) {
      useWindowStore.getState().loadWindowState(
        activeWorkspaceId,
        windowStateData as import("@/types/window").WindowState[],
      );
    } else {
      // First boot: open Files window so user sees WELCOME.md
      useWindowStore.getState().openWindow({
        title: "Files",
        appId: "file-manager",
        width: 800,
        height: 500,
      });
    }
  }, [activeWorkspaceId, windowStateData]);

  // ---- Hydrate sandbox info for non-active workspaces ----
  const hydratedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (workspacesLoading) return;
    const active = workspaces.filter(
      (w) => w.status === "active" && w.sandboxId && !sandboxes[w.id] && !hydratedRef.current.has(w.id),
    );
    if (active.length === 0) return;

    for (const w of active) {
      hydratedRef.current.add(w.id);
    }

    Promise.all(
      active.map(async (w) => {
        try {
          const res = await fetch(`/api/sandbox/${w.id}`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.sandboxLost) {
            useWorkspaceStore.getState().markSandboxLost(w.id);
            mutateWorkspaces();
            return;
          }
          if (data.sandbox) {
            useWorkspaceStore.getState().setSandboxInfo(w.id, data.sandbox as SandboxInfo);
          }
        } catch {}
      }),
    );
  }, [workspaces, workspacesLoading, sandboxes]);

  if (workspacesLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-100" role="status">
        <Spinner size="lg" />
      </div>
    );
  }

  if (slugError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-100">
        <div className="max-w-sm">
          <Note type="error">
            <p className="text-copy-13 font-medium text-gray-1000">{slugError}</p>
            <p className="mt-1 text-copy-13 text-gray-900">
              The workspace may have been renamed or deleted.
            </p>
          </Note>
          <div className="mt-4 flex gap-2">
            <Button
              size="small"
              onClick={() => {
                setSlugError(null);
                window.history.replaceState(null, "", "/desktop");
              }}
            >
              Go to Desktop
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <DesktopBackground />
      <XpraConnector />
      <Desktop />
      <WindowRenderer />
      <Taskbar launcherToggle={launcherToggle} />
      <NotificationToasts />
      <NotificationCenter />
      <WorkspaceStatusToast />
      <WindowSwitcher
        visible={switcher.visible}
        windows={switcher.windows}
        selectedIndex={switcher.selectedIndex}
      />
    </div>
  );
}
