import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin - Sandcastle",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || session.role !== "admin") {
    redirect("/desktop");
  }

  return (
    <div className="min-h-screen bg-background-200">
      <header className="border-b border-gray-alpha-400 bg-background-100">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-label-16 font-semibold text-gray-1000">
              Sandcastle Admin
            </h1>
          </div>
          <div className="flex items-center gap-3 text-copy-13 text-gray-900">
            <span>{session.email ?? session.name}</span>
            <a
              href="/desktop"
              className="text-blue-700 hover:underline underline-offset-4"
            >
              Back to Desktop
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
