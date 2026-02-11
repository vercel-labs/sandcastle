"use client";

import {
  Globe,
  Star,
  Zap,
  Cloud,
  Moon,
  Sun,
  Terminal,
  Command,
  Sparkles,
  Code,
  Layers,
  Cpu,
  Database,
  Key,
  Compass,
  Flag,
  Droplet,
  Shield,
  Anchor,
  Box,
  Crosshair,
  Target,
  Bookmark,
  Hash,
} from "lucide-react";
import type { WorkspaceIconName } from "@/types/workspace";

const ICON_MAP: Record<WorkspaceIconName, React.ComponentType<{ size?: number; className?: string }>> = {
  globe: Globe,
  star: Star,
  lightning: Zap,
  cloud: Cloud,
  moon: Moon,
  sun: Sun,
  terminal: Terminal,
  command: Command,
  sparkles: Sparkles,
  code: Code,
  layers: Layers,
  cpu: Cpu,
  database: Database,
  key: Key,
  compass: Compass,
  flag: Flag,
  droplet: Droplet,
  shield: Shield,
  anchor: Anchor,
  box: Box,
  crosshair: Crosshair,
  target: Target,
  bookmark: Bookmark,
  hash: Hash,
};

interface WorkspaceIconProps {
  name: string;
  size?: number;
  className?: string;
}

export function WorkspaceIcon({ name, size = 16, className }: WorkspaceIconProps) {
  const Icon = ICON_MAP[name as WorkspaceIconName];
  if (!Icon) {
    // Fallback for legacy emoji icons or unknown names
    return <span className={className} style={{ fontSize: size }}>{name}</span>;
  }
  return <Icon size={size} className={className} />;
}
