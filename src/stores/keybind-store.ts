import { create } from "zustand";
import type { KeyCombo, ShortcutDefinition } from "@/lib/keyboard/types";
import { DEFAULT_SHORTCUTS } from "@/lib/keyboard/defaults";

const STORAGE_KEY = "sandcastle:keybinds";

interface KeybindStore {
  overrides: Record<string, KeyCombo | null>;
  definitions: ShortcutDefinition[];
  /** When true, the global listener ignores all keypresses (e.g. during rebinding) */
  suspended: boolean;

  getBinding: (id: string) => KeyCombo | null;
  setBinding: (id: string, combo: KeyCombo | null) => void;
  resetBinding: (id: string) => void;
  resetAll: () => void;
  setSuspended: (value: boolean) => void;
}

function loadOverrides(): Record<string, KeyCombo | null> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveOverrides(overrides: Record<string, KeyCombo | null>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {}
}

export const useKeybindStore = create<KeybindStore>((set, get) => ({
  overrides: loadOverrides(),
  definitions: DEFAULT_SHORTCUTS,
  suspended: false,

  setSuspended: (value) => set({ suspended: value }),

  getBinding: (id) => {
    const { overrides, definitions } = get();
    if (id in overrides) return overrides[id];
    const def = definitions.find((d) => d.id === id);
    return def?.defaultBinding ?? null;
  },

  setBinding: (id, combo) => {
    const next = { ...get().overrides, [id]: combo };
    set({ overrides: next });
    saveOverrides(next);
  },

  resetBinding: (id) => {
    const next = { ...get().overrides };
    delete next[id];
    set({ overrides: next });
    saveOverrides(next);
  },

  resetAll: () => {
    set({ overrides: {} });
    saveOverrides({});
  },
}));
