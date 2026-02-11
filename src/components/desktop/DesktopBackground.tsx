"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { useTheme } from "next-themes";
import { ShaderCanvas } from "./ShaderCanvas";
import type { BackgroundConfig } from "@/types/workspace";
import { SOLID_BACKGROUNDS } from "@/types/workspace";

function parseBackground(raw: string | null): BackgroundConfig {
  if (!raw) return { type: "solid", value: "#000000" };
  try {
    return JSON.parse(raw) as BackgroundConfig;
  } catch {
    return { type: "solid", value: "#000000" };
  }
}

function resolvedSolidColor(value: string, isLight: boolean): string {
  const solid = SOLID_BACKGROUNDS.find((s) => s.color === value);
  if (solid && isLight) return solid.lightColor;
  return value;
}

export function DesktopBackground() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId),
  );
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";

  const bg = parseBackground(workspace?.background ?? null);

  if (bg.type === "shader") {
    return (
      <div className="fixed inset-0 z-0" key={`${activeWorkspaceId}-${bg.value}`}>
        <ShaderCanvas shaderId={bg.value} light={isLight} />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-0"
      style={{ backgroundColor: resolvedSolidColor(bg.value, isLight) }}
    />
  );
}
