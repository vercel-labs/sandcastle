export type ModifierKey = "meta" | "ctrl" | "alt" | "shift";

export interface KeyCombo {
  key: string;
  modifiers: ModifierKey[];
}

export type ShortcutCategory =
  | "window"
  | "workspace"
  | "launcher"
  | "system";

export interface ShortcutDefinition {
  id: string;
  label: string;
  description: string;
  category: ShortcutCategory;
  defaultBinding: KeyCombo;
  /** Whether the shortcut fires on keyup instead of keydown */
  onKeyUp?: boolean;
  /** Whether the shortcut repeats when held */
  repeat?: boolean;
}

export interface ShortcutOverride {
  id: string;
  binding: KeyCombo | null;
}

export function comboToString(combo: KeyCombo): string {
  const parts: string[] = [];
  if (combo.modifiers.includes("ctrl")) parts.push("Ctrl");
  if (combo.modifiers.includes("alt")) parts.push("Alt");
  if (combo.modifiers.includes("shift")) parts.push("Shift");
  if (combo.modifiers.includes("meta")) parts.push("Super");
  parts.push(formatKeyName(combo.key));
  return parts.join(" + ");
}

export function comboToSymbols(combo: KeyCombo): string {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
  const parts: string[] = [];
  if (combo.modifiers.includes("ctrl")) parts.push(isMac ? "\u2303" : "Ctrl");
  if (combo.modifiers.includes("alt")) parts.push(isMac ? "\u2325" : "Alt");
  if (combo.modifiers.includes("shift")) parts.push(isMac ? "\u21E7" : "Shift");
  if (combo.modifiers.includes("meta")) parts.push(isMac ? "\u2318" : "Super");
  parts.push(formatKeyName(combo.key));
  return parts.join(isMac ? "" : " + ");
}

function formatKeyName(key: string): string {
  if (key === "Tab") return "Tab";
  if (key === "Escape") return "Esc";
  if (key === "ArrowLeft") return "\u2190";
  if (key === "ArrowRight") return "\u2192";
  if (key === "ArrowUp") return "\u2191";
  if (key === "ArrowDown") return "\u2193";
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function matchesCombo(e: KeyboardEvent, combo: KeyCombo): boolean {
  if (e.key.toLowerCase() !== combo.key.toLowerCase() && e.key !== combo.key) return false;
  const wantMeta = combo.modifiers.includes("meta");
  const wantCtrl = combo.modifiers.includes("ctrl");
  const wantAlt = combo.modifiers.includes("alt");
  const wantShift = combo.modifiers.includes("shift");
  return e.metaKey === wantMeta && e.ctrlKey === wantCtrl && e.altKey === wantAlt && e.shiftKey === wantShift;
}
