export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export type SnapZone =
  | "left"
  | "right"
  | "top"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | null;

export interface WindowState {
  id: string;
  title: string;
  appId: string;
  position: WindowPosition;
  size: WindowSize;
  minimized: boolean;
  maximized: boolean;
  focused: boolean;
  zIndex: number;
  snapped?: SnapZone;
  preSnapPosition?: WindowPosition;
  preSnapSize?: WindowSize;
  meta?: Record<string, unknown>;
}

export type WindowAppType =
  | "terminal"
  | "file-manager"
  | "settings"
  | "text-editor"
  | "xpra"
  | "web";
