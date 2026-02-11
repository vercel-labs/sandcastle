import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry

interface TokenResult {
  accessToken: string;
  expiresAt: Date | null;
}

export async function getValidVercelToken(
  userId: string,
): Promise<TokenResult | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.provider, "vercel")),
    );

  if (!account) return null;

  const now = Date.now();
  const isExpired =
    account.accessTokenExpiresAt &&
    account.accessTokenExpiresAt.getTime() - REFRESH_BUFFER_MS < now;

  if (!isExpired && account.accessToken) {
    return {
      accessToken: account.accessToken,
      expiresAt: account.accessTokenExpiresAt,
    };
  }

  if (!account.refreshToken) return null;

  const clientId = process.env.VERCEL_CLIENT_ID;
  const clientSecret = process.env.VERCEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://api.vercel.com/login/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    console.error("Vercel token refresh failed:", await res.text());
    return null;
  }

  const data = await res.json();
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  await db
    .update(accounts)
    .set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || account.refreshToken,
      accessTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, account.id));

  return { accessToken: data.access_token, expiresAt };
}
