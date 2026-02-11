"use client";

import { useActiveSandbox } from "@/stores/workspace-store";
import { NoWorkspacePlaceholder } from "@/components/apps/no-workspace-placeholder";

export function CodeServerApp({ meta }: { meta?: Record<string, unknown> }) {
  const { sandbox } = useActiveSandbox();

  if (!sandbox) {
    return (
      <NoWorkspacePlaceholder message="No active workspace. Create one to use Code." />
    );
  }

  const filePath = typeof meta?.filePath === "string" ? meta.filePath : null;

  const base = `https://${sandbox.domains.codeServer}`;
  const params = new URLSearchParams({ folder: "/vercel/sandbox" });

  if (filePath) {
    params.set(
      "payload",
      JSON.stringify([["openFile", `vscode-remote://remote${filePath}`]]),
    );
  }

  const src = `${base}/?${params.toString()}`;

  return (
    <iframe
      src={src}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
      allow="clipboard-read; clipboard-write"
      title="VS Code"
    />
  );
}
