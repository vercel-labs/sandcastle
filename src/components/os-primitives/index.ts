// OS Primitives — UI building blocks for desktop app chrome.
// Built on top of shadcn/ui components and Geist design tokens.
//
// These fill the gap between shadcn's web-focused components and the
// needs of a desktop-style app (toolbars, split panes, status bars, etc.).
//
// shadcn/ui components to use directly (from @/components/ui/*):
//   Button, Input, Badge, Spinner, Separator, Tooltip, Toggle (Switch),
//   ContextMenu, Command (CommandDialog), DropdownMenu, Note, LoadingDots,
//   ThemeSwitcher

export { Toolbar } from "./toolbar";
export { SplitPane } from "./split-pane";
export { StatusBar } from "./status-bar";
export { ListView } from "./list-view";
export { PropertyPanel } from "./property-panel";
export { CollapsibleSidebar, useSidebar } from "./collapsible-sidebar";
export { SidebarNav } from "./sidebar-nav";
export { EmptyState } from "./empty-state";
export { SectionHeader } from "./section-header";
export { StatusBadge } from "./status-badge";
