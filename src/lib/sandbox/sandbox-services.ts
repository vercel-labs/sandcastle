import { PORTS } from "./ports";
import { BRIDGE_STATE_PATH } from "./ecosystem-config";

export function getServiceCode(): string {
  return `
const http = require("http");
const { WebSocketServer } = require("ws");
const { spawn } = require("child_process");
const { readdir, readFile, writeFile, unlink, stat, mkdir, rm, rename } = require("fs/promises");
const path = require("path");

const BRIDGE_STATE = "${BRIDGE_STATE_PATH}";

const PORT = ${PORTS.SERVICES};
const HOME = process.env.HOME || require("os").homedir();

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, \`http://localhost:\${PORT}\`);
  const pathname = url.pathname;

  try {
    if (pathname === "/health") return json(res, { ok: true });

    if (pathname === "/files/list") {
      const dir = url.searchParams.get("path") || HOME;
      const entries = await readdir(dir, { withFileTypes: true });
      const items = await Promise.all(entries.map(async (e) => {
        const fullPath = path.join(dir, e.name);
        let size = 0;
        try { const s = await stat(fullPath); size = s.size; } catch {}
        return { name: e.name, path: fullPath, isDirectory: e.isDirectory(), size };
      }));
      return json(res, { items });
    }

    if (pathname === "/files/read") {
      const filePath = url.searchParams.get("path");
      if (!filePath) return error(res, 400, "path required");
      const content = await readFile(filePath, "utf-8");
      return json(res, { content, path: filePath });
    }

    if (pathname === "/files/write" && req.method === "POST") {
      const body = await readBody(req);
      const { path: filePath, content } = JSON.parse(body);
      if (!filePath) return error(res, 400, "path required");
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf-8");
      return json(res, { ok: true, path: filePath });
    }

    if (pathname === "/files/delete" && req.method === "POST") {
      const body = await readBody(req);
      const { path: filePath } = JSON.parse(body);
      if (!filePath) return error(res, 400, "path required");
      const fileStat = await stat(filePath);
      if (fileStat.isDirectory()) {
        await rm(filePath, { recursive: true, force: true });
      } else {
        await unlink(filePath);
      }
      return json(res, { ok: true });
    }

    if (pathname === "/files/mkdir" && req.method === "POST") {
      const body = await readBody(req);
      const { path: dirPath } = JSON.parse(body);
      if (!dirPath) return error(res, 400, "path required");
      await mkdir(dirPath, { recursive: true });
      return json(res, { ok: true, path: dirPath });
    }

    if (pathname === "/files/rename" && req.method === "POST") {
      const body = await readBody(req);
      const { oldPath, newPath } = JSON.parse(body);
      if (!oldPath || !newPath) return error(res, 400, "oldPath and newPath required");
      await mkdir(path.dirname(newPath), { recursive: true });
      await rename(oldPath, newPath);
      return json(res, { ok: true, oldPath, newPath });
    }

    if (pathname === "/desktop-entries") {
      const result = await scanDesktopEntries();
      return json(res, result);
    }

    if (pathname === "/icon") {
      const name = url.searchParams.get("name");
      if (!name) return error(res, 400, "name required");
      const iconPath = await resolveIconCached(name);
      if (!iconPath) {
        res.writeHead(404, { "Content-Type": "image/svg+xml" });
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#222"/><circle cx="24" cy="24" r="8" fill="#555"/></svg>');
      }
      try {
        const data = await readFile(iconPath);
        const ext = path.extname(iconPath).toLowerCase();
        const mimeTypes = { ".png": "image/png", ".svg": "image/svg+xml", ".xpm": "image/x-xpixmap", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".ico": "image/x-icon" };
        const contentType = mimeTypes[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" });
        return res.end(data);
      } catch (err) {
        return error(res, 500, "Failed to read icon: " + err.message);
      }
    }

    if (pathname === "/process/run" && req.method === "POST") {
      const body = await readBody(req);
      const { command, args = [] } = JSON.parse(body);
      const child = spawn(command, args, { detached: true, stdio: "ignore" });
      child.unref();
      return json(res, { pid: child.pid });
    }

    // ---- Package install/remove (no shell, argument-array only) ----
    const PKG_NAME_RE = /^[a-zA-Z0-9._+-]+$/;

    if (pathname === "/packages/install" && req.method === "POST") {
      const body = await readBody(req);
      const { name, version } = JSON.parse(body);
      if (!name || !PKG_NAME_RE.test(name)) return error(res, 400, "invalid package name");
      if (version && !PKG_NAME_RE.test(version)) return error(res, 400, "invalid version");
      const pkg = version ? name + "-" + version : name;
      try {
        const { execFileSync } = require("child_process");
        const stdout = execFileSync("sudo", ["dnf", "install", "-y", pkg], {
          encoding: "utf-8",
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, LC_ALL: "C" },
        });
        return json(res, { ok: true, stdout, exitCode: 0 });
      } catch (err) {
        const stdout = err.stdout || "";
        const stderr = err.stderr || "";
        const exitCode = err.status ?? 1;
        return json(res, { ok: false, stdout, stderr, exitCode });
      }
    }

    if (pathname === "/packages/remove" && req.method === "POST") {
      const body = await readBody(req);
      const { name } = JSON.parse(body);
      if (!name || !PKG_NAME_RE.test(name)) return error(res, 400, "invalid package name");
      try {
        const { execFileSync } = require("child_process");
        const stdout = execFileSync("sudo", ["dnf", "remove", "-y", name], {
          encoding: "utf-8",
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, LC_ALL: "C" },
        });
        return json(res, { ok: true, stdout, exitCode: 0 });
      } catch (err) {
        const stdout = err.stdout || "";
        const stderr = err.stderr || "";
        const exitCode = err.status ?? 1;
        return json(res, { ok: false, stdout, stderr, exitCode });
      }
    }

    // ---- Package management (dnf) ----
    //
    // Uses pipe "|" delimiters and %{reponame}/%{downloadsize} to avoid
    // the bug where %{repo} dumps the full repo config into stdout.
    // Uses --latest-limit=1 for the list view so only the newest version
    // per package is returned (fast, no client-side dedup needed).

    const DNF_EXEC_OPTS = {
      encoding: "utf-8",
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
      shell: "/bin/bash",
      env: { ...process.env, LC_ALL: "C" },
    };

    function parsePkgLines(stdout) {
      if (!stdout) return [];
      return stdout.split("\\n").map((line) => {
        const [name, summary, version] = line.split("|");
        return name ? { name, summary: summary || "", version: version || "" } : null;
      }).filter(Boolean);
    }

    if (pathname === "/packages/search") {
      const q = (url.searchParams.get("q") || "").trim();
      const guiOnly = url.searchParams.get("gui") === "1";
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
      if (!q && !guiOnly) return error(res, 400, "q or gui=1 required");
      try {
        const { execSync } = require("child_process");
        const safeQ = q.replace(/[^a-zA-Z0-9._*+-]/g, "");
        let cmd;
        if (guiOnly) {
          cmd = 'dnf repoquery --available --latest-limit=1 --whatprovides "*/usr/share/applications/*.desktop" --qf "%{name}|%{summary}|%{version}" 2>/dev/null';
          if (safeQ) cmd += ' | grep -i "' + safeQ + '"';
        } else {
          cmd = 'dnf repoquery --available --latest-limit=1 --qf "%{name}|%{summary}|%{version}" 2>/dev/null | grep -i "' + safeQ + '"';
        }
        cmd += " | sort -t'|' -k1,1 -u";
        const stdout = execSync(cmd, DNF_EXEC_OPTS).trim();
        const all = parsePkgLines(stdout);
        const total = all.length;
        const page = all.slice(offset, offset + limit);
        return json(res, { packages: page, total, offset, limit });
      } catch (err) {
        if (err.status === 1 && !err.stderr) return json(res, { packages: [], total: 0, offset, limit });
        return json(res, { packages: [], total: 0, offset, limit, error: err.message });
      }
    }

    if (pathname === "/packages/installed") {
      try {
        const { execSync } = require("child_process");
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 500);
        const q = (url.searchParams.get("q") || "").trim();
        let cmd = 'dnf repoquery --installed --qf "%{name}|%{summary}|%{version}" 2>/dev/null';
        if (q) cmd += ' | grep -i "' + q.replace(/[^a-zA-Z0-9._*+-]/g, "") + '"';
        cmd += " | sort -t'|' -k1,1 -u";
        const stdout = execSync(cmd, { ...DNF_EXEC_OPTS, timeout: 15_000 }).trim();
        const all = parsePkgLines(stdout);
        const total = all.length;
        const page = all.slice(offset, offset + limit);
        return json(res, { packages: page, total, offset, limit });
      } catch (err) {
        if (err.status === 1 && !err.stderr) return json(res, { packages: [], total: 0 });
        return error(res, 500, "Failed to list installed packages: " + err.message);
      }
    }

    if (pathname === "/packages/versions") {
      const name = url.searchParams.get("name");
      if (!name) return error(res, 400, "name required");
      try {
        const { execSync } = require("child_process");
        const safeName = name.replace(/[^a-zA-Z0-9._+-]/g, "");
        const availStdout = execSync(
          'dnf repoquery --available --qf "%{version}-%{release}|%{reponame}|%{downloadsize}" "' + safeName + '" 2>/dev/null | sort -Vr -t"|" -k1,1',
          { ...DNF_EXEC_OPTS, timeout: 15_000 },
        ).trim();
        const versions = availStdout ? availStdout.split("\\n").map((line) => {
          const [vr, repo, size] = line.split("|");
          return vr ? { version: vr, repo: repo || "", size: parseInt(size) || 0 } : null;
        }).filter(Boolean) : [];
        let installedVersion = null;
        try {
          const instStdout = execSync(
            'dnf repoquery --installed --qf "%{version}-%{release}" "' + safeName + '" 2>/dev/null',
            { ...DNF_EXEC_OPTS, timeout: 5_000 },
          ).trim();
          if (instStdout) installedVersion = instStdout.split("\\n")[0];
        } catch {}
        return json(res, { name: safeName, versions, installedVersion });
      } catch (err) {
        return error(res, 404, "Package not found: " + name);
      }
    }

    if (pathname === "/packages/info") {
      const name = url.searchParams.get("name");
      if (!name) return error(res, 400, "name required");
      try {
        const { execSync } = require("child_process");
        const safeName = name.replace(/[^a-zA-Z0-9._+-]/g, "");
        const stdout = execSync(
          'dnf info "' + safeName + '" 2>/dev/null',
          { ...DNF_EXEC_OPTS, timeout: 15_000, maxBuffer: 1024 * 1024 },
        );
        const info = {};
        let currentKey = "";
        for (const line of stdout.split("\\n")) {
          if (line.startsWith(" ") && currentKey) {
            info[currentKey] += " " + line.trim();
          } else {
            const match = line.match(/^([^:]+?)\\s*:\\s*(.+)/);
            if (match) {
              currentKey = match[1].trim().toLowerCase().replace(/\\s+/g, "_");
              info[currentKey] = match[2].trim();
            }
          }
        }
        return json(res, { info });
      } catch (err) {
        return error(res, 404, "Package not found: " + name);
      }
    }

    if (pathname === "/packages/repos") {
      if (req.method === "GET") {
        try {
          const { execSync } = require("child_process");
          const stdout = execSync(
            'dnf repolist --all 2>/dev/null',
            { ...DNF_EXEC_OPTS, timeout: 10_000 },
          ).trim();
          const repos = [];
          for (const line of stdout.split("\\n").slice(1)) {
            const match = line.match(/^(\\S+)\\s+(.+?)\\s+(enabled|disabled)\\s*$/);
            if (match) repos.push({ id: match[1], name: match[2].trim(), enabled: match[3] === "enabled" });
          }
          return json(res, { repos });
        } catch (err) {
          return error(res, 500, "Failed to list repos: " + err.message);
        }
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const { repoUrl, name: repoName } = JSON.parse(body);
        if (!repoUrl) return error(res, 400, "repoUrl required");
        const safeUrl = repoUrl.replace(/[^a-zA-Z0-9:/._%?&=-]/g, "");
        const safeName = (repoName || "custom").replace(/[^a-zA-Z0-9._-]/g, "");
        if (!safeUrl || !safeName) return error(res, 400, "invalid repo url or name");
        try {
          const { execFileSync } = require("child_process");
          try {
            execFileSync("sudo", ["dnf", "config-manager", "--add-repo", safeUrl], {
              ...DNF_EXEC_OPTS, timeout: 15_000,
            });
          } catch {
            const repoContent = "[" + safeName + "]\\nname=" + safeName + "\\nbaseurl=" + safeUrl + "\\nenabled=1\\ngpgcheck=0\\n";
            const repoPath = "/etc/yum.repos.d/" + safeName + ".repo";
            execFileSync("sudo", ["tee", repoPath], {
              ...DNF_EXEC_OPTS,
              timeout: 15_000,
              input: repoContent,
            });
          }
          return json(res, { ok: true });
        } catch (err) {
          return error(res, 500, "Failed to add repo: " + (err.stderr || err.message));
        }
      }
    }

    // ---- Sandbox bridge routes ----
    // The Python sandbox-bridge daemon writes state to a shared JSON file.
    // These routes expose that state to the browser.

    if (pathname === "/bridge/notifications") {
      try {
        const raw = await readFile(BRIDGE_STATE, "utf-8");
        const state = JSON.parse(raw);
        const since = parseInt(url.searchParams.get("since") || "0", 10);
        const notifications = (state.notifications || []).filter(
          (n) => n.timestamp > since
        );
        return json(res, { notifications });
      } catch (err) {
        if (err.code === "ENOENT") return json(res, { notifications: [] });
        throw err;
      }
    }

    if (pathname === "/bridge/notifications/dismiss" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const { id } = JSON.parse(body);
        const raw = await readFile(BRIDGE_STATE, "utf-8");
        const state = JSON.parse(raw);
        state.notifications = (state.notifications || []).filter(
          (n) => n.id !== id
        );
        await writeFile(BRIDGE_STATE, JSON.stringify(state), "utf-8");
        return json(res, { ok: true });
      } catch (err) {
        if (err.code === "ENOENT") return json(res, { ok: true });
        throw err;
      }
    }

    if (pathname === "/bridge/settings" && req.method === "GET") {
      try {
        const raw = await readFile(BRIDGE_STATE, "utf-8");
        const state = JSON.parse(raw);
        return json(res, {
          colorScheme: state.colorScheme ?? 1,
          inhibited: state.inhibited ?? false,
        });
      } catch (err) {
        if (err.code === "ENOENT") return json(res, { colorScheme: 1, inhibited: false });
        throw err;
      }
    }

    if (pathname === "/bridge/settings" && req.method === "POST") {
      const body = await readBody(req);
      const updates = JSON.parse(body);
      let state = {};
      try {
        const raw = await readFile(BRIDGE_STATE, "utf-8");
        state = JSON.parse(raw);
      } catch {}
      if (updates.colorScheme !== undefined) {
        state.colorScheme = updates.colorScheme;
      }
      await writeFile(BRIDGE_STATE, JSON.stringify(state), "utf-8");
      return json(res, { ok: true });
    }

    if (pathname === "/bridge/apps-generation") {
      try {
        const raw = await readFile(BRIDGE_STATE, "utf-8");
        const state = JSON.parse(raw);
        return json(res, { generation: state.appsGeneration ?? 0 });
      } catch (err) {
        if (err.code === "ENOENT") return json(res, { generation: 0 });
        throw err;
      }
    }

    return error(res, 404, "not found");
  } catch (err) { return error(res, 500, err.message); }
});

// WebSocket PTY at /ws/terminal on the same HTTP server
const wss = new WebSocketServer({ server, path: "/ws/terminal" });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, \`http://localhost:\${PORT}\`);
  const cols = parseInt(url.searchParams.get("cols") || "80", 10);
  const rows = parseInt(url.searchParams.get("rows") || "24", 10);

  const home = process.env.HOME || require("os").homedir();
  const env = { ...process.env, TERM: "xterm-256color", HOME: home, COLUMNS: String(cols), LINES: String(rows) };

  // Use Python to spawn bash in a real PTY with proper size control.
  // Python's pty.fork() gives us a true PTY with ioctl resize support.
  const pyScript = \`
import pty, os, sys, fcntl, struct, termios, select, signal

cols, rows = int(sys.argv[1]), int(sys.argv[2])
pid, fd = pty.fork()
if pid == 0:
    os.chdir("\${home}")
    os.execvpe("/bin/bash", ["/bin/bash", "-l"], dict(os.environ, TERM="xterm-256color", HOME="\${home}"))

# Set initial size
fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
os.kill(pid, signal.SIGWINCH)

sys.stdout = os.fdopen(sys.stdout.fileno(), "wb", 0)
sys.stdin = os.fdopen(sys.stdin.fileno(), "rb", 0)

def handle_exit(*_):
    try: os.kill(pid, signal.SIGTERM)
    except: pass
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_exit)

while True:
    try:
        rlist, _, _ = select.select([fd, sys.stdin], [], [], 0.1)
    except (select.error, OSError):
        break

    if fd in rlist:
        try:
            data = os.read(fd, 65536)
            if not data: break
            sys.stdout.write(data)
        except OSError:
            break

    if sys.stdin in rlist:
        try:
            data = sys.stdin.read1(65536) if hasattr(sys.stdin, "read1") else os.read(sys.stdin.fileno(), 65536)
            if not data: break
            # Check for resize command (JSON preceded by \\x01)
            if data[:1] == b"\\x01":
                try:
                    import json
                    msg = json.loads(data[1:])
                    if msg.get("type") == "resize":
                        r, c = int(msg["rows"]), int(msg["cols"])
                        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", r, c, 0, 0))
                        os.kill(pid, signal.SIGWINCH)
                        continue
                except: pass
            os.write(fd, data)
        except OSError:
            break

try: os.waitpid(pid, 0)
except: pass
\`;

  const shell = spawn("python3", ["-u", "-c", pyScript, String(cols), String(rows)], {
    env,
    cwd: home,
    stdio: ["pipe", "pipe", "pipe"],
  });

  shell.stdout.on("data", (data) => { if (ws.readyState === 1) ws.send(data); });
  shell.stderr.on("data", (data) => { if (ws.readyState === 1) ws.send(data); });

  ws.on("message", (msg) => {
    const str = typeof msg === "string" ? msg : msg.toString("utf-8");
    try {
      const parsed = JSON.parse(str);
      if (parsed.type === "resize" && parsed.cols && parsed.rows) {
        // Send resize command with \\x01 prefix so Python can detect it
        shell.stdin.write("\\x01" + JSON.stringify(parsed));
        return;
      }
    } catch {}
    shell.stdin.write(str);
  });

  ws.on("close", () => { try { shell.kill(); } catch {} });
  shell.on("exit", () => { if (ws.readyState === 1) ws.close(); });
});

function json(res, data) { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); }
function error(res, code, message) { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: message })); }
function readBody(req) { return new Promise((resolve, reject) => { let body = ""; req.on("data", (chunk) => (body += chunk)); req.on("end", () => resolve(body)); req.on("error", reject); }); }

async function resolveIconPath(iconName) {
  if (!iconName) return null;
  // If it's already an absolute path, check if it exists
  if (iconName.startsWith("/")) {
    try { await stat(iconName); return iconName; } catch { return null; }
  }
  // Search standard icon theme directories for common sizes and formats
  const themes = ["hicolor", "Adwaita", "gnome", "breeze"];
  const sizes = ["scalable", "256x256", "128x128", "64x64", "48x48", "32x32", "24x24", "16x16"];
  const categories = ["apps", "categories", "devices", "places", "mimetypes", "actions", "status"];
  const extensions = [".svg", ".png", ".xpm"];
  const baseDirs = ["/usr/share/icons", "/usr/local/share/icons"];
  // Search icon themes
  for (const baseDir of baseDirs) {
    for (const theme of themes) {
      for (const size of sizes) {
        for (const category of categories) {
          for (const ext of extensions) {
            const candidate = path.join(baseDir, theme, size, category, iconName + ext);
            try { await stat(candidate); return candidate; } catch {}
          }
        }
      }
    }
  }
  // Search pixmaps
  const pixmapDirs = ["/usr/share/pixmaps", "/usr/local/share/pixmaps"];
  for (const dir of pixmapDirs) {
    for (const ext of ["", ...extensions]) {
      const candidate = path.join(dir, iconName + ext);
      try { await stat(candidate); return candidate; } catch {}
    }
  }
  return null;
}

// Cache resolved icon paths to avoid repeated filesystem scans
const iconCache = new Map();
async function resolveIconCached(iconName) {
  if (iconCache.has(iconName)) return iconCache.get(iconName);
  const resolved = await resolveIconPath(iconName);
  iconCache.set(iconName, resolved);
  return resolved;
}

async function scanDesktopEntries() {
  const homedir = require("os").homedir();
  // App catalog: system-wide + user-local (for the app menu)
  const appDirs = [
    "/usr/share/applications",
    "/usr/local/share/applications",
    path.join(homedir, ".local/share/applications"),
  ];
  // Desktop surface: files placed here show as desktop icons
  const desktopDir = path.join(homedir, "Desktop");

  const seen = new Set();
  const apps = [];
  const desktopShortcuts = [];

  // Scan desktop shortcuts first (these appear as icons on the desktop)
  try {
    const files = await readdir(desktopDir);
    for (const file of files) {
      if (!file.endsWith(".desktop")) continue;
      try {
        const content = await readFile(path.join(desktopDir, file), "utf-8");
        const entry = parseDesktopEntry(content, file);
        if (entry) {
          if (entry.icon && !entry.icon.startsWith("http")) {
            entry.icon = "/icon?name=" + encodeURIComponent(entry.icon);
          }
          entry.onDesktop = true;
          desktopShortcuts.push(entry);
          seen.add(entry.id);
        }
      } catch {}
    }
  } catch {}

  // Scan app catalog (for the full app menu)
  for (const dir of appDirs) {
    try {
      const files = await readdir(dir);
      for (const file of files) {
        if (!file.endsWith(".desktop")) continue;
        const id = file.replace(".desktop", "");
        if (seen.has(id)) continue;
        seen.add(id);
        try {
          const content = await readFile(path.join(dir, file), "utf-8");
          const entry = parseDesktopEntry(content, file);
          if (entry) {
            if (entry.icon && !entry.icon.startsWith("http")) {
              entry.icon = "/icon?name=" + encodeURIComponent(entry.icon);
            }
            apps.push(entry);
          }
        } catch {}
      }
    } catch {}
  }

  return { desktopShortcuts, apps, entries: [...desktopShortcuts, ...apps] };
}

function parseDesktopEntry(content, filename) {
  const lines = content.split("\\n");
  const entry = { id: filename.replace(".desktop", ""), type: "x11" };
  let inDesktopEntry = false;
  for (const line of lines) {
    if (line.trim() === "[Desktop Entry]") { inDesktopEntry = true; continue; }
    if (line.startsWith("[") && line.endsWith("]")) { inDesktopEntry = false; continue; }
    if (!inDesktopEntry) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    switch (key) {
      case "Name": entry.name = value; break;
      case "Icon": entry.icon = value; break;
      case "Exec": entry.exec = value.replace(/%[a-zA-Z]/g, "").trim(); break;
      case "Comment": entry.comment = value; break;
      case "Categories": entry.categories = value.split(";").filter(Boolean); break;
      case "NoDisplay": if (value === "true") return null; break;
    }
  }
  if (!entry.name) return null;
  return entry;
}

server.listen(PORT, "0.0.0.0", () => { console.log("Agent running on port " + PORT); });
`;
}
