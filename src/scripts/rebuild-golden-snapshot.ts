/**
 * Rebuild the golden snapshot directly (no API server needed).
 *
 * Usage:
 *   bun run src/scripts/rebuild-golden-snapshot.ts
 *   bun run src/scripts/rebuild-golden-snapshot.ts --install "sudo dnf install -y firefox"
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { buildGoldenSnapshot } from "../lib/sandbox/build-golden-snapshot";
import {
  prunePool,
  replenishPool,
  expireOldSnapshotVMs,
} from "../lib/sandbox/warm-pool";

const installScript = process.argv.includes("--install")
  ? process.argv[process.argv.indexOf("--install") + 1]
  : undefined;

const skipPool = process.argv.includes("--no-pool");

console.log("Starting golden snapshot build...");
if (installScript) {
  console.log(`Custom install script: ${installScript}`);
}
console.log("");

const start = Date.now();

try {
  const result = await buildGoldenSnapshot({
    installScript,
    logPrefix: "rebuild",
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log("");
  console.log(`Golden snapshot created in ${elapsed}s`);
  console.log(JSON.stringify(result, null, 2));
  console.log("");
  console.log("All new workspaces will use this snapshot.");

  if (!skipPool) {
    console.log("\nRefreshing warm pool...");

    // Replenish first so new-snapshot VMs are available before clearing old ones
    const poolResult = await replenishPool();
    console.log(
      `  Pool: ${poolResult.created} created, ${poolResult.existing} existing, target ${poolResult.target}`,
    );

    const expiredOld = await expireOldSnapshotVMs();
    if (expiredOld > 0) {
      console.log(`  Expired ${expiredOld} VMs from old snapshot`);
    }

    const pruned = await prunePool();
    if (pruned > 0) {
      console.log(`  Pruned ${pruned} stale pool entries`);
    }

    console.log("Warm pool refreshed.");
  }
} catch (err) {
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.error(`\nFailed after ${elapsed}s:`, err);
  process.exit(1);
}
