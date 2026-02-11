import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2",
  {
    variants: {
      variant: {
        gray: "border-gray-alpha-400 bg-gray-100 text-gray-900",
        blue: "border-blue-300 bg-blue-100 text-blue-900",
        green: "border-green-300 bg-green-100 text-green-900",
        amber: "border-amber-300 bg-amber-100 text-amber-900",
        red: "border-red-300 bg-red-100 text-red-900",
        purple: "border-purple-300 bg-purple-100 text-purple-900",
        pink: "border-pink-300 bg-pink-100 text-pink-900",
        teal: "border-teal-300 bg-teal-100 text-teal-900",
      },
      size: {
        sm: "px-2 py-0 text-[11px] leading-[18px]",
        md: "px-2.5 py-0.5 text-[12px] leading-[18px]",
      },
    },
    defaultVariants: {
      variant: "gray",
      size: "md",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  contrast?: "low" | "high";
}

function Badge({
  className,
  variant,
  size,
  contrast,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
