import { db } from "@/lib/db/client";
import { config } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const GOLDEN_SNAPSHOT_KEY = "golden_snapshot_id";

export async function getGoldenSnapshotId(): Promise<string | null> {
  const [row] = await db
    .select()
    .from(config)
    .where(eq(config.key, GOLDEN_SNAPSHOT_KEY));
  return row?.value ?? null;
}

export async function setGoldenSnapshotId(snapshotId: string): Promise<void> {
  await db
    .insert(config)
    .values({
      key: GOLDEN_SNAPSHOT_KEY,
      value: snapshotId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: config.key,
      set: { value: snapshotId, updatedAt: new Date() },
    });
}
