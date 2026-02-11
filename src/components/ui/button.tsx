"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-copy-13 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-gray-1000 text-white [color:white] dark:text-black dark:[color:black] hover:bg-gray-900",
        secondary:
          "bg-background-100 text-gray-1000 border border-gray-alpha-400 hover:bg-gray-alpha-100",
        tertiary:
          "bg-transparent text-gray-1000 hover:bg-gray-alpha-200",
        error:
          "bg-red-700 text-white [color:white] hover:bg-red-600",
        warning:
          "bg-amber-700 text-white [color:white] hover:bg-amber-600",
        ghost:
          "hover:bg-gray-alpha-200 text-gray-1000",
        link: "text-blue-700 underline-offset-4 hover:underline",
      },
      size: {
        small: "h-8 px-3 text-copy-13",
        medium: "h-9 px-4 text-copy-13",
        large: "h-10 px-5 text-copy-14",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "medium",
    },
  }
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "prefix">,
    ButtonVariantProps {
  asChild?: boolean;
  loading?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  /** HTML button type attribute (named typeName for compat with geistcn API) */
  typeName?: "submit" | "button" | "reset";
  /** Visual type — maps to variant for compat */
  type?: "shadow" | "invert" | "unstyled";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      prefix,
      suffix,
      typeName,
      type,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Map geistcn "type" prop to variant if variant not explicitly set
    let resolvedVariant = variant;
    if (!resolvedVariant && type) {
      if (type === "invert") resolvedVariant = "default";
      else if (type === "shadow") resolvedVariant = "secondary";
      else if (type === "unstyled") resolvedVariant = "ghost";
    }

    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant: resolvedVariant, size, className }))}
        ref={ref}
        type={typeName ?? "button"}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <>
            {prefix && <span className="inline-flex shrink-0">{prefix}</span>}
            {children}
            {suffix && <span className="inline-flex shrink-0">{suffix}</span>}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };
