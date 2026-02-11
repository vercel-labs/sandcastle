"use client";

import { type ReactNode } from "react";

// ---------------------------------------------------------------------------
// EmptyState — placeholder for empty views (no files, no results, etc.).
//
// Usage:
//   <EmptyState
//     icon={<FolderOpen />}
//     title="No files"
//     description="This folder is empty."
//     action={<Button onClick={upload}>Upload File</Button>}
//   />
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "gap-2 py-6" : "gap-3 py-12"
      } ${className}`}
    >
      {icon && (
        <div className={`text-gray-700 ${compact ? "[&>svg]:h-5 [&>svg]:w-5" : "[&>svg]:h-8 [&>svg]:w-8"}`}>
          {icon}
        </div>
      )}
      <div className="space-y-0.5">
        <p className="text-label-13 font-medium text-gray-1000">
          {title}
        </p>
        {description && (
          <p className={`text-gray-800 ${compact ? "text-label-13" : "text-label-13"}`}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2 shrink-0">{action}</div>}
    </div>
  );
}
