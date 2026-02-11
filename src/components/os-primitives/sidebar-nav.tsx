"use client";

import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// SidebarNav — reusable sidebar navigation for app shells.
//
// Extracts the repeated sidebar + tab-button pattern used across Settings,
// AppStore, etc.  Designed to sit inside a SplitPane.Panel.
//
// Usage:
//   <SidebarNav label="Settings" title="Settings">
//     <SidebarNav.Item active={tab === "a"} onClick={() => setTab("a")} icon={<Icon />}>
//       Appearance
//     </SidebarNav.Item>
//   </SidebarNav>
//
//   // Multiple sections:
//   <SidebarNav label="App Store">
//     <SidebarNav.Group title="Packages">
//       <SidebarNav.Item ...>GUI Apps</SidebarNav.Item>
//     </SidebarNav.Group>
//     <SidebarNav.Group title="Repos">
//       ...
//     </SidebarNav.Group>
//   </SidebarNav>
// ---------------------------------------------------------------------------

interface SidebarNavProps {
  children: ReactNode;
  /** Accessible label for the <nav> element */
  label: string;
  /** Optional heading displayed at the top of the sidebar */
  title?: string;
  className?: string;
}

function SidebarNavRoot({ children, label, title, className = "" }: SidebarNavProps) {
  return (
    <nav className={`flex flex-col py-2 ${className}`} aria-label={label}>
      {title && (
        <div className="px-3 pb-1">
          <span className="text-copy-13 font-medium text-gray-800">{title}</span>
        </div>
      )}
      {children}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// SidebarNav.Group — optional section divider with a title
// ---------------------------------------------------------------------------

interface SidebarNavGroupProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

function SidebarNavGroup({ children, title, className = "" }: SidebarNavGroupProps) {
  return (
    <div className={className}>
      {title && (
        <div className="px-3 pt-4 pb-1">
          <span className="text-copy-13 font-medium text-gray-800">{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarNav.Item — a single navigation button
// ---------------------------------------------------------------------------

interface SidebarNavItemProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  /** Trailing content (e.g. a count badge) */
  suffix?: ReactNode;
  className?: string;
}

function SidebarNavItem({
  children,
  active,
  onClick,
  icon,
  suffix,
  className = "",
}: SidebarNavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`mx-1 flex items-center gap-2 rounded-md px-2 py-1 text-copy-13 transition-colors ${
        active
          ? "bg-gray-alpha-200 text-gray-1000"
          : "text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000"
      } ${className}`}
    >
      {icon && (
        <span className="shrink-0 text-gray-800 [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
      )}
      <span className="min-w-0 truncate">{children}</span>
      {suffix && (
        <span className="ml-auto font-mono text-copy-13 tabular-nums text-gray-700">
          {suffix}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const SidebarNav = Object.assign(SidebarNavRoot, {
  Group: SidebarNavGroup,
  Item: SidebarNavItem,
});
