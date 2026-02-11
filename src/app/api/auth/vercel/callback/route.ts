import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { users, accounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createSession, getSession } from "@/lib/auth/session";

function getBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL)
    return "https://sandcastle-os.vercel.app";
  return "http://localhost:3000";
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

interface VercelUserInfo {
  sub: string;
  email: string;
  name?: string;
  preferred_username?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    const desc = searchParams.get("error_description") || errorParam;
    return NextResponse.redirect(
      `${getBaseUrl()}/desktop?error=${encodeURIComponent(desc)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${getBaseUrl()}/desktop?error=${encodeURIComponent("Missing code or state")}`,
    );
  }

  const jar = await cookies();
  const storedState = jar.get("oauth_state")?.value;
  const codeVerifier = jar.get("oauth_code_verifier")?.value;

  jar.delete("oauth_state");
  jar.delete("oauth_code_verifier");

  if (!storedState || state !== storedState) {
    return NextResponse.redirect(
      `${getBaseUrl()}/desktop?error=${encodeURIComponent("Invalid state parameter")}`,
    );
  }

  if (!codeVerifier) {
    return NextResponse.redirect(
      `${getBaseUrl()}/desktop?error=${encodeURIComponent("Missing PKCE verifier")}`,
    );
  }

  const clientId = process.env.VERCEL_CLIENT_ID!;
  const clientSecret = process.env.VERCEL_CLIENT_SECRET!;
  const redirectUri = `${getBaseUrl()}/api/auth/vercel/callback`;

  // Exchange authorization code for tokens
  const tokenRes = await fetch("https://api.vercel.com/login/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error("Token exchange failed:", errText);
    return NextResponse.redirect(
      `${getBaseUrl()}/desktop?error=${encodeURIComponent("Token exchange failed")}`,
    );
  }

  const tokens: TokenResponse = await tokenRes.json();

  // Fetch user info from Vercel
  const userInfoRes = await fetch(
    "https://api.vercel.com/login/oauth/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    },
  );

  if (!userInfoRes.ok) {
    console.error("Failed to fetch user info:", await userInfoRes.text());
    return NextResponse.redirect(
      `${getBaseUrl()}/desktop?error=${encodeURIComponent("Failed to fetch user info")}`,
    );
  }

  const vercelUser: VercelUserInfo = await userInfoRes.json();

  // Check if the current session is a guest user (upgrade path)
  const currentSession = await getSession();

  // Find or create user
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.vercelId, vercelUser.sub));

  if (!user) {
    // Check if a user with this email exists (e.g. signed up with password previously)
    [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, vercelUser.email));

    if (user) {
      // Link Vercel account to existing user
      await db
        .update(users)
        .set({ vercelId: vercelUser.sub, name: vercelUser.name || user.name })
        .where(eq(users.id, user.id));
    } else if (currentSession?.role === "guest") {
      // Upgrade guest user to full user -- preserves their workspace(s)
      [user] = await db
        .update(users)
        .set({
          email: vercelUser.email,
          name: vercelUser.name || vercelUser.preferred_username || null,
          vercelId: vercelUser.sub,
          role: "user",
        })
        .where(eq(users.id, currentSession.id))
        .returning();
    } else {
      // Create new user
      [user] = await db
        .insert(users)
        .values({
          email: vercelUser.email,
          name: vercelUser.name || vercelUser.preferred_username || null,
          vercelId: vercelUser.sub,
        })
        .returning();
    }
  } else {
    // Update name/email if changed on Vercel side
    await db
      .update(users)
      .set({
        email: vercelUser.email,
        name: vercelUser.name || user.name,
      })
      .where(eq(users.id, user.id));
  }

  // Upsert the account (OAuth tokens)
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, user.id),
        eq(accounts.provider, "vercel"),
      ),
    );

  if (existingAccount) {
    await db
      .update(accounts)
      .set({
        providerAccountId: vercelUser.sub,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || existingAccount.refreshToken,
        accessTokenExpiresAt: expiresAt,
        scope: tokens.scope || existingAccount.scope,
        idToken: tokens.id_token || existingAccount.idToken,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, existingAccount.id));
  } else {
    await db.insert(accounts).values({
      userId: user.id,
      provider: "vercel",
      providerAccountId: vercelUser.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: expiresAt,
      scope: tokens.scope,
      idToken: tokens.id_token,
    });
  }

  await createSession(user.id);

  return NextResponse.redirect(`${getBaseUrl()}/desktop`);
}
