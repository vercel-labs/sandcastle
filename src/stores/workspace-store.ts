import { create } from "zustand";
import type { StoreApi } from "zustand";
import type { Workspace } from "@/types/workspace";
import type { SandboxInfo } from "@/types/sandbox";
import { mutateWorkspaces, mutateWorkspace } from "@/lib/hooks/use-swr-hooks";

interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  sandboxes: Record<string, SandboxInfo>;
  creatingStatus: string | null;
  creatingError: string | null;

  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspace: (id: string) => void;
  setSandboxInfo: (workspaceId: string, info: SandboxInfo) => void;
  removeSandboxInfo: (workspaceId: string) => void;
  /** Mark a workspace as stopped/sandbox-lost in the client store (removes sandbox info + sets status to stopped). */
  markSandboxLost: (workspaceId: string) => void;
  createWorkspace: (name?: string) => Promise<Workspace>;
  updateWorkspace: (id: string, updates: { name?: string; icon?: string; background?: string | null }) => Promise<void>;
  stopWorkspace: (id: string) => Promise<void>;
  killWorkspace: (id: string) => Promise<void>;
  killAllWorkspaces: () => Promise<void>;
  restartWorkspace: (id: string) => Promise<void>;
  /** Reconnect a workspace whose sandbox died -- creates a new sandbox from its snapshot */
  reconnectWorkspace: (id: string) => Promise<void>;
  snapshotWorkspace: (id: string) => Promise<string>;
}

type SetState = StoreApi<WorkspaceStore>["setState"];

/**
 * Shared provisioning logic used by both restartWorkspace and reconnectWorkspace.
 * Handles the sandbox create API call, optimistic state updates, and error handling.
 */
async function provisionSandbox(
  id: string,
  workspace: Workspace,
  set: SetState,
  label: string,
) {
  const res = await fetch("/api/sandbox/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: workspace.name,
      snapshotId: workspace.snapshotId || undefined,
      workspaceId: id,
    }),
  });

  if (res.ok) {
    set({ creatingStatus: "Connecting\u2026" });
    const { workspace: updated, sandbox } = await res.json();
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id ? { ...updated, id } : w,
      ),
      activeWorkspaceId: id,
      sandboxes: { ...state.sandboxes, [id]: sandbox },
      creatingStatus: null,
      creatingError: null,
    }));
    return { updated, sandbox };
  }

  const body = await res.json().catch(() => ({}));
  set({
    creatingStatus: null,
    creatingError: body.error || `Failed to ${label} workspace`,
  });
  return null;
}

