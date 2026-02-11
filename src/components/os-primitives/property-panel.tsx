"use client";

import { type ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// PropertyPanel — key-value inspector panel (like Finder's "Get Info").
//
// Usage:
//   <PropertyPanel title="File Info">
//     <PropertyPanel.Section title="General">
//       <PropertyPanel.Row label="Name" value="document.pdf" />
//       <PropertyPanel.Row label="Size" value="2.4 MB" />
//       <PropertyPanel.Row label="Modified" value="Feb 10, 2026" />
//     </PropertyPanel.Section>
//     <PropertyPanel.Section title="Permissions">
//       <PropertyPanel.Row label="Owner" value="vercel-sandbox" />
//       <PropertyPanel.Row label="Group" value="users" />
//     </PropertyPanel.Section>
//   </PropertyPanel>
// ---------------------------------------------------------------------------

interface PropertyPanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

function PropertyPanelRoot({ title, children, className = "" }: PropertyPanelProps) {
  return (
    <div className={`flex flex-col overflow-y-auto ${className}`}>
      {title && (
        <div className="sticky top-0 z-10 border-b border-gray-alpha-200 bg-background-100 px-3 py-2">
          <h3 className="text-label-13 font-medium text-gray-1000">{title}</h3>
        </div>
      )}
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PropertyPanel.Section
// ---------------------------------------------------------------------------

function PropertySection({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  return (
    <div className="border-b border-gray-alpha-200 last:border-b-0">
      {title && (
        <div className="px-3 pt-3 pb-1">
          <span className="text-label-13 font-medium text-gray-800">{title}</span>
        </div>
      )}
      <div className={`px-3 pb-2 ${title ? "" : "pt-2"}`}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PropertyPanel.Row
// ---------------------------------------------------------------------------

interface PropertyRowProps {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
  mono?: boolean;
  copyable?: boolean;
}

function PropertyRow({ label, value, children, mono }: PropertyRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="shrink-0 text-label-13 text-gray-800">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right text-label-13 text-gray-1000 ${
          mono ? "font-mono" : ""
        }`}
      >
        {children ?? value}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PropertyPanel.Separator
// ---------------------------------------------------------------------------

function PropertySeparator() {
  return <Separator className="my-1" />;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const PropertyPanel = Object.assign(PropertyPanelRoot, {
  Section: PropertySection,
  Row: PropertyRow,
  Separator: PropertySeparator,
});
