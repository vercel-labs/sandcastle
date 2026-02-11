import { checkRateLimit } from "@vercel/firewall";
import { NextResponse } from "next/server";

export const RATE_LIMIT_IDS = {
  guestCreate: "guest-create",
  sandboxCreate: "sandbox-create",
  sandboxCreateIp: "sandbox-create-ip",
  sandboxExtend: "sandbox-extend",
  sandboxStop: "sandbox-stop",
  sandboxSnapshot: "sandbox-snapshot",
  sandboxDelete: "sandbox-delete",
} as const;

export async function enforceRateLimit(
  ruleId: string,
  request: Request,
  rateLimitKey?: string,
  role?: string,
): Promise<NextResponse | null> {
  if (role === "admin") return null;

  try {
    const { rateLimited } = await checkRateLimit(ruleId, {
      request,
      ...(rateLimitKey ? { rateLimitKey } : {}),
    });

    if (rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 },
      );
    }
  } catch (err) {
    console.warn(`[rate-limit] checkRateLimit("${ruleId}") failed:`, err);
  }

  return null;
}
