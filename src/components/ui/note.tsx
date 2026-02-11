"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";

const noteVariants = cva(
  "flex items-start gap-2 rounded-md border p-3 text-copy-13",
  {
    variants: {
      type: {
        default: "border-gray-alpha-400 bg-gray-alpha-100 text-gray-900",
        error: "border-red-300 bg-red-100 text-red-900",
        warning: "border-amber-300 bg-amber-100 text-amber-900",
        success: "border-green-300 bg-green-100 text-green-900",
      },
      size: {
        default: "p-3",
        small: "p-2 text-label-12",
      },
    },
    defaultVariants: {
      type: "default",
      size: "default",
    },
  }
);

const iconMap = {
  default: Info,
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle,
} as const;

interface NoteProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof noteVariants> {
  type?: "default" | "error" | "warning" | "success";
  label?: boolean | string;
  action?: React.ReactNode;
  disabled?: boolean;
  fill?: boolean;
}

function Note({
  className,
  type = "default",
  size,
  label,
  action,
  children,
  ...props
}: NoteProps) {
  const Icon = iconMap[type];
  const showLabel = label !== false;

  return (
    <div
      className={cn(noteVariants({ type, size }), className)}
      role="alert"
      {...props}
    >
      {showLabel && <Icon className="h-4 w-4 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export { Note };
