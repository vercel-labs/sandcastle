"use client";

import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Toolbar — horizontal bar of icon buttons, groups, and separators.
//
// Usage:
//   <Toolbar>
//     <Toolbar.Group>
//       <Toolbar.Button tooltip="Back" onClick={goBack}><ChevronLeft /></Toolbar.Button>
//       <Toolbar.Button tooltip="Forward" onClick={goFwd}><ChevronRight /></Toolbar.Button>
//     </Toolbar.Group>
//     <Toolbar.Separator />
//     <Toolbar.Group>
//       <Toolbar.Button tooltip="Refresh" active={loading}><Refresh /></Toolbar.Button>
//     </Toolbar.Group>
//     <Toolbar.Spacer />
//     <Toolbar.Text>3 items</Toolbar.Text>
//   </Toolbar>
// ---------------------------------------------------------------------------

interface ToolbarProps {
  children: ReactNode;
  className?: string;
}

function ToolbarRoot({ children, className = "" }: ToolbarProps) {
  return (
    <div
      className={`flex h-9 shrink-0 items-center gap-0.5 border-b border-gray-alpha-200 bg-background-100 px-1.5 ${className}`}
      role="toolbar"
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar.Button
// ---------------------------------------------------------------------------

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip?: string;
  active?: boolean;
  children: ReactNode;
}

const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton({ tooltip, active, children, className = "", disabled, ...props }, ref) {
    const btn = (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-900 transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5
          hover:bg-gray-alpha-200 hover:text-gray-1000
          disabled:pointer-events-none disabled:opacity-40
          ${active ? "bg-gray-alpha-200 text-gray-1000" : ""}
          ${className}`}
        {...props}
      >
        {children}
      </button>
    );

    if (tooltip) {
      return <Tooltip text={tooltip} desktopOnly>{btn}</Tooltip>;
    }
    return btn;
  },
);

// ---------------------------------------------------------------------------
// Toolbar.Group — groups buttons together with tighter spacing
// ---------------------------------------------------------------------------

function ToolbarGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center gap-px ${className}`}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Toolbar.Separator
// ---------------------------------------------------------------------------

function ToolbarSeparator() {
  return (
    <Separator orientation="vertical" className="mx-1 h-4" />
  );
}

// ---------------------------------------------------------------------------
// Toolbar.Spacer — pushes subsequent items to the right
// ---------------------------------------------------------------------------

function ToolbarSpacer() {
  return <div className="flex-1" />;
}

// ---------------------------------------------------------------------------
// Toolbar.Text — inline text label
// ---------------------------------------------------------------------------

function ToolbarText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`px-1.5 text-label-13 text-gray-900 ${className}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Toolbar.Input — inline input (e.g. address bar)
// ---------------------------------------------------------------------------

function ToolbarInput({
  value,
  onChange,
  placeholder,
  className = "",
  readOnly,
}: {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`h-6 flex-1 rounded-md border border-gray-alpha-200 bg-gray-alpha-100 px-2 font-mono text-label-13 text-gray-1000 placeholder:text-gray-700 outline-none transition-colors focus:border-blue-700 ${className}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Export as compound component
// ---------------------------------------------------------------------------

export const Toolbar = Object.assign(ToolbarRoot, {
  Button: ToolbarButton,
  Group: ToolbarGroup,
  Separator: ToolbarSeparator,
  Spacer: ToolbarSpacer,
  Text: ToolbarText,
  Input: ToolbarInput,
});
