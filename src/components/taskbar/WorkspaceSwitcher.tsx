"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceIcon } from "@/components/workspace-icon";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/ContextMenu";
import { Tooltip } from "@/components/ui/tooltip";
import { useUser } from "@/lib/hooks/use-swr-hooks";
import type { Workspace } from "@/types/workspace";

function WorkspaceButton({ ws }: { ws: Workspace }) {
  const {
    activeWorkspaceId,
    setActiveWorkspace,
    stopWorkspace,
    killWorkspace,
    restartWorkspace,
    snapshotWorkspace,
    updateWorkspace,
  } = useWorkspaceStore();

  const isActive = ws.id === activeWorkspaceId;
  const isRunning = ws.status === "active";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          className={`relative flex h-7 min-w-7 items-center justify-center rounded-md px-1 transition-all ${
            isActive
              ? "bg-gray-alpha-300 text-gray-1000"
              : "text-gray-900 hover:bg-gray-alpha-200 hover:text-gray-1000"
          } ${ws.status === "creating" ? "animate-pulse" : ""}`}
          onClick={() => setActiveWorkspace(ws.id)}
          aria-label={`${ws.name} workspace (${ws.status})`}
          title={`${ws.name} (${ws.status})`}
        >
          <WorkspaceIcon name={ws.icon} size={14} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-background-100 ${
              ws.status === "active"
                ? "bg-green-700"
                : ws.status === "creating"
                  ? "bg-amber-700"
                  : ws.status === "stopped"
                    ? "bg-red-700"
                    : "bg-gray-600"
            }`}
          />
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-[200px] z-[9999]">
        {!isActive && (
          <ContextMenuItem onClick={() => setActiveWorkspace(ws.id)}>
            Switch to Workspace
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={() => {
            const name = globalThis.prompt("Rename workspace:", ws.name);
            if (name?.trim()) {
              updateWorkspace(ws.id, { name: name.trim() });
            }
          }}
        >
          Rename...
        </ContextMenuItem>
        <ContextMenuSeparator />
        {isRunning && (
          <>
            <ContextMenuItem onClick={() => restartWorkspace(ws.id)}>
              Restart
            </ContextMenuItem>
            <ContextMenuItem onClick={() => snapshotWorkspace(ws.id)}>
              Snapshot
            </ContextMenuItem>
            <ContextMenuItem onClick={() => stopWorkspace(ws.id)}>
              Stop
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            if (
              globalThis.confirm(
                `Delete workspace "${ws.name}"? This cannot be undone.`,
              )
            ) {
              killWorkspace(ws.id);
            }
          }}
        >
          <span className="text-[var(--ds-red-900)]">Delete Workspace</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function WorkspaceSwitcher() {
  const { workspaces, createWorkspace } = useWorkspaceStore();
  const { user } = useUser();

  const visibleWorkspaces = workspaces.filter(
    (ws) => ws.status === "active" || ws.status === "creating" || ws.status === "stopped",
  );

  const limit = user?.workspaceLimit ?? null;
  const atLimit = limit !== null && visibleWorkspaces.length >= limit;
  const isGuest = user?.role === "guest";
  const tooltipText = atLimit
    ? isGuest
      ? "Sign in for more workspaces"
      : `Workspace limit reached (${limit})`
    : "New workspace";

  const plusIcon = (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <line x1="6" y1="2" x2="6" y2="10" />
      <line x1="2" y1="6" x2="10" y2="6" />
    </svg>
  );

  return (
    <div className="flex items-center gap-0.5 px-1.5">
      {visibleWorkspaces.map((ws) => (
        <WorkspaceButton key={ws.id} ws={ws} />
      ))}
      <Tooltip text={tooltipText} position="top" desktopOnly>
      {atLimit && isGuest ? (
        <a
          href="/api/auth/vercel"
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-800 transition-all hover:bg-gray-alpha-200 hover:text-gray-1000"
          aria-label={tooltipText}
        >
          {plusIcon}
        </a>
      ) : (
        <button
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
            atLimit
              ? "cursor-not-allowed text-gray-500 opacity-50"
              : "text-gray-800 hover:bg-gray-alpha-200 hover:text-gray-1000"
          }`}
          onClick={() => { if (!atLimit) createWorkspace(); }}
          disabled={atLimit}
          aria-label={tooltipText}
        >
          {plusIcon}
        </button>
      )}
      </Tooltip>
    </div>
  );
}
