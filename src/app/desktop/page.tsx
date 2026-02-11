import { getSession } from "@/lib/auth/session";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { DesktopShell } from "./desktop-shell";

export default async function DesktopPage() {
  const session = await getSession();

  if (!session) {
    const showDevAuth = process.env.NODE_ENV === "development";
    return <AuthScreen showDevAuth={showDevAuth} allowGuest />;
  }

  return <DesktopShell user={session} />;
}
