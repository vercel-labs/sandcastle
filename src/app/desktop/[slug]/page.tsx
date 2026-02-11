import { getSession } from "@/lib/auth/session";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { DesktopShell } from "../desktop-shell";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  const { slug } = await params;

  if (!session) {
    return <AuthScreen allowGuest />;
  }

  return <DesktopShell user={session} targetSlug={slug} />;
}
