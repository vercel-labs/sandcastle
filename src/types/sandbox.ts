export interface SandboxInfo {
  sandboxId: string;
  status: string;
  domains: {
    xpra: string;
    services: string; // HTTP file/process API + WS PTY at /ws/terminal
    codeServer: string;
    preview: string;
  };
  timeout: number;
  createdAt: string;
}

export interface SandboxCreateOptions {
  workspaceName?: string;
  snapshotId?: string;
}
