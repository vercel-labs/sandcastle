"use client";

import { type ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// StatusBar — bottom bar for app-level status, breadcrumbs, and indicators.
//
// Usage:
//   <StatusBar>
//     <StatusBar.Item>Ln 42, Col 18</StatusBar.Item>
//     <StatusBar.Separator />
//     <StatusBar.Item>UTF-8</StatusBar.Item>
//     <StatusBar.Spacer />
//     <StatusBar.Item icon={<CheckCircle />} variant="success">Saved</StatusBar.Item>
//   </StatusBar>
// ---------------------------------------------------------------------------

interface StatusBarProps {
  children: ReactNode;
  className?: string;
}

function StatusBarRoot({ children, className = "" }: StatusBarProps) {
  return (
    <div
      className={`flex h-6 shrink-0 items-center gap-0 border-t border-gray-alpha-200 bg-background-100 px-2 font-mono text-label-13 text-gray-900 ${className}`}
      role="status"
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBar.Item
// ---------------------------------------------------------------------------

interface StatusBarItemProps {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "default" | "success" | "warning" | "error";
  onClick?: () => void;
  className?: string;
}

const variantColors = {
  default: "text-gray-900",
  success: "text-green-900",
  warning: "text-amber-900",
  error: "text-red-900",
};

function StatusBarItem({
  children,
  icon,
  variant = "default",
  onClick,
  className = "",
}: StatusBarItemProps) {
  const classes = `inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm ${variantColors[variant]} ${
    onClick ? "cursor-pointer hover:bg-gray-alpha-200 transition-colors" : ""
  } ${className}`;

  if (onClick) {
    return (
      <button className={classes} onClick={onClick}>
        {icon}
        {children}
      </button>
    );
  }

  return (
    <span className={classes}>
      {icon}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusBar.Separator
// ---------------------------------------------------------------------------

function StatusBarSeparator() {
  return <Separator orientation="vertical" className="mx-0.5 h-3" />;
}

// ---------------------------------------------------------------------------
// StatusBar.Spacer
// ---------------------------------------------------------------------------

function StatusBarSpacer() {
  return <div className="flex-1" />;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const StatusBar = Object.assign(StatusBarRoot, {
  Item: StatusBarItem,
  Separator: StatusBarSeparator,
  Spacer: StatusBarSpacer,
});
