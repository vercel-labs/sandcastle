"use client";

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { mutateWorkspace } from "@/lib/hooks/use-swr-hooks";

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const EXTEND_DURATION = 10 * 60 * 1000; // extend by 10 minutes each heartbeat
const RATE_LIMIT_BACKOFF = 60 * 1000; // back off 1 minute on 429

export function useSandboxHeartbeat() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId),
  );
  const hasActiveSandbox =
    workspace?.status === "active" && workspace.sandboxId !== null;
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);
  const backoffRef = useRef(false);

  useEffect(() => {
    if (!activeWorkspaceId || !hasActiveSandbox) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    function stopInterval() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function handleSandboxLost(workspaceId: string) {
      stopInterval();
      useWorkspaceStore.getState().markSandboxLost(workspaceId);
      void mutateWorkspace(workspaceId);
    }

    function extend() {
      if (!activeWorkspaceId || backoffRef.current) return;
      fetch(`/api/sandbox/${activeWorkspaceId}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: EXTEND_DURATION }),
      })
        .then(async (res) => {
          if (res.status === 429) {
            console.warn(
              `[heartbeat] Rate limited. Backing off for ${RATE_LIMIT_BACKOFF / 1000}s.`,
            );
            backoffRef.current = true;
            setTimeout(() => {
              backoffRef.current = false;
            }, RATE_LIMIT_BACKOFF);
            return;
          }

          const body = await res.json().catch(() => ({}));

          if (body.maxLifetimeReached) {
            console.warn(
              `[heartbeat] Max sandbox lifetime reached for workspace ${activeWorkspaceId}. Sandbox will expire naturally.`,
            );
            stopInterval();
            return;
          }

          if (!res.ok) {
            if (body.sandboxLost) {
              console.warn(
                `[heartbeat] Sandbox lost for workspace ${activeWorkspaceId}. Triggering recovery.`,
              );
              handleSandboxLost(activeWorkspaceId);
            } else {
              console.warn(
                `[heartbeat] Failed to extend sandbox for workspace ${activeWorkspaceId} (${res.status}).`,
              );
            }
          }
        })
        .catch((err) => {
          console.warn(`[heartbeat] Extend request failed:`, err);
        });
    }

    // Extend immediately on mount / workspace switch
    extend();

    intervalRef.current = setInterval(extend, HEARTBEAT_INTERVAL);

    return () => {
      stopInterval();
    };
  }, [activeWorkspaceId, hasActiveSandbox]);
}
