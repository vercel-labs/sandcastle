import { NextResponse } from "next/server";
import { getSession, createGuestSession } from "@/lib/auth/session";
import { enforceRateLimit, RATE_LIMIT_IDS } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const existing = await getSession();
  if (existing) {
    return NextResponse.json({ error: "Already authenticated" }, { status: 400 });
  }

  const rateLimited = await enforceRateLimit(RATE_LIMIT_IDS.guestCreate, req);
  if (rateLimited) return rateLimited;

  await createGuestSession();
  return NextResponse.json({ ok: true });
}
