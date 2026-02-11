export type WorkspaceStatus =
  | "active"
  | "stopped"
  | "snapshotted"
  | "creating"
  | "error";

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  sandboxId: string | null;
  snapshotId: string | null;
  status: WorkspaceStatus;
  sandboxDomain: string | null;
  background: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BackgroundType = "solid" | "shader";

export interface BackgroundConfig {
  type: BackgroundType;
  value: string;
}

export const SHADER_BACKGROUNDS = [
  { id: "aurora", name: "Aurora", description: "Subtle gradient glow" },
  { id: "mesh-gradient", name: "Mesh", description: "Drifting soft blobs" },
  { id: "waves", name: "Waves", description: "Gentle undulating lines" },
  { id: "noise-flow", name: "Noise", description: "Organic flowing texture" },
  { id: "ripple", name: "Ripple", description: "Concentric radial rings" },
] as const;

export type ShaderId = (typeof SHADER_BACKGROUNDS)[number]["id"];

export const SOLID_BACKGROUNDS = [
  { id: "black", name: "Black", color: "#000000", lightColor: "#ffffff" },
  {
    id: "dark-gray",
    name: "Dark Gray",
    color: "#111111",
    lightColor: "#f5f5f5",
  },
  { id: "charcoal", name: "Charcoal", color: "#1a1a2e", lightColor: "#eeeef2" },
  { id: "midnight", name: "Midnight", color: "#0a0a1a", lightColor: "#f0f0f5" },
  { id: "navy", name: "Navy", color: "#0d1b2a", lightColor: "#edf1f5" },
  {
    id: "deep-purple",
    name: "Deep Purple",
    color: "#1a0a2e",
    lightColor: "#f2eef5",
  },
  { id: "forest", name: "Forest", color: "#0a1a0d", lightColor: "#eef2ef" },
] as const;

export const WORKSPACE_ICON_NAMES = [
  "globe",
  "star",
  "lightning",
  "cloud",
  "moon",
  "sun",
  "terminal",
  "command",
  "sparkles",
  "code",
  "layers",
  "cpu",
  "database",
  "key",
  "compass",
  "flag",
  "droplet",
  "shield",
  "anchor",
  "box",
  "crosshair",
  "target",
  "bookmark",
  "hash",
] as const;

export type WorkspaceIconName = (typeof WORKSPACE_ICON_NAMES)[number];

const WORKSPACE_NAME_WORDS = [
  "apollo",
  "next",
  "ship",
  "vercel",
  "nuxt",
  "v0",
  "turbo",
  "svelte",
  "node",
  "wasm",
  "rust",
  "flux",
  "quantum",
  "quark",
] as const;

export function generateWorkspaceName(): string {
  const a =
    WORKSPACE_NAME_WORDS[
      Math.floor(Math.random() * WORKSPACE_NAME_WORDS.length)
    ];
  let b = a;
  while (b === a) {
    b =
      WORKSPACE_NAME_WORDS[
        Math.floor(Math.random() * WORKSPACE_NAME_WORDS.length)
      ];
  }
  const n = Math.floor(Math.random() * 90) + 10;
  return `${a}-${b}-${n}`;
}
