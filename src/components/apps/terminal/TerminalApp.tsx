"use client";

import { useEffect, useRef } from "react";
import type { Terminal, FitAddon } from "ghostty-web";
import { useActiveSandbox } from "@/stores/workspace-store";
import { NoWorkspacePlaceholder } from "@/components/apps/no-workspace-placeholder";
import {
  saveTerminalState,
  loadTerminalState,
} from "@/lib/terminal/state-cache";

const SERIALIZE_INTERVAL_MS = 5_000;

export function TerminalApp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { activeWorkspaceId, sandbox } = useActiveSandbox();
  const servicesDomain = sandbox?.domains.services;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !servicesDomain || !activeWorkspaceId) return;

    let disposed = false;
    let connectFrameId: number | null = null;
    let term: Terminal | undefined;
    let fitAddon: FitAddon | undefined;
    let ws: WebSocket;
    let serializeInterval: ReturnType<typeof setInterval> | null = null;

    // Defer setup to a requestAnimationFrame so that in React Strict Mode's
    // double-mount/unmount cycle the first invocation is cancelled before it
    // opens a WebSocket.
    connectFrameId = requestAnimationFrame(() => {
      if (disposed) return;
      connectFrameId = null;

      (async () => {
        const ghostty = await import("ghostty-web");
        if (disposed) return;

        await ghostty.init();
        if (disposed) return;

        const t = new ghostty.Terminal({
          fontSize: 14,
          cursorBlink: true,
          fontFamily: 'Monaco, Menlo, "Courier New", monospace',
          theme: {
            background: "#0a0a0a",
            foreground: "#ededed",
            cursor: "#ffffff",
          },
        });
        term = t;

        const fa = new ghostty.FitAddon();
        fitAddon = fa;
        t.loadAddon(fa);

        t.open(container);
        fa.fit();
        fa.observeResize();

        if (disposed) {
          fa.dispose();
          t.dispose();
          return;
        }

        // Restore cached terminal content before connecting so the user
        // immediately sees previous output instead of a blank screen.
        const cached = loadTerminalState(activeWorkspaceId);
        if (cached) {
          t.write(cached);
        }

        const wsUrl = `wss://${servicesDomain}/ws/terminal?cols=${t.cols}&rows=${t.rows}`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (disposed) return;
          if (!cached) {
            t.write("\x1b[2J\x1b[H");
          }
        };

        ws.onmessage = (event: MessageEvent) => {
          if (disposed) return;
          if (typeof event.data === "string") {
            t.write(event.data);
          } else if (event.data instanceof ArrayBuffer) {
            t.write(new Uint8Array(event.data));
          } else if (event.data instanceof Blob) {
            event.data.arrayBuffer().then((buf: ArrayBuffer) => {
              if (!disposed) t.write(new Uint8Array(buf));
            });
          }
        };

        ws.onclose = () => {
          if (!disposed) {
            t.write("\r\n\x1b[90m[Connection closed]\x1b[0m\r\n");
          }
        };

        ws.onerror = () => {
          if (!disposed) {
            t.write("\r\n\x1b[31m[Connection error]\x1b[0m\r\n");
          }
        };

        t.onData((data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });

        t.onResize((size: { cols: number; rows: number }) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "resize",
                cols: size.cols,
                rows: size.rows,
              }),
            );
          }
        });

        serializeInterval = setInterval(() => {
          if (disposed || !activeWorkspaceId) return;
          try {
            const buffer = t.buffer?.active;
            if (!buffer) return;

            const lines: string[] = [];
            const rowCount = buffer.length;
            for (let i = 0; i < rowCount; i++) {
              const line = buffer.getLine(i);
              if (line) {
                lines.push(line.translateToString(true));
              }
            }
            while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
              lines.pop();
            }
            if (lines.length > 0) {
              saveTerminalState(activeWorkspaceId, lines.join("\r\n") + "\r\n");
            }
          } catch {
            // best-effort
          }
        }, SERIALIZE_INTERVAL_MS);
      })();
    });

    return () => {
      disposed = true;

      if (connectFrameId !== null) {
        cancelAnimationFrame(connectFrameId);
      }

      // Save final state before tearing down
      if (term && activeWorkspaceId) {
        try {
          const buffer = term.buffer?.active;
          if (buffer) {
            const lines: string[] = [];
            const rowCount = buffer.length;
            for (let i = 0; i < rowCount; i++) {
              const line = buffer.getLine(i);
              if (line) lines.push(line.translateToString(true));
            }
            while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
              lines.pop();
            }
            if (lines.length > 0) {
              saveTerminalState(
                activeWorkspaceId,
                lines.join("\r\n") + "\r\n",
              );
            }
          }
        } catch {
          // best-effort
        }
      }

      if (serializeInterval) clearInterval(serializeInterval);
      ws?.close();
      fitAddon?.dispose();
      term?.dispose();
    };
  }, [servicesDomain, activeWorkspaceId]);

  if (!activeWorkspaceId || !sandbox) {
    return (
      <NoWorkspacePlaceholder message="No active workspace. Create one to use the terminal." />
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-background-100"
      role="application"
      aria-label="Terminal"
    />
  );
}
