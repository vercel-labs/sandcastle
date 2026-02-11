"use client";

import {
  useState,
  useCallback,
  useRef,
  type ReactNode,
  createContext,
  useContext,
} from "react";

// ---------------------------------------------------------------------------
// CollapsibleSidebar — resizable sidebar with collapse/expand toggle.
//
// Usage:
//   <CollapsibleSidebar defaultSize={220} min={160} max={360}>
//     <CollapsibleSidebar.Header>
//       <span>Explorer</span>
//       <CollapsibleSidebar.CollapseButton />
//     </CollapsibleSidebar.Header>
//     <CollapsibleSidebar.Content>
//       <FileTree />
//     </CollapsibleSidebar.Content>
//   </CollapsibleSidebar>
// ---------------------------------------------------------------------------

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  size: number;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
  size: 220,
});

export function useSidebar() {
  return useContext(SidebarContext);
}

interface CollapsibleSidebarProps {
  children: ReactNode;
  defaultSize?: number;
  min?: number;
  max?: number;
  defaultCollapsed?: boolean;
  side?: "left" | "right";
  className?: string;
}

function CollapsibleSidebarRoot({
  children,
  defaultSize = 220,
  min = 140,
  max = 400,
  defaultCollapsed = false,
  side = "left",
  className = "",
}: CollapsibleSidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [size, setSize] = useState(defaultSize);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startSize = useRef(0);

  const toggle = useCallback(() => setCollapsed((v) => !v), []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (collapsed) return;
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startSize.current = size;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [collapsed, size],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const delta = side === "left"
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      setSize(Math.min(max, Math.max(min, startSize.current + delta)));
    },
    [side, min, max],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const resizeHandle = (
    <div
      className={`w-px shrink-0 cursor-col-resize bg-gray-alpha-200 transition-colors hover:w-0.5 hover:bg-blue-700/50 active:w-0.5 active:bg-blue-700 ${
        collapsed ? "pointer-events-none" : ""
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      aria-orientation="vertical"
    />
  );

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, size }}>
      <div
        className={`flex shrink-0 ${className}`}
        style={{ width: collapsed ? 0 : size }}
      >
        {side === "right" && resizeHandle}
        <div
          className={`flex h-full flex-col overflow-hidden transition-[width] duration-150 ${
            collapsed ? "w-0" : "w-full"
          }`}
        >
          {children}
        </div>
        {side === "left" && resizeHandle}
      </div>
    </SidebarContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// CollapsibleSidebar.Header
// ---------------------------------------------------------------------------

function SidebarHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-9 shrink-0 items-center justify-between border-b border-gray-alpha-200 px-3 ${className}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CollapsibleSidebar.CollapseButton
// ---------------------------------------------------------------------------

function CollapseButton({ className = "" }: { className?: string }) {
  const { collapsed, toggle } = useSidebar();
  return (
    <button
      onClick={toggle}
      className={`inline-flex h-5 w-5 items-center justify-center rounded text-gray-800 hover:bg-gray-alpha-200 hover:text-gray-1000 transition-colors ${className}`}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d={collapsed ? "M4.5 2L8.5 6L4.5 10" : "M8.5 2L4.5 6L8.5 10"}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CollapsibleSidebar.Content
// ---------------------------------------------------------------------------

function SidebarContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`flex-1 overflow-y-auto ${className}`}>{children}</div>;
}

// ---------------------------------------------------------------------------
// CollapsibleSidebar.Section
// ---------------------------------------------------------------------------

function SidebarSection({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${className}`}>
      {title && (
        <div className="px-3 pt-2 pb-1">
          <span className="text-label-13 font-medium text-gray-800">{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CollapsibleSidebar.Item
// ---------------------------------------------------------------------------

interface SidebarItemProps {
  children: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  indent?: number;
  onClick?: () => void;
  className?: string;
}

function SidebarItem({
  children,
  icon,
  active,
  indent = 0,
  onClick,
  className = "",
}: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-label-13 transition-colors
        ${active ? "bg-gray-alpha-200 text-gray-1000" : "text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000"}
        ${className}`}
      style={{ paddingLeft: 8 + indent * 12 }}
    >
      {icon && <span className="shrink-0 text-gray-800 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const CollapsibleSidebar = Object.assign(CollapsibleSidebarRoot, {
  Header: SidebarHeader,
  CollapseButton,
  Content: SidebarContent,
  Section: SidebarSection,
  Item: SidebarItem,
});
