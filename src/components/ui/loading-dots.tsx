"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function LoadingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[3px]", className)}>
      <span className="h-1 w-1 rounded-full bg-current animate-[blink_1.4s_infinite_both]" />
      <span className="h-1 w-1 rounded-full bg-current animate-[blink_1.4s_0.2s_infinite_both]" />
      <span className="h-1 w-1 rounded-full bg-current animate-[blink_1.4s_0.4s_infinite_both]" />
      <style>{`@keyframes blink { 0%, 80%, 100% { opacity: 0; } 40% { opacity: 1; } }`}</style>
    </span>
  );
}

export { LoadingDots };
