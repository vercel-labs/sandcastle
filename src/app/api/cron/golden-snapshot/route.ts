import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildGoldenSnapshot } from "@/lib/sandbox/build-golden-snapshot";

export const maxDuration = 600;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await buildGoldenSnapshot({
      logPrefix: "cron:golden-snapshot",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron:golden-snapshot] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to create golden snapshot",
      },
      { status: 500 },
    );
  }
}
