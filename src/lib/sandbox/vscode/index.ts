import geistDark from "./geist-dark.json";
import geistLight from "./geist-light.json";

const EXTENSION_RELATIVE =
  ".local/share/code-server/extensions/sandcastle-geist-theme";

/**
 * Returns all files needed to configure code-server with Geist themes and
 * sane defaults. When `homeDir` is provided, paths are absolute. Otherwise
 * they are relative (caller must ensure writeFiles resolves to $HOME).
 */
export function getCodeServerFiles(homeDir?: string): Array<{
  path: string;
  content: string;
}> {
  const prefix = homeDir ? `${homeDir}/` : "";
  const EXTENSION_DIR = `${prefix}${EXTENSION_RELATIVE}`;

  return [
    // VS Code extension: package.json
    {
      path: `${EXTENSION_DIR}/package.json`,
      content: JSON.stringify(
        {
          name: "sandcastle-geist-theme",
          displayName: "Geist Theme",
          description: "Vercel Geist design system theme for VS Code",
          version: "1.0.0",
          publisher: "sandcastle",
          engines: { vscode: "^1.60.0" },
          categories: ["Themes"],
          contributes: {
            themes: [
              {
                label: "Geist Dark",
                uiTheme: "vs-dark",
                path: "./themes/geist-dark.json",
              },
              {
                label: "Geist Light",
                uiTheme: "vs",
                path: "./themes/geist-light.json",
              },
            ],
          },
        },
        null,
        2,
      ),
    },
    // Dark theme
    {
      path: `${EXTENSION_DIR}/themes/geist-dark.json`,
      content: JSON.stringify(geistDark, null, 2),
    },
    // Light theme
    {
      path: `${EXTENSION_DIR}/themes/geist-light.json`,
      content: JSON.stringify(geistLight, null, 2),
    },
    // User settings
    {
      path: `${prefix}.local/share/code-server/User/settings.json`,
      content: JSON.stringify(
        {
          // Theme
          "workbench.colorTheme": "Geist Dark",
          "workbench.preferredDarkColorTheme": "Geist Dark",
          "workbench.preferredLightColorTheme": "Geist Light",

          // Font
          "editor.fontFamily":
            "'Geist Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
          "editor.fontSize": 13,
          "editor.lineHeight": 1.6,
          "terminal.integrated.fontFamily": "'Geist Mono', monospace",
          "terminal.integrated.fontSize": 13,

          // Hide welcome / startup
          "workbench.startupEditor": "none",
          "workbench.tips.enabled": false,

          // Hide AI chat sidebar
          "chat.editor.enabled": false,

          // Open home directory by default
          "window.restoreWindows": "none",
          "window.newWindowDimensions": "maximized",

          // General UX
          "editor.minimap.enabled": false,
          "editor.bracketPairColorization.enabled": true,
          "editor.guides.bracketPairs": "active",
          "editor.smoothScrolling": true,
          "workbench.list.smoothScrolling": true,
          "editor.cursorSmoothCaretAnimation": "on",
          "editor.renderWhitespace": "selection",
          "files.trimTrailingWhitespace": true,
          "files.insertFinalNewline": true,

          // Terminal
          "terminal.integrated.defaultProfile.linux": "bash",

          // Trust all workspaces (sandbox is already isolated)
          "security.workspace.trust.enabled": false,

          // Telemetry off
          "telemetry.telemetryLevel": "off",
        },
        null,
        2,
      ),
    },
  ];
}
