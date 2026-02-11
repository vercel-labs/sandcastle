"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";

const themes = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

interface ThemeSwitcherProps {
  small?: boolean;
  className?: string;
  onThemeSwitch?: (theme: string) => void;
  disabled?: boolean;
}

function ThemeSwitcher({
  small,
  className,
  onThemeSwitch,
  disabled,
}: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-gray-alpha-100 p-1",
        className
      )}
      disabled={disabled}
    >
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => {
            setTheme(value);
            onThemeSwitch?.(value);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-label-12 transition-colors cursor-pointer",
            theme === value
              ? "bg-background-100 text-gray-1000 shadow-sm"
              : "text-gray-700 hover:text-gray-1000"
          )}
        >
          <Icon className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
          {!small && label}
        </button>
      ))}
    </fieldset>
  );
}

export { ThemeSwitcher };
