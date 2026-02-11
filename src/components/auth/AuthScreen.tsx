"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginMutate, signupMutate } from "@/lib/hooks/use-swr-hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/ui/loading-dots";
import { Note } from "@/components/ui/note";

function VercelLogo() {
  return (
    <svg
      aria-label="Vercel Logo"
      fill="currentColor"
      viewBox="0 0 75 65"
      height="14"
      width="14"
    >
      <path d="M37.59.25l36.95 64H.64l36.95-64z" />
    </svg>
  );
}

export function AuthScreen({
  showDevAuth = false,
  allowGuest = false,
}: {
  showDevAuth?: boolean;
  allowGuest?: boolean;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await loginMutate(email, password);
      } else {
        await signupMutate(email, password, name || undefined);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError(null);
    setGuestLoading(true);
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create guest session");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGuestLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-100">
      <div className="w-full max-w-sm p-8 material-medium">
        <h1 className="text-heading-24 text-gray-1000 mb-1">Sandcastle</h1>
        <p className="text-label-14 text-gray-900 mb-6">
          Sign in to your desktop
        </p>

        <a
          href="/api/auth/vercel"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-gray-1000 px-4 py-2 text-label-14 text-gray-100 transition-opacity hover:opacity-90"
        >
          <VercelLogo />
          Continue with Vercel
        </a>

        {allowGuest && (
          <>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-alpha-400" />
              <span className="text-label-12 text-gray-700">or</span>
              <div className="h-px flex-1 bg-gray-alpha-400" />
            </div>

            <button
              type="button"
              onClick={handleGuest}
              disabled={guestLoading}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-alpha-400 bg-background-100 px-4 py-2 text-label-14 text-gray-1000 transition-colors hover:bg-gray-alpha-100 disabled:opacity-50"
            >
              {guestLoading ? <LoadingDots /> : "Try as Guest"}
            </button>

            <p className="mt-2 text-center text-label-12 text-gray-700">
              Limited to 1 workspace. Sign in for more.
            </p>
          </>
        )}

        {error && (
          <div className="mt-4">
            <Note type="error" size="small">
              {error}
            </Note>
          </div>
        )}

        {showDevAuth && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-alpha-400" />
              <span className="text-label-12 text-gray-700">
                DEV ONLY
              </span>
              <div className="h-px flex-1 bg-gray-alpha-400" />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {mode === "signup" && (
                <Input
                  label="Name"
                  id="auth-name"
                  typeName="text"
                  placeholder="Optional"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
              <Input
                label="Email"
                id="auth-email"
                typeName="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Input
                label="Password"
                id="auth-password"
                typeName="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={4}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />

              <Button
                typeName="submit"
                disabled={loading}
                loading={loading}
                className="mt-2"
              >
                {loading ? (
                  <LoadingDots />
                ) : mode === "login" ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <p className="mt-5 text-center text-label-13 text-gray-900">
              {mode === "login" ? (
                <>
                  No account?{" "}
                  <button
                    type="button"
                    className="text-gray-1000 underline underline-offset-2 hover:opacity-80"
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                    }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have one?{" "}
                  <button
                    type="button"
                    className="text-gray-1000 underline underline-offset-2 hover:opacity-80"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
