"use client";

import { useResolvedIcon } from "@/lib/icons/resolve-window-icon";

interface AppIconProps {
  appId: string;
  size?: number;
  className?: string;
}

export function AppIcon({ appId, size = 16, className }: AppIconProps) {
  const iconUrl = useResolvedIcon(appId);

  if (!iconUrl) return null;

  return (
    <img
      src={iconUrl}
      alt=""
      width={size}
      height={size}
      className={className ?? `h-[${size}px] w-[${size}px] shrink-0`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Variant that renders a letter-initial fallback when no icon is available.
 */
export function AppIconWithFallback({
  appId,
  title,
  size = 16,
  className,
}: AppIconProps & { title: string }) {
  const iconUrl = useResolvedIcon(appId);

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        width={size}
        height={size}
        className={className ?? "shrink-0 object-contain"}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-lg bg-gray-alpha-200 font-medium text-gray-900 shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {title.charAt(0).toUpperCase()}
    </div>
  );
}