/** Mark a workspace as "creating" and clear its sandbox entry. */
function markCreating(
  set: SetState,
  id: string,
  statusMessage: string,
) {
  set((state) => ({
    creatingStatus: statusMessage,
    workspaces: state.workspaces.map((w) =>
      w.id === id ? { ...w, status: "creating" as const, sandboxId: null } : w,
    ),
    sandboxes: Object.fromEntries(
      Object.entries(state.sandboxes).filter(([k]) => k !== id),
    ),
  }));
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  sandboxes: {},
  creatingStatus: null,
  creatingError: null,

  setWorkspaces: (workspaces) =>
    set((state) => {
      // Bail out early if the workspace list is identical (same ids, same order,
      // same status) to avoid producing new object references that trigger
      // cascading re-renders.
      const unchanged =
        workspaces.length === state.workspaces.length &&
        workspaces.every(
          (w, i) =>
            w.id === state.workspaces[i].id &&
            w.status === state.workspaces[i].status &&
            w.name === state.workspaces[i].name &&
            w.sandboxId === state.workspaces[i].sandboxId &&
            w.snapshotId === state.workspaces[i].snapshotId,
        );
      if (unchanged) return state;

      const ids = new Set(workspaces.map((w) => w.id));

      // Reconcile activeWorkspaceId: clear if the active workspace was removed
      let activeWorkspaceId = state.activeWorkspaceId;
      if (activeWorkspaceId && !ids.has(activeWorkspaceId)) {
        const fallback =
          workspaces.find((w) => w.status === "active") ?? workspaces[0] ?? null;
        activeWorkspaceId = fallback?.id ?? null;
      }

      // Prune sandbox entries for workspaces that no longer exist.
      // Only create a new object if something was actually pruned.
      const sandboxKeys = Object.keys(state.sandboxes);
      const needsPrune = sandboxKeys.some((k) => !ids.has(k));
      const sandboxes = needsPrune
        ? Object.fromEntries(
            Object.entries(state.sandboxes).filter(([k]) => ids.has(k)),
          )
        : state.sandboxes;

      return { workspaces, activeWorkspaceId, sandboxes };
    }),

  setActiveWorkspace: (id) => {
    set({ activeWorkspaceId: id });
    try {
      localStorage.setItem("sandcastle:last-workspace", id);
    } catch {}
  },

  setSandboxInfo: (workspaceId, info) => {
    set((state) => ({
      sandboxes: { ...state.sandboxes, [workspaceId]: info },
    }));
  },

  removeSandboxInfo: (workspaceId) => {
    set((state) => ({
      sandboxes: Object.fromEntries(
        Object.entries(state.sandboxes).filter(([k]) => k !== workspaceId),
      ),
    }));
  },

  markSandboxLost: (workspaceId) => {
    set((state) => ({
      sandboxes: Object.fromEntries(
        Object.entries(state.sandboxes).filter(([k]) => k !== workspaceId),
      ),
      workspaces: state.workspaces.map((ws) =>
        ws.id === workspaceId
          ? { ...ws, status: "stopped" as const, sandboxId: null }
          : ws,
      ),
    }));
  },

  createWorkspace: async (name) => {
    set({ creatingStatus: "Provisioning sandbox...", creatingError: null });
    try {
      const res = await fetch("/api/sandbox/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        set({ creatingStatus: null, creatingError: error || "Failed to create workspace" });
        throw new Error(error);
      }
      set({ creatingStatus: "Connecting..." });
      const { workspace, sandbox } = await res.json();
      set((state) => ({
        workspaces: [...state.workspaces, workspace],
        activeWorkspaceId: workspace.id,
        sandboxes: { ...state.sandboxes, [workspace.id]: sandbox },
        creatingStatus: null,
        creatingError: null,
      }));
      try {
        localStorage.setItem("sandcastle:last-workspace", workspace.id);
      } catch {}
      void mutateWorkspaces();
      return workspace;
    } catch (err) {
      set((s) => ({
        creatingStatus: null,
        creatingError: s.creatingError || (err instanceof Error ? err.message : "Failed to create workspace"),
      }));
      throw err;
    }
  },

  updateWorkspace: async (id, updates) => {
    // Optimistic update
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    }));

    const res = await fetch(`/api/sandbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      void mutateWorkspaces();
      return;
    }
    const { workspace } = await res.json();
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, ...workspace } : w)),
    }));
    void mutateWorkspaces();
    void mutateWorkspace(id);
  },

  stopWorkspace: async (id) => {
    await fetch(`/api/sandbox/${id}/stop`, { method: "POST" });
    get().markSandboxLost(id);
    void mutateWorkspaces();
    void mutateWorkspace(id);
  },

  killWorkspace: async (id) => {
    await fetch(`/api/sandbox/${id}/delete`, { method: "POST" });
    set((state) => {
      const remaining = state.workspaces.filter((w) => w.id !== id);
      const newActive =
        state.activeWorkspaceId === id
          ? remaining.find((w) => w.status === "active")?.id ?? null
          : state.activeWorkspaceId;
      return {
        workspaces: remaining,
        activeWorkspaceId: newActive,
        sandboxes: Object.fromEntries(
          Object.entries(state.sandboxes).filter(([k]) => k !== id),
        ),
      };
    });
    void mutateWorkspaces();
  },

  killAllWorkspaces: async () => {
    const { workspaces } = get();
    await Promise.all(
      workspaces.map((w) =>
        fetch(`/api/sandbox/${w.id}/delete`, { method: "POST" }).catch(() => {}),
      ),
    );
    set({ workspaces: [], activeWorkspaceId: null, sandboxes: {} });
    void mutateWorkspaces();
  },

  restartWorkspace: async (id) => {
    const workspace = get().workspaces.find((w) => w.id === id);
    if (!workspace) return;

    set({ creatingStatus: "Stopping current sandbox\u2026" });

    if (workspace.sandboxId) {
      await fetch(`/api/sandbox/${id}/stop`, { method: "POST" });
    }

    markCreating(set, id, "Provisioning sandbox\u2026");

    try {
      await provisionSandbox(id, workspace, set, "restart");
    } catch (err) {
      set({
        creatingStatus: null,
        creatingError: err instanceof Error ? err.message : "Failed to restart workspace",
      });
    }
    void mutateWorkspaces();
    void mutateWorkspace(id);
  },

  reconnectWorkspace: async (id) => {
    const workspace = get().workspaces.find((w) => w.id === id);
    if (!workspace) return;

    // Don't double-reconnect
    if (get().creatingStatus) return;

    const snapshotId = workspace.snapshotId;
    console.log(
      `[workspace] Reconnecting "${workspace.name}" (${id})` +
      `${snapshotId ? ` from snapshot ${snapshotId}` : " (fresh, no snapshot)"}`,
    );

    markCreating(
      set,
      id,
      snapshotId ? "Reconnecting from snapshot\u2026" : "Reconnecting\u2026",
    );

    try {
      const result = await provisionSandbox(id, workspace, set, "reconnect");
      if (result) {
        console.log(
          `[workspace] Reconnected "${workspace.name}" -> sandbox ${result.sandbox.sandboxId}`,
        );
      } else {
        console.error(`[workspace] Reconnect failed`);
      }
    } catch (err) {
      console.error(`[workspace] Reconnect error:`, err);
      set({
        creatingStatus: null,
        creatingError: err instanceof Error ? err.message : "Failed to reconnect workspace",
      });
    }
    void mutateWorkspaces();
    void mutateWorkspace(id);
  },

  snapshotWorkspace: async (id) => {
    const res = await fetch(`/api/sandbox/${id}/snapshot`, { method: "POST" });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error);
    }
    const { snapshotId } = await res.json();
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id
          ? { ...w, status: "snapshotted" as const, sandboxId: null, snapshotId }
          : w,
      ),
      sandboxes: Object.fromEntries(
        Object.entries(state.sandboxes).filter(([k]) => k !== id),
      ),
    }));
    void mutateWorkspaces();
    return snapshotId;
  },
}));

export function useActiveSandbox() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const sandbox = useWorkspaceStore(
    (s) => (s.activeWorkspaceId ? s.sandboxes[s.activeWorkspaceId] : null),
  );
  return { activeWorkspaceId, sandbox };
}
