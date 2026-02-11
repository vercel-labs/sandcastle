"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useXpraStore } from "@/stores/xpra-store";
import { Clipboard } from "lucide-react";
import type { XpraKeyboard } from "xpra-html5-client";

// ---------------------------------------------------------------------------
// Modifier key state: off -> oneshot -> locked -> off
// ---------------------------------------------------------------------------

type ModToggle = "off" | "oneshot" | "locked";

interface ModState {
  ctrl: ModToggle;
  alt: ModToggle;
  super: ModToggle;
}

const INITIAL_MODS: ModState = { ctrl: "off", alt: "off", super: "off" };

function nextToggle(cur: ModToggle): ModToggle {
  if (cur === "off") return "oneshot";
  if (cur === "oneshot") return "locked";
  return "off";
}

function modifiersFromState(state: ModState): string[] {
  const mods: string[] = [];
  if (state.ctrl !== "off") mods.push("control");
  if (state.alt !== "off") mods.push("alt");
  if (state.super !== "off") mods.push("super");
  return mods;
}

function clearOneShot(state: ModState): ModState {
  return {
    ctrl: state.ctrl === "oneshot" ? "off" : state.ctrl,
    alt: state.alt === "oneshot" ? "off" : state.alt,
    super: state.super === "oneshot" ? "off" : state.super,
  };
}

// ---------------------------------------------------------------------------
// ModButton — small toggle button for a modifier key
// ---------------------------------------------------------------------------

function ModButton({
  label,
  state,
  onToggle,
}: {
  label: string;
  state: ModToggle;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onToggle();
      }}
      className={`flex h-7 min-w-[2.25rem] select-none items-center justify-center rounded-md px-1.5 text-[11px] font-semibold transition-colors ${
        state === "off"
          ? "bg-gray-alpha-100 text-gray-900"
          : state === "oneshot"
            ? "bg-blue-700 text-white"
            : "bg-blue-900 text-white ring-1 ring-blue-500"
      }`}
      aria-pressed={state !== "off"}
      aria-label={`${label} modifier${state === "locked" ? " (locked)" : ""}`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// XpraMobileToolbar — keyboard trigger, modifiers, paste for touch devices
// ---------------------------------------------------------------------------

interface XpraMobileToolbarProps {
  wid: number;
}

export function XpraMobileToolbar({ wid }: XpraMobileToolbarProps) {
  const client = useXpraStore((s) => s.client);
  const [mods, setMods] = useState<ModState>(INITIAL_MODS);
  const [kbOpen, setKbOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keyboardRef = useRef<XpraKeyboard | null>(null);

  useEffect(() => {
    import("xpra-html5-client").then(({ XpraKeyboard: Kb }) => {
      keyboardRef.current = new Kb();
    });
  }, []);

  // Track keyboard open/close via textarea focus/blur
  const handleFocus = useCallback(() => setKbOpen(true), []);
  const handleBlur = useCallback(() => setKbOpen(false), []);

  const toggleKeyboard = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (kbOpen) {
      ta.blur();
    } else {
      ta.focus();
    }
  }, [kbOpen]);

  // Forward key events from the hidden textarea to Xpra
  const sendKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, pressed: boolean) => {
      if (!client) return;
      e.preventDefault();
      e.stopPropagation();

      const kb = keyboardRef.current;
      if (!kb) return;

      const nativeEvent = e.nativeEvent;
      const info = kb.getKey(nativeEvent);
      const kbMods = kb.getModifiers(nativeEvent);

      // Merge toolbar modifier state with any hardware modifier keys
      const toolbarMods = modifiersFromState(mods);
      const merged = [...new Set([...kbMods, ...toolbarMods])];

      client.sendKeyAction(wid, info.name, pressed, merged, info.key, info.code, info.group);

      // Auto-clear oneshot modifiers after a key press
      if (pressed) {
        setMods(clearOneShot);
      }
    },
    [client, wid, mods],
  );

  // Handle composing / IME input (for languages that compose characters).
  // Also catches cases where onKeyDown doesn't fire on mobile virtual keyboards
  // for regular characters.
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      if (!client) return;
      const ta = e.currentTarget;
      const text = ta.value;
      if (!text) return;

      const toolbarMods = modifiersFromState(mods);

      for (const char of text) {
        const keyName = char === " " ? "space" : char;
        client.sendKeyAction(wid, keyName, true, toolbarMods, char, char, 0);
        client.sendKeyAction(wid, keyName, false, toolbarMods, char, char, 0);
      }

      // Clear the textarea so it doesn't accumulate
      ta.value = "";
      setMods(clearOneShot);
    },
    [client, wid, mods],
  );

  // Paste: push browser clipboard to X11 via clipboard.poll(), then simulate Ctrl+V
  const handlePaste = useCallback(async () => {
    if (!client) return;
    try {
      if (client.clipboard?.isEnabled()) {
        await client.clipboard.poll();
        // Give the server a moment to process the clipboard token, then Ctrl+V
        setTimeout(() => {
          client.sendKeyAction(wid, "Control_L", true, ["control"], "Control", "ControlLeft", 0);
          client.sendKeyAction(wid, "v", true, ["control"], "v", "KeyV", 0);
          client.sendKeyAction(wid, "v", false, ["control"], "v", "KeyV", 0);
          client.sendKeyAction(wid, "Control_L", false, [], "Control", "ControlLeft", 0);
        }, 50);
      }
    } catch {
      // clipboard permission denied
    }
  }, [client, wid]);

  return (
    <div className="flex items-center gap-1">
      {/* Hidden textarea to capture virtual keyboard input */}
      <textarea
        ref={textareaRef}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={(e) => sendKey(e, true)}
        onKeyUp={(e) => sendKey(e, false)}
        onInput={handleInput}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        aria-label="Keyboard input for remote application"
        className="pointer-events-auto fixed -left-[9999px] top-0 h-px w-px opacity-0"
        tabIndex={-1}
      />

      {/* Keyboard toggle */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          toggleKeyboard();
        }}
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          kbOpen
            ? "bg-blue-700 text-white"
            : "text-gray-900 active:bg-gray-alpha-200"
        }`}
        aria-label={kbOpen ? "Hide keyboard" : "Show keyboard"}
        aria-pressed={kbOpen}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
        </svg>
      </button>

      {/* Modifier keys */}
      <ModButton
        label="Ctrl"
        state={mods.ctrl}
        onToggle={() => setMods((s) => ({ ...s, ctrl: nextToggle(s.ctrl) }))}
      />
      <ModButton
        label="Alt"
        state={mods.alt}
        onToggle={() => setMods((s) => ({ ...s, alt: nextToggle(s.alt) }))}
      />
      <ModButton
        label="Super"
        state={mods.super}
        onToggle={() => setMods((s) => ({ ...s, super: nextToggle(s.super) }))}
      />

      {/* Paste */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          handlePaste();
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-900 transition-colors active:bg-gray-alpha-200"
        aria-label="Paste clipboard"
      >
        <Clipboard size={14} />
      </button>
    </div>
  );
}
