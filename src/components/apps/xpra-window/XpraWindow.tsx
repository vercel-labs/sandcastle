"use client";

import { useEffect, useRef, useCallback } from "react";
import { useXpraStore, type XpraWindowState } from "@/stores/xpra-store";
import type { XpraKeyboard } from "xpra-html5-client";

interface XpraWindowProps {
  win: XpraWindowState;
  isFocused: boolean;
}

export function XpraWindowCanvas({ win, isFocused }: XpraWindowProps) {
  const client = useXpraStore((s) => s.client);
  const registerCanvas = useXpraStore((s) => s.registerCanvas);
  const unregisterCanvas = useXpraStore((s) => s.unregisterCanvas);
  const focusWindow = useXpraStore((s) => s.focusWindow);
  const cursor = useXpraStore((s) => s.cursor);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keyboardRef = useRef<XpraKeyboard | null>(null);

  useEffect(() => {
    import("xpra-html5-client").then(({ XpraKeyboard: Kb }) => {
      keyboardRef.current = new Kb();
    });
  }, []);

  // Register canvas for Xpra draw events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    registerCanvas(win.wid, canvas);

    const timer = setTimeout(() => {
      if (client) client.sendBufferRefresh(win.wid);
    }, 100);

    return () => {
      clearTimeout(timer);
      unregisterCanvas(win.wid);
    };
  }, [win.wid, registerCanvas, unregisterCanvas, client]);

  // Size the canvas to match the Xpra window dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !client) return;
    canvas.width = win.width;
    canvas.height = win.height;
    canvas.style.width = `${win.width}px`;
    canvas.style.height = `${win.height}px`;
    client.sendBufferRefresh(win.wid);
  }, [win.width, win.height, client, win.wid]);

  const getCoords = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top),
      };
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!client) return;
      const { x, y } = getCoords(e);
      client.sendMouseMove(win.wid, [x, y], []);
    },
    [client, win.wid, getCoords],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!client) return;
      const { x, y } = getCoords(e);
      const button = e.button === 0 ? 1 : e.button === 2 ? 3 : 2;
      client.sendMouseButton(win.wid, [x, y], button, true, []);
      focusWindow(win.wid);
    },
    [client, win.wid, focusWindow, getCoords],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!client) return;
      const { x, y } = getCoords(e);
      const button = e.button === 0 ? 1 : e.button === 2 ? 3 : 2;
      client.sendMouseButton(win.wid, [x, y], button, false, []);
    },
    [client, win.wid, getCoords],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      if (!client) return;
      e.preventDefault();
      const { x, y } = getCoords(e as unknown as React.MouseEvent);
      const button = e.deltaY < 0 ? 4 : 5;
      const distance = Math.abs(e.deltaY);
      client.sendMouseWheel(win.wid, button, distance, [x, y], []);
    },
    [client, win.wid, getCoords],
  );

  // Keyboard forwarding when this window is focused
  useEffect(() => {
    if (!isFocused || !client) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      const kb = keyboardRef.current;
      if (kb) {
        const info = kb.getKey(e);
        const mods = kb.getModifiers(e);
        client.sendKeyAction(win.wid, info.name, true, mods, info.key, info.code, info.group);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      const kb = keyboardRef.current;
      if (kb) {
        const info = kb.getKey(e);
        const mods = kb.getModifiers(e);
        client.sendKeyAction(win.wid, info.name, false, mods, info.key, info.code, info.group);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isFocused, win.wid, client]);

  // Refresh buffer when un-minimized
  useEffect(() => {
    if (!win.minimized && client) {
      client.sendBufferRefresh(win.wid);
    }
  }, [win.minimized, client, win.wid]);

  const cursorStyle = cursor
    ? `url(${cursor.url}) ${cursor.xhot} ${cursor.yhot}, auto`
    : undefined;

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      className="block h-full w-full bg-neutral-900"
      style={cursorStyle ? { cursor: cursorStyle } : undefined}
    />
  );
}
