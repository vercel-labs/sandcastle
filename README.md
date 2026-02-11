# Sandcastle

A cloud desktop environment powered by [Vercel](https://vercel.com) and [Vercel Sandbox](https://vercel.com/docs/sandbox). Each user gets isolated Linux workspaces accessible from any browser, with a window manager, terminal, file browser, code editor, and X11 app streaming.

## ⚠️ Warning

This was an AI engineered/vibecoded repository and is not meant for production. It is a proof-of-concept and demo. 

## Architecture

```
Browser (React)                    Vercel (Next.js)                 Vercel Sandbox (microVM)
┌──────────────────┐              ┌──────────────────┐             ┌──────────────────────┐
│ Desktop UI       │◄────────────►│ API Routes       │◄───────────►│ :14081 Services API  │
│ Window Manager   │              │ /api/sandbox/*   │             │   - file CRUD        │
│ Taskbar          │              │ /api/auth/*      │             │   - .desktop scanner │
│ App Launcher     │              │ /api/files/*     │             │   - process launcher │
│ (Cmd+K)          │              │ /api/apps/*      │             │                      │
│                  │              │                  │             │                      │
│ Terminal ────────┼──── WSS ─────┼──────────────────┼────────────►│ :14081 PTY Relay     │
│ (ghostty-web)    │              │                  │             │   - bash over WS     │
│                  │              │ Sandbox SDK      │             │                      │
│ Code Server ─────┼── iframe ───┼──────────────────┼────────────►│ :14082 code-server   │
│                  │              │ (@vercel/sandbox)│             │   - VS Code in browser│
│                  │              │                  │             │                      │
│ Xpra Canvas ─────┼── WSS ─────┼──────────────────┼────────────►│ :14080 Xpra Server   │
│ (X11 apps)       │              │                  │             │   - X11 app streaming│
│                  │              │                  │             │                      │
│ File Manager ────┼── fetch ────┼──► proxy ────────┼────────────►│ :14083 Reserved      │
└──────────────────┘              └────────┬─────────┘             └──────────────────────┘
                                           │
                                  ┌────────▼─────────┐
                                  │ Neon Postgres     │
                                  │ - users           │
                                  │ - workspaces      │
                                  │ - warm_pool       │
                                  │ - config          │
                                  └──────────────────┘
```

## Tech Stack

| Layer         | Tech                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| Framework     | Next.js 16 (App Router, Turbopack)                                                 |
| Language      | TypeScript                                                                         |
| Styling       | Tailwind CSS 4                                                                     |
| State         | Zustand 5 + SWR                                                                    |
| Database      | Neon Postgres + Drizzle ORM                                                        |
| Sandbox       | `@vercel/sandbox` (Firecracker microVMs)                                           |
| Terminal      | `ghostty-web` (Ghostty WASM terminal)                                              |
| Code Editor   | code-server (VS Code)                                                              |
| X11 Streaming | Xpra HTML5 client                                                                  |
| Auth          | Password auth (dev) + cookie-based sessions. OAuth ready (bring your own provider) |

## Features

- **Window Management** -- drag, resize, snap-to-edge tiling, maximize, minimize, z-index focus tracking, debounced persistence
- **Keyboard Shortcuts** -- configurable KDE-style keybinds (Alt+Tab, Cmd+K launcher, Ctrl+Alt+T terminal, etc.)
- **App Launcher** (Cmd+K) -- fuzzy search command palette across all apps
- **Built-in Apps** -- Terminal (Ghostty), File Manager, Code Editor (VS Code), Settings, App Store (dnf package manager)
- **X11 Apps** -- Firefox, GIMP, Nautilus, GNOME Calculator, Text Editor, and more streamed via Xpra
- **Multiple Workspaces** -- each backed by its own sandbox VM with independent state
- **Theme Sync** -- browser light/dark theme synced to GTK settings inside the sandbox
- **Desktop Notifications** -- D-Bus bridge for `notify-send` and GLib/GTK notification support
- **Mobile Support** -- full-screen stacked card view, touch controls, iOS keyboard handling

## Setup

### Prerequisites

- [Node.js](https://nodejs.org) 22+
- [pnpm](https://pnpm.io) 10+
- [Bun](https://bun.sh) (for running scripts)
- A [Vercel](https://vercel.com) account with Sandbox access
- A Postgres database (the demo uses Neon via [Vercel Marketplace](https://vercel.com/marketplace/neon))

### 1. Clone and install

```bash
git clone <repo-url>
cd sandcastle
pnpm install
```

### 2. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```bash
# Neon Postgres connection string
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Session signing secret (min 32 characters)
SESSION_SECRET=<run: openssl rand -base64 32>

# Secret for authenticating cron jobs (generate a random string)
CRON_SECRET=<run: openssl rand -base64 32>
```

> **Auth**: In development (`NODE_ENV=development`), email/password auth is enabled -- no OAuth needed. The codebase includes a Vercel-specific OAuth integration under `src/app/api/auth/vercel/` as a reference, but you'll need to swap it for your own OAuth provider (GitHub, Google, etc.) for production use.

If you have a Vercel project linked, you can pull `DATABASE_URL` and `VERCEL_OIDC_TOKEN` automatically:

```bash
vercel link
vercel env pull
```

### 3. Set up the database

Push the schema to your Neon database:

```bash
pnpm db:push
```

### 4. Build the golden snapshot

The golden snapshot is a pre-configured VM image with all system packages, desktop apps, and dev tools pre-installed. New workspaces clone from it for fast startup (~5s vs ~2min from scratch).

```bash
pnpm snapshot
```

This takes 2-4 minutes.

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). In development mode, password-based auth is available in addition to Vercel OAuth.

### 6. (Optional) Run the integration test

```bash
pnpm test:sandbox
```

This spawns a sandbox from the golden snapshot and verifies all services (PTY, Xpra, code-server, file API) are working.

## Environment Variables

| Variable               | Required   | Description                                                       |
| ---------------------- | ---------- | ----------------------------------------------------------------- |
| `DATABASE_URL`         | Yes        | Neon Postgres connection string                                   |
| `SESSION_SECRET`       | Yes        | HMAC-SHA256 session signing secret (min 32 chars)                 |
| `VERCEL_CLIENT_ID`     | No         | OAuth client ID (ships with Vercel OAuth; swap for your provider) |
| `VERCEL_CLIENT_SECRET` | No         | OAuth client secret                                               |
| `CRON_SECRET`          | Production | Bearer token for cron and pool replenish endpoints                |
| `VERCEL_OIDC_TOKEN`    | Auto       | Set automatically by Vercel in production                         |
| `BETTER_AUTH_URL`      | No         | Override base URL for OAuth callbacks                             |

## Scripts

| Command             | Description                                   |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Start dev server (Turbopack)                  |
| `pnpm build`        | Production build                              |
| `pnpm start`        | Start production server                       |
| `pnpm lint`         | Run ESLint                                    |
| `pnpm snapshot`     | Rebuild golden snapshot (3-8 min)             |
| `pnpm test:sandbox` | Integration test against golden snapshot      |
| `pnpm db:push`      | Push schema to database                       |
| `pnpm db:generate`  | Generate migration files from schema changes  |
| `pnpm db:migrate`   | Apply pending migrations                      |
| `pnpm db:studio`    | Open Drizzle Studio (visual database browser) |

## Deploying to Vercel

1. Push to a git repository connected to Vercel
2. Set all required environment variables in your Vercel project settings
3. `VERCEL_OIDC_TOKEN` is set automatically -- no action needed
4. Cron jobs are configured in `vercel.json` and will run automatically:
   - **Golden snapshot rebuild** -- daily at midnight
   - **Sandbox lifecycle** -- every 30 minutes (snapshots/stops idle sandboxes)
   - **Warm pool maintenance** -- every 10 minutes (keeps 3 pre-warmed VMs ready)

## Golden Snapshot

The golden snapshot includes:

- **System tools**: vim, htop, wget, jq, tree, tmux, ripgrep
- **X11/GTK4 stack**: Xvfb, Xpra, mesa, dbus, GStreamer, Adwaita icons
- **Desktop apps**: Firefox, GIMP, Nautilus, GNOME Calculator, Text Editor, Loupe, Papers, System Monitor, Ptyxis, Seahorse
- **Fonts**: Noto Sans, Noto Emoji, DejaVu
- **Dev tools**: code-server (VS Code + extensions), Claude Code, OpenCode, Bun, pm2
- **Config**: GTK dark theme, Xpra CSP headers, XDG directories, desktop shortcuts, Firefox profile, shell aliases

Snapshots expire after 7 days and are rebuilt automatically by the daily cron job.

To test a specific snapshot:

```bash
pnpm test:sandbox -- --snapshot snap_abc123
```

## Acknowledgments

- [Dusk](https://github.com/pacocoursey/Dusk) by Paco Coursey for the app icons
- [Xpra](https://xpra.org) for the X11 streaming technology
- [code-server](https://github.com/coder/code-server) for the in-browser VS Code experience
- [Ghostty](https://ghostty.org/) and [ghostty-web](https://github.com/coder/ghostty-web) for the WASM terminal

## License

[MIT](LICENSE)
