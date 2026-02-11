"use client";

import type { WindowState } from "@/types/window";
import { AppIconWithFallback } from "@/components/app-icon";

interface WindowSwitcherProps {
  visible: boolean;
  windows: WindowState[];
  selectedIndex: number;
}

function WindowSwitcherItem({
  win,
  isSelected,
}: {
  win: WindowState;
  isSelected: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-lg px-3 py-3 transition-colors ${
        isSelected
          ? "bg-blue-600 text-white"
          : "text-gray-1000"
      }`}
      style={{ width: 120 }}
    >
      <div className="flex h-12 w-12 items-center justify-center">
        <AppIconWithFallback appId={win.appId} title={win.title} size={40} className="object-contain" />
      </div>
      <span className="w-full truncate text-center text-copy-13">
        {win.title}
      </span>
    </div>
  );
}

export function WindowSwitcher({ visible, windows, selectedIndex }: WindowSwitcherProps) {
  if (!visible || windows.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div className="rounded-xl border border-gray-alpha-200 bg-background-200/90 p-3 shadow-2xl backdrop-blur-xl">
        <div className="flex gap-1">
          {windows.map((win, i) => (
            <WindowSwitcherItem
              key={win.id}
              win={win}
              isSelected={i === selectedIndex}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
