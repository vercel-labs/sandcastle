/**
 * Integration test: spawn a sandbox from the golden snapshot and verify
 * that all sandbox service API routes work as expected.
 *
 * Usage:
 *   bun run src/scripts/test-sandbox-services.ts
 *   bun run src/scripts/test-sandbox-services.ts --snapshot <id>
 *
 * Requires VERCEL_AUTH_TOKEN (or VERCEL_TOKEN) in .env.local / env.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { Sandbox } from "@vercel/sandbox";
import { SANDBOX_PORTS, PORTS } from "../lib/sandbox/ports";
import { SERVICE_DIR, XPRA_DISPLAY } from "../lib/sandbox/ecosystem-config";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SNAPSHOT_ID =
  process.argv.includes("--snapshot")
    ? process.argv[process.argv.indexOf("--snapshot") + 1]
    : undefined;

const TIMEOUT_MS = 10 * 60 * 1000;
const SERVICE_READY_TIMEOUT_MS = 60_000;
const SERVICE_POLL_INTERVAL_MS = 2_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(label: string) {
  passed++;
  console.log(`  ✓ ${label}`);
}

function fail(label: string, err?: unknown) {
  failed++;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  failures.push(`${label}: ${msg}`);
  console.error(`  ✗ ${label}${msg ? ` — ${msg}` : ""}`);
}

async function assert(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    ok(label);
  } catch (err) {
    fail(label, err);
  }
}

function expect(actual: unknown, expected: unknown, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `${message ?? "Assertion failed"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function expectTruthy(value: unknown, message?: string) {
  if (!value) {
    throw new Error(`${message ?? "Expected truthy"}: got ${JSON.stringify(value)}`);
  }
}

function expectIncludes(haystack: string, needle: string, message?: string) {
  if (!haystack.includes(needle)) {
    throw new Error(
      `${message ?? "Expected string to include"} "${needle}", got: "${haystack.slice(0, 200)}"`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Sandbox Services Integration Test ===\n");

  // ---- Create sandbox ----
  console.log(
    SNAPSHOT_ID
      ? `Creating sandbox from snapshot ${SNAPSHOT_ID}...`
      : "Creating sandbox (fresh, no snapshot)...",
  );
  const createStart = Date.now();

  const sandbox = SNAPSHOT_ID
    ? await Sandbox.create({
        source: { type: "snapshot", snapshotId: SNAPSHOT_ID },
        ports: SANDBOX_PORTS,
        timeout: TIMEOUT_MS,
      })
    : await Sandbox.create({
        runtime: "node24",
        ports: SANDBOX_PORTS,
        timeout: TIMEOUT_MS,
      });

  const createElapsed = ((Date.now() - createStart) / 1000).toFixed(1);
  console.log(`Sandbox ${sandbox.sandboxId} created in ${createElapsed}s`);

  const servicesDomain = sandbox.domain(PORTS.SERVICES).replace(/^https?:\/\//, "");
  const servicesBase = `https://${servicesDomain}`;
  console.log(`Services URL: ${servicesBase}`);
  console.log("");

  try {
    // ---- Start services via pm2 ----
    console.log("Starting pm2 services...");
    // Ensure profile.d exists and has DISPLAY + DBUS set (snapshot may already have this)
    await sandbox.runCommand({
      cmd: "bash",
      args: [
        "-c",
        `sudo mkdir -p /etc/profile.d && sudo tee /etc/profile.d/sandbox-display.sh > /dev/null << 'EOF'
export DISPLAY=${XPRA_DISPLAY}
export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/sandcastle-dbus
export GIO_USE_SYSTEMD=0
EOF`,
      ],
    });
    await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", `pm2 start ${SERVICE_DIR}/ecosystem.config.js`],
      detached: true,
    });

    // ---- Wait for service health ----
    console.log("Waiting for sandcastle-svc to become healthy...");
    const healthStart = Date.now();
    let healthy = false;

    while (Date.now() - healthStart < SERVICE_READY_TIMEOUT_MS) {
      try {
        const res = await fetch(`${servicesBase}/health`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok) {
            healthy = true;
            break;
          }
        }
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, SERVICE_POLL_INTERVAL_MS));
    }

    if (!healthy) {
      // Dump pm2 logs for debugging
      const logs = await sandbox.runCommand({ cmd: "bash", args: ["-c", "pm2 logs --nostream --lines 30 2>&1 || true"] });
      console.error("pm2 logs:", await logs.stdout());
      throw new Error("Service did not become healthy within timeout");
    }

    const healthElapsed = ((Date.now() - healthStart) / 1000).toFixed(1);
    console.log(`Service healthy after ${healthElapsed}s\n`);

    // ==================================================================
    // Tests
    // ==================================================================

    console.log("--- Health ---");
    await assert("GET /health returns ok:true", async () => {
      const res = await fetch(`${servicesBase}/health`);
      expect(res.status, 200, "status");
      const data = await res.json();
      expect(data.ok, true, "ok");
    });

    // ---- File operations ----
    console.log("\n--- File Operations ---");

    await assert("POST /files/mkdir creates a directory", async () => {
      const res = await fetch(`${servicesBase}/files/mkdir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/vercel/sandbox/test-dir/nested" }),
      });
      expect(res.status, 200, "status");
      const data = await res.json();
      expect(data.ok, true, "ok");
    });

    await assert("POST /files/write creates a file", async () => {
      const res = await fetch(`${servicesBase}/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/vercel/sandbox/test-dir/hello.txt",
          content: "Hello from integration test!",
        }),
      });
      expect(res.status, 200, "status");
      const data = await res.json();
      expect(data.ok, true, "ok");
    });

    await assert("GET /files/read reads the file back", async () => {
      const res = await fetch(
        `${servicesBase}/files/read?path=${encodeURIComponent("/vercel/sandbox/test-dir/hello.txt")}`,
      );
      expect(res.status, 200, "status");
      const data = await res.json();
      expect(data.content, "Hello from integration test!", "content");
    });

    await assert("GET /files/list lists directory contents", async () => {
      const res = await fetch(
        `${servicesBase}/files/list?path=${encodeURIComponent("/vercel/sandbox/test-dir")}`,
      );
      expect(res.status, 200, "status");
      const data = await res.json();
      expectTruthy(Array.isArray(data.items), "items is array");
      const names = data.items.map((i: { name: string }) => i.name);
      expectTruthy(names.includes("hello.txt"), "hello.txt in listing");
      expectTruthy(names.includes("nested"), "nested dir in listing");
    });

    await assert("POST /files/delete removes the file", async () => {
      const res = await fetch(`${servicesBase}/files/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/vercel/sandbox/test-dir/hello.txt" }),
      });
      expect(res.status, 200, "status");
      const data = await res.json();
      expect(data.ok, true, "ok");
    });

    await assert("GET /files/read returns error for deleted file", async () => {
      const res = await fetch(
        `${servicesBase}/files/read?path=${encodeURIComponent("/vercel/sandbox/test-dir/hello.txt")}`,
      );
      expect(res.status, 500, "status");
    });

    await assert("GET /files/list on home dir includes standard dirs", async () => {
      // Determine the actual home dir inside the sandbox
      const homeResult = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "echo $HOME"],
      });
      const homeDir = (await homeResult.stdout()).trim() || "/home/vercel-sandbox";

      const res = await fetch(
        `${servicesBase}/files/list?path=${encodeURIComponent(homeDir)}`,
      );
      expect(res.status, 200, "status");
      const data = await res.json();
      const names = data.items.map((i: { name: string }) => i.name);
      expectTruthy(names.includes("Desktop"), `Desktop dir exists in ${homeDir}: [${names.join(", ")}]`);
    });

    // ---- Desktop entries ----
    console.log("\n--- Desktop Entries ---");

    await assert("GET /desktop-entries returns entries array", async () => {
      const res = await fetch(`${servicesBase}/desktop-entries`);
      expect(res.status, 200, "status");
      const data = await res.json();
      expectTruthy(Array.isArray(data.entries), "entries is array");
      expectTruthy(data.entries.length > 0, "entries non-empty");
    });

    await assert("Entries include XEyes from /usr/share/applications", async () => {
      const res = await fetch(`${servicesBase}/desktop-entries`);
      const data = await res.json();
      const names: string[] = data.entries.map((e: { name: string }) => e.name);
      expectTruthy(
        names.includes("XEyes"),
        `Expected "XEyes" in entries: [${names.join(", ")}]`,
      );
    });

    await assert("Entries include desktop apps when installed (Firefox, GIMP, etc.)", async () => {
      const res = await fetch(`${servicesBase}/desktop-entries`);
      const data = await res.json();
      const names: string[] = data.entries.map(
        (e: { name: string }) => e.name.toLowerCase(),
      );
      // These will only pass once the golden snapshot includes the new packages.
      // On the old snapshot, this test documents what's missing.
      const expected = ["firefox", "gimp", "calculator", "image viewer", "document viewer", "system monitor"];
      const found = expected.filter((e) => names.some((n) => n.includes(e)));
      const missing = expected.filter((e) => !names.some((n) => n.includes(e)));
      if (missing.length > 0) {
        throw new Error(
          `Missing desktop entries: [${missing.join(", ")}]. Found: [${names.slice(0, 20).join(", ")}]. ` +
            "Rebuild golden snapshot to include new packages.",
        );
      }
    });

    // ---- Icon resolution ----
    console.log("\n--- Icon Resolution ---");

    await assert("GET /icon?name=applications-other returns an image", async () => {
      const res = await fetch(`${servicesBase}/icon?name=applications-other`);
      // adwaita-icon-theme includes this icon; if not found, fallback is 404
      if (res.status === 200) {
        const ct = res.headers.get("content-type") ?? "";
        expectTruthy(ct.startsWith("image/"), `content-type is image: ${ct}`);
      } else {
        // If icon theme isn't fully installed, check that fallback SVG is returned
        expect(res.status, 404, "status (fallback)");
      }
    });

    await assert("GET /icon?name=nonexistent returns 404 fallback SVG", async () => {
      const res = await fetch(`${servicesBase}/icon?name=nonexistent-icon-xyz`);
      expect(res.status, 404, "status");
      const ct = res.headers.get("content-type") ?? "";
      expectTruthy(ct.includes("svg"), `fallback is SVG: ${ct}`);
    });

    await assert("GET /icon without name returns 400", async () => {
      const res = await fetch(`${servicesBase}/icon`);
      expect(res.status, 400, "status");
    });

    // ---- Process spawning ----
    console.log("\n--- Process Spawning ---");

    await assert("POST /process/run spawns a detached process", async () => {
      const res = await fetch(`${servicesBase}/process/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "sleep", args: ["1"] }),
      });
      expect(res.status, 200, "status");
      const data = await res.json();
      expectTruthy(typeof data.pid === "number", `pid is number: ${data.pid}`);
    });

    // ---- Installed packages ----
    console.log("\n--- Installed Packages ---");

    // Packages that should always be present (from the base golden snapshot)
    const coreBinaries = ["xpra", "code-server", "pm2"];
    // Packages from the updated golden snapshot (will fail on old snapshots)
    const desktopBinaries = [
      "firefox",
      "nautilus",
      "gnome-calculator",
      "gnome-text-editor",
      "gimp-3.0",
      "loupe",
      "papers",
      "gnome-system-monitor",
    ];

    for (const bin of coreBinaries) {
      await assert(`"${bin}" is installed and on PATH`, async () => {
        const result = await sandbox.runCommand({
          cmd: "bash",
          args: ["-c", `which ${bin}`],
        });
        expect(result.exitCode, 0, `which ${bin} exit code`);
      });
    }

    for (const bin of desktopBinaries) {
      await assert(`"${bin}" is installed (desktop app)`, async () => {
        const result = await sandbox.runCommand({
          cmd: "bash",
          args: ["-c", `which ${bin}`],
        });
        if (result.exitCode !== 0) {
          throw new Error(
            `${bin} not found. Rebuild golden snapshot to include desktop apps.`,
          );
        }
      });
    }

    await assert('"bun" is installed (in ~/.bun/bin or PATH)', async () => {
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "which bun || test -x ~/.bun/bin/bun"],
      });
      expect(result.exitCode, 0, "bun available");
    });

    // ---- Xpra / native bridge configuration ----
    console.log("\n--- Xpra & Native Bridges ---");

    await assert("Xpra is running on display :10", async () => {
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "pm2 jlist"],
      });
      const stdout = await result.stdout();
      expectTruthy(stdout.includes("xpra"), "xpra process in pm2 list");
    });

    await assert("Xpra started with --notifications=yes", async () => {
      // The xpra-start.sh wrapper script contains the Xpra args
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", `cat ${SERVICE_DIR}/xpra-start.sh`],
      });
      const stdout = await result.stdout();
      expectIncludes(stdout, "--notifications=yes", "xpra-start.sh includes --notifications=yes");
    });

    await assert("Xpra is listening on the expected WebSocket port", async () => {
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", `ss -tln 2>/dev/null | grep -q :${PORTS.XPRA} && echo LISTENING || echo NOT_LISTENING`],
      });
      const stdout = (await result.stdout()).trim();
      expectIncludes(stdout, "LISTENING", `port ${PORTS.XPRA} is listening`);
    });

    await assert("DISPLAY environment is set to :10", async () => {
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "cat /etc/profile.d/sandbox-display.sh"],
      });
      const stdout = await result.stdout();
      expectIncludes(stdout, "DISPLAY=:10", "DISPLAY env set");
    });

    await assert("DBUS_SESSION_BUS_ADDRESS is exported in profile", async () => {
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "grep DBUS_SESSION_BUS_ADDRESS /etc/profile.d/sandbox-display.sh && echo FOUND || echo MISSING"],
      });
      const stdout = (await result.stdout()).trim();
      expectIncludes(stdout, "FOUND", "DBUS_SESSION_BUS_ADDRESS in profile");
    });

    await assert("D-Bus session bus socket exists", async () => {
      await new Promise((r) => setTimeout(r, 2000));
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "test -S /tmp/sandcastle-dbus && echo ok || echo missing"],
      });
      const stdout = (await result.stdout()).trim();
      expectIncludes(stdout, "ok", "D-Bus session socket at /tmp/sandcastle-dbus");
    });

    await assert("dbus-launch is available (dbus-x11 installed)", async () => {
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "which dbus-launch"],
      });
      expect(result.exitCode, 0, "dbus-launch on PATH");
    });

    // ---- Sandbox bridge daemon ----
    console.log("\n--- Sandbox Bridge ---");

    await assert("sandbox-bridge is running in pm2", async () => {
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "pm2 jlist"],
      });
      const stdout = await result.stdout();
      expectTruthy(stdout.includes("sandbox-bridge"), "sandbox-bridge process in pm2 list");
    });

    await assert("sandbox-bridge claimed org.freedesktop.Notifications", async () => {
      // Wait for bridge to start and claim the name
      let lastOutput = "";
      for (let attempt = 0; attempt < 10; attempt++) {
        const result = await sandbox.runCommand({
          cmd: "bash",
          args: [
            "-c",
            'export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/sandcastle-dbus && dbus-send --session --dest=org.freedesktop.Notifications --print-reply /org/freedesktop/Notifications org.freedesktop.Notifications.GetServerInformation 2>&1',
          ],
        });
        const stdout = await result.stdout();
        const stderr = await result.stderr();
        lastOutput = (stdout + stderr).trim();
        if (lastOutput.includes("sandcastle-bridge")) {
          return;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      throw new Error(`Bridge not claiming Notifications name after retries: ${lastOutput}`);
    });

    await assert("notify-send is available", async () => {
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "which notify-send || rpm -q libnotify"],
      });
      if (result.exitCode !== 0) {
        throw new Error("notify-send not found");
      }
    });

    await assert("notify-send delivers notification (no error)", async () => {
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: [
          "-c",
          'export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/sandcastle-dbus && notify-send "Integration Test" "Hello from test suite" 2>&1; echo EXIT:$?',
        ],
      });
      const stdout = await result.stdout();
      const stderr = await result.stderr();
      const output = (stdout + stderr).trim();
      if (output.includes("ServiceUnknown") || output.includes("not provided by any .service")) {
        throw new Error(`notify-send failed: ${output}`);
      }
      expectIncludes(output, "EXIT:0", "notify-send exited successfully");
    });

    await assert("notification appears in bridge HTTP API", async () => {
      // Give the bridge a moment to write the state file
      await new Promise((r) => setTimeout(r, 500));
      const res = await fetch(`${servicesBase}/bridge/notifications?since=0`);
      expect(res.status, 200, "status");
      const data = await res.json();
      expectTruthy(Array.isArray(data.notifications), "notifications is array");
      const found = data.notifications.find(
        (n: { summary: string }) => n.summary === "Integration Test",
      );
      expectTruthy(found, `Expected "Integration Test" notification in bridge API, got: ${JSON.stringify(data.notifications.map((n: { summary: string }) => n.summary))}`);
    });

    await assert("bridge settings endpoint works", async () => {
      // Write a color-scheme preference
      const postRes = await fetch(`${servicesBase}/bridge/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorScheme: 2 }),
      });
      expect(postRes.status, 200, "POST status");

      // Read it back
      const getRes = await fetch(`${servicesBase}/bridge/settings`);
      expect(getRes.status, 200, "GET status");
      const data = await getRes.json();
      expect(data.colorScheme, 2, "colorScheme");
    });

    await assert("GTK theme is configured (Adwaita)", async () => {
      const homeResult = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "echo $HOME"],
      });
      const homeDir = (await homeResult.stdout()).trim();
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", `cat ${homeDir}/.config/gtk-3.0/settings.ini`],
      });
      const stdout = await result.stdout();
      expectIncludes(stdout, "Adwaita", "GTK3 theme includes Adwaita");
    });

    await assert("Adwaita icon theme is installed", async () => {
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "test -d /usr/share/icons/Adwaita && echo ok"],
      });
      const stdout = await result.stdout();
      expectIncludes(stdout, "ok", "Adwaita icon theme directory exists");
    });

    // ---- Welcome file ----
    console.log("\n--- Welcome ---");

    await assert("WELCOME.md exists in home directory", async () => {
      const homeResult = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", "echo $HOME"],
      });
      const homeDir = (await homeResult.stdout()).trim();
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", `test -f ${homeDir}/WELCOME.md && echo ok`],
      });
      const stdout = (await result.stdout()).trim();
      expectIncludes(stdout, "ok", "WELCOME.md exists");
    });

    // ---- Edge cases / error handling ----
    console.log("\n--- Error Handling ---");

    await assert("GET /nonexistent returns 404", async () => {
      const res = await fetch(`${servicesBase}/nonexistent`);
      expect(res.status, 404, "status");
    });

    await assert("POST /files/write without path returns 400", async () => {
      const res = await fetch(`${servicesBase}/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "no path" }),
      });
      expect(res.status, 400, "status");
    });

    await assert("POST /files/delete without path returns 400", async () => {
      const res = await fetch(`${servicesBase}/files/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status, 400, "status");
    });

    await assert("POST /files/mkdir without path returns 400", async () => {
      const res = await fetch(`${servicesBase}/files/mkdir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status, 400, "status");
    });

    await assert("GET /files/read without path returns 400", async () => {
      const res = await fetch(`${servicesBase}/files/read`);
      expect(res.status, 400, "status");
    });
  } finally {
    // ---- Cleanup ----
    console.log("\n--- Cleanup ---");
    try {
      await sandbox.stop();
      console.log(`Sandbox ${sandbox.sandboxId} stopped.`);
    } catch (err) {
      console.error(`Failed to stop sandbox: ${err}`);
    }
  }

  // ---- Summary ----
  console.log("\n========================================");
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
  }
  console.log("========================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
