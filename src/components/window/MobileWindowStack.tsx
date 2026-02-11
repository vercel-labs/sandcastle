"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { WindowState } from "@/types/window";
import { useWindowStore } from "@/stores/window-store";
import { X, ChevronDown, ArrowUpDown, Maximize2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { APP_COMPONENTS } from "@/components/apps/app-registry";
import { AppIcon } from "@/components/app-icon";
import { XpraWindowCanvas } from "@/components/apps/xpra-window/XpraWindow";
import { useXpraStore } from "@/stores/xpra-store";
import { useVisualViewport } from "@/lib/hooks/use-visual-viewport";
import { TASKBAR_HEIGHT } from "@/lib/constants";
import { useIsTouchDevice } from "@/lib/hooks/use-is-touch-device";
import { XpraMobileToolbar } from "@/components/apps/xpra-window/XpraMobileToolbar";

function AppContent({ appId, meta }: { appId: string; meta?: Record<string, unknown> }) {
  const AppComponent = APP_COMPONENTS[appId];
  if (AppComponent) return <AppComponent meta={meta} />;

  if (appId.startsWith("xpra:")) {
    const wid = parseInt(appId.split(":")[1], 10);
    return <XpraWindowMobile wid={wid} />;
  }

  return <X11Placeholder command={appId} />;
}

function XpraWindowMobile({ wid }: { wid: number }) {
  const win = useXpraStore((s) => s.windows.get(wid));
  const focusedWid = useXpraStore((s) => s.focusedWid);
  if (!win) return <div className="flex h-full items-center justify-center text-neutral-500 text-sm">Window closed</div>;
  return <XpraWindowCanvas win={win} isFocused={focusedWid === wid} />;
}

function X11Placeholder({ command }: { command: string }) {
  const launchApp = useXpraStore((s) => s.launchApp);
  const connected = useXpraStore((s) => s.connected);
  const launchedRef = useRef(false);

  useEffect(() => {
    if (connected && !launchedRef.current) {
      launchedRef.current = true;
      launchApp(command);
    }
  }, [connected, command, launchApp]);

  return <div className="flex h-full items-center justify-center text-neutral-500 text-sm">Launching {command}...</div>;
}

function getXpraWid(appId: string): number | null {
  if (!appId.startsWith("xpra:")) return null;
  const wid = parseInt(appId.split(":")[1], 10);
  return Number.isFinite(wid) ? wid : null;
}

function PaneHeader({
  win,
  isSplit,
  onClose,
  onSplit,
  onUnsplit,
}: {
  win: WindowState;
  isSplit: boolean;
  onClose: () => void;
  onSplit: () => void;
  onUnsplit: () => void;
}) {
  const isTouch = useIsTouchDevice();
  const xpraWid = getXpraWid(win.appId);

  return (
    <div className="flex shrink-0 flex-col border-b border-gray-alpha-400 bg-background-200">
      <div className="flex h-11 items-center gap-2 px-3">
        <span className="text-gray-900" aria-hidden="true">
          <AppIcon appId={win.appId} size={16} className="h-4 w-4 shrink-0" />
        </span>
        <span className="flex-1 truncate text-label-13 text-gray-1000">
          {win.title}
        </span>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-900 transition-colors active:bg-gray-alpha-200"
          onClick={isSplit ? onUnsplit : onSplit}
          aria-label={isSplit ? "Exit split view" : "Split view"}
        >
          {isSplit ? <Maximize2 /> : <ArrowUpDown />}
        </button>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-900 transition-colors active:bg-red-200 active:text-red-900"
          onClick={onClose}
          aria-label={`Close ${win.title}`}
        >
          <X />
        </button>
      </div>
      {isTouch && xpraWid !== null && (
        <div className="flex h-9 items-center border-t border-gray-alpha-200 px-2">
          <XpraMobileToolbar wid={xpraWid} />
        </div>
      )}
    </div>
  );
}

function CollapsedRow({
  win,
  onExpand,
  onSplit,
  onClose,
}: {
  win: WindowState;
  onExpand: () => void;
  onSplit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center border-b border-gray-alpha-400 bg-background-100">
      <button
        className="flex flex-1 items-center gap-3 px-4 active:bg-gray-alpha-200"
        onClick={onExpand}
        aria-label={`Expand ${win.title}`}
      >
        <span className="text-gray-900" aria-hidden="true">
          <AppIcon appId={win.appId} size={16} className="h-4 w-4 shrink-0" />
        </span>
        <span className="flex-1 truncate text-left text-label-14 text-gray-1000">
          {win.title}
        </span>
        <span className="text-gray-900" aria-hidden="true">
          <ChevronDown />
        </span>
      </button>
      <button
        className="flex h-12 w-10 items-center justify-center text-gray-900 active:bg-gray-alpha-200"
        onClick={onSplit}
        aria-label={`Split ${win.title}`}
      >
        <ArrowUpDown />
      </button>
      <button
        className="flex h-12 w-10 items-center justify-center text-gray-900 active:bg-red-200 active:text-red-900"
        onClick={onClose}
        aria-label={`Close ${win.title}`}
      >
        <X />
      </button>
    </div>
  );
}

interface MobileWindowStackProps {
  windows: WindowState[];
}

export function MobileWindowStack({ windows }: MobileWindowStackProps) {
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const viewport = useVisualViewport();

  // When the iOS keyboard is open, visualViewport.height shrinks.
  // Detect this to hide the taskbar reservation and give the terminal full space.
  const keyboardOpen = typeof window !== "undefined"
    ? viewport.height < window.innerHeight - 50
    : false;

  // splitId: the id of the secondary window shown in split view
  const [splitId, setSplitId] = useState<string | null>(null);

  const focusedWin = windows.find((w) => w.focused && !w.minimized);
  const splitWin = splitId ? windows.find((w) => w.id === splitId) : null;

  // Clear split if the split window was closed
  if (splitId && !splitWin) {
    setSplitId(null);
  }

  const isSplit = splitWin !== null && splitWin !== undefined && focusedWin !== undefined && splitWin.id !== focusedWin.id;

  const collapsed = windows.filter((w) => {
    if (focusedWin && w.id === focusedWin.id) return false;
    if (isSplit && splitWin && w.id === splitWin.id) return false;
    return true;
  });

  const handleClose = useCallback(
    (id: string) => {
      if (id === splitId) setSplitId(null);
      closeWindow(id);
    },
    [closeWindow, splitId],
  );

  const handleExpand = useCallback(
    (id: string) => {
      setSplitId(null);
      focusWindow(id);
    },
    [focusWindow],
  );

  const handleSplitWith = useCallback(
    (id: string) => {
      if (!focusedWin) {
        focusWindow(id);
        return;
      }
      setSplitId(id);
    },
    [focusedWin, focusWindow],
  );

  const handleUnsplit = useCallback(() => {
    setSplitId(null);
  }, []);

  if (windows.length === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[8000] flex flex-col bg-background-100"
      style={{
        height: viewport.height,
        paddingBottom: keyboardOpen ? 0 : TASKBAR_HEIGHT,
        transform: viewport.offsetTop ? `translateY(${viewport.offsetTop}px)` : undefined,
      }}
      role="region"
      aria-label="Open applications"
    >
      {/* Active pane(s) */}
      <div className="flex flex-1 flex-col min-h-0">
        {focusedWin && (
          <section
            className={`flex flex-col min-h-0 ${isSplit ? "h-1/2" : "flex-1"}`}
            aria-label={`${focusedWin.title} pane`}
          >
            <PaneHeader
              win={focusedWin}
              isSplit={isSplit}
              onClose={() => handleClose(focusedWin.id)}
              onSplit={() => {
                const candidate = collapsed[0];
                if (candidate) handleSplitWith(candidate.id);
              }}
              onUnsplit={handleUnsplit}
            />
            <div className="relative flex-1 min-h-0 overflow-auto bg-background-100">
              <AppContent appId={focusedWin.appId} meta={focusedWin.meta} />
            </div>
          </section>
        )}

        {isSplit && splitWin && (
          <>
            <Separator className="shrink-0" decorative={false} />
            <section
              className="flex h-1/2 flex-col min-h-0"
              aria-label={`${splitWin.title} pane`}
            >
              <PaneHeader
                win={splitWin}
                isSplit
                onClose={() => handleClose(splitWin.id)}
                onSplit={() => {}}
                onUnsplit={handleUnsplit}
              />
              <div className="relative flex-1 min-h-0 overflow-auto bg-background-100">
                <AppContent appId={splitWin.appId} meta={splitWin.meta} />
              </div>
            </section>
          </>
        )}
      </div>

      {/* Collapsed windows -- hidden when keyboard is open to maximize space */}
      {collapsed.length > 0 && !keyboardOpen && (
        <div className="shrink-0 overflow-y-auto max-h-36 border-t border-gray-alpha-400">
          {collapsed.map((win) => (
            <CollapsedRow
              key={win.id}
              win={win}
              onExpand={() => handleExpand(win.id)}
              onSplit={() => handleSplitWith(win.id)}
              onClose={() => handleClose(win.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
