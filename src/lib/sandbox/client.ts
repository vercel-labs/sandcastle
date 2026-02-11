import { Sandbox } from "@vercel/sandbox";
import type { SandboxInfo } from "@/types/sandbox";
import { SANDBOX_PORTS, PORTS } from "./ports";
import { getServiceCode } from "./sandbox-services";
import { getEcosystemConfig, SERVICE_DIR, XPRA_DISPLAY, DBUS_SOCKET_PATH } from "./ecosystem-config";

const DEFAULT_TIMEOUT = 20 * 60 * 1000; // 20 minutes

// sandbox.domain() returns "https://subdomain.vercel.run"
// We strip the protocol so consumers can choose https:// or wss://
function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

function buildSandboxInfo(sandbox: Sandbox): SandboxInfo {
  return {
    sandboxId: sandbox.sandboxId,
    status: sandbox.status,
    domains: {
      xpra: stripProtocol(sandbox.domain(PORTS.XPRA)),
      services: stripProtocol(sandbox.domain(PORTS.SERVICES)),
      codeServer: stripProtocol(sandbox.domain(PORTS.CODE_SERVER)),
      preview: stripProtocol(sandbox.domain(PORTS.PREVIEW)),
    },
    timeout: sandbox.timeout,
    createdAt: sandbox.createdAt.toISOString(),
  };
}

export interface CreateSandboxResult extends SandboxInfo {
  fallback?: boolean;
}

export async function createSandbox(snapshotId?: string): Promise<CreateSandboxResult> {
  let sandbox: Sandbox;
  let usedSnapshot = false;

  if (snapshotId) {
    try {
      sandbox = await Sandbox.create({
        source: { type: "snapshot", snapshotId },
        ports: SANDBOX_PORTS,
        timeout: DEFAULT_TIMEOUT,
      });
      usedSnapshot = true;
    } catch (err: unknown) {
      const isNotFound =
        err instanceof Error &&
        (err.message.includes("404") ||
          err.message.includes("not found") ||
          err.message.includes("Not Found") ||
          (typeof (err as unknown as Record<string, unknown>).text === "string" &&
            ((err as unknown as Record<string, unknown>).text as string).includes("not_found")));

      if (isNotFound) {
        console.warn(
          `[sandbox] Snapshot ${snapshotId} not found (expired?), falling back to fresh sandbox`,
        );
        sandbox = await Sandbox.create({
          runtime: "node24",
          ports: SANDBOX_PORTS,
          timeout: DEFAULT_TIMEOUT,
        });
      } else {
        throw err;
      }
    }
  } else {
    sandbox = await Sandbox.create({
      runtime: "node24",
      ports: SANDBOX_PORTS,
      timeout: DEFAULT_TIMEOUT,
    });
  }

  if (usedSnapshot) {
    await startServices(sandbox);
  } else {
    await bootstrapSandbox(sandbox);
  }

  return { ...buildSandboxInfo(sandbox), fallback: snapshotId ? !usedSnapshot : undefined };
}

async function startServices(sandbox: Sandbox): Promise<void> {
  // Ensure DISPLAY and DBUS_SESSION_BUS_ADDRESS are set for all login shells.
  // Also baked into golden snapshot, but written at runtime for fresh sandboxes.
  await sandbox.runCommand({
    cmd: "bash",
    args: [
      "-c",
      `sudo mkdir -p /etc/profile.d && sudo tee /etc/profile.d/sandbox-display.sh > /dev/null << 'EOF'
export DISPLAY=${XPRA_DISPLAY}
export DBUS_SESSION_BUS_ADDRESS=unix:path=${DBUS_SOCKET_PATH}
export GIO_USE_SYSTEMD=0
EOF`,
    ],
  });

  // pm2 starts all services from the ecosystem config
  await sandbox.runCommand({
    cmd: "bash",
    args: ["-c", `pm2 start ${SERVICE_DIR}/ecosystem.config.js`],
    detached: true,
  });
}

async function bootstrapSandbox(sandbox: Sandbox): Promise<void> {
  // Fresh VM without golden snapshot -- write everything and install deps
  await sandbox.runCommand({
    cmd: "bash",
    args: ["-c", `sudo mkdir -p ${SERVICE_DIR} && sudo chown $(whoami) ${SERVICE_DIR}`],
  });
  await sandbox.writeFiles([
    { path: `${SERVICE_DIR}/service.js`, content: Buffer.from(getServiceCode()) },
    { path: `${SERVICE_DIR}/package.json`, content: Buffer.from('{"name":"sandcastle-services","private":true}') },
    { path: `${SERVICE_DIR}/ecosystem.config.js`, content: Buffer.from(getEcosystemConfig()) },
  ]);

  // Install service deps + pm2
  await sandbox.runCommand({
    cmd: "bash",
    args: ["-c", `cd ${SERVICE_DIR} && npm install ws && npm install -g pm2`],
  });

  await startServices(sandbox);
}

export async function getSandbox(sandboxId: string): Promise<SandboxInfo> {
  const sandbox = await Sandbox.get({ sandboxId });
  return buildSandboxInfo(sandbox);
}

export async function stopSandbox(sandboxId: string): Promise<void> {
  const sandbox = await Sandbox.get({ sandboxId });
  await sandbox.stop();
}

export async function snapshotSandbox(sandboxId: string): Promise<string> {
  const sandbox = await Sandbox.get({ sandboxId });
  const snapshot = await sandbox.snapshot();
  return snapshot.snapshotId;
}

export async function extendSandboxTimeout(
  sandboxId: string,
  durationMs: number,
): Promise<void> {
  const sandbox = await Sandbox.get({ sandboxId });
  await sandbox.extendTimeout(durationMs);
}

export async function listSandboxes() {
  const { json } = await Sandbox.list();
  return json.sandboxes;
}
