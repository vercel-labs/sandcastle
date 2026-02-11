"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Label above the input (geistcn compat) */
  label?: string;
  /** Size variant (geistcn compat) */
  size?: "small" | "medium" | "large";
  /** HTML input type (named typeName for geistcn compat, also accepts type) */
  typeName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, size, typeName, type, ...props }, ref) => {
    const input = (
      <input
        type={typeName ?? type}
        className={cn(
          "flex w-full rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-13 text-gray-1000 transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-gray-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          size === "small" ? "h-8" : size === "large" ? "h-11" : "h-9",
          className
        )}
        ref={ref}
        {...props}
      />
    );

    if (label) {
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-label-13 text-gray-900">{label}</label>
          {input}
        </div>
      );
    }

    return input;
  }
);
Input.displayName = "Input";

export { Input };
