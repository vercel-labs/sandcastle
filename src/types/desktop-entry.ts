export interface DesktopEntry {
  id: string;
  name: string;
  icon: string;
  exec: string | null;
  type: "builtin" | "x11" | "web";
  component: string | null;
  categories: string[];
  comment: string | null;
  /** true if sourced from ~/Desktop (shows as a desktop icon) */
  onDesktop?: boolean;
}
