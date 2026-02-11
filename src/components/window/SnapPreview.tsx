"use client";

import type { SnapZone } from "@/types/window";

import { TASKBAR_HEIGHT } from "@/lib/constants";

const ZONE_STYLE: Record<NonNullable<SnapZone>, React.CSSProperties> = {
  left: { top: 0, left: 0, width: "50%", height: `calc(100% - ${TASKBAR_HEIGHT}px)` },
  right: { top: 0, right: 0, width: "50%", height: `calc(100% - ${TASKBAR_HEIGHT}px)` },
  top: { top: 0, left: 0, width: "100%", height: `calc(100% - ${TASKBAR_HEIGHT}px)` },
  "top-left": { top: 0, left: 0, width: "50%", height: `calc(50% - ${TASKBAR_HEIGHT / 2}px)` },
  "top-right": { top: 0, right: 0, width: "50%", height: `calc(50% - ${TASKBAR_HEIGHT / 2}px)` },
  "bottom-left": { bottom: TASKBAR_HEIGHT, left: 0, width: "50%", height: `calc(50% - ${TASKBAR_HEIGHT / 2}px)` },
  "bottom-right": { bottom: TASKBAR_HEIGHT, right: 0, width: "50%", height: `calc(50% - ${TASKBAR_HEIGHT / 2}px)` },
};

interface SnapPreviewProps {
  zone: SnapZone;
}

export function SnapPreview({ zone }: SnapPreviewProps) {
  if (!zone) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[8999]"
      aria-hidden="true"
    >
      <div
        className="absolute rounded-xl border-2 border-blue-400/60 bg-blue-500/15 backdrop-blur-sm transition-all duration-150 ease-out"
        style={{ ...ZONE_STYLE[zone], margin: 6 }}
      />
    </div>
  );
}
