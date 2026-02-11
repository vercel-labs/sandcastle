import { NextResponse } from "next/server";
import { getAuthedSandbox } from "./get-authed-sandbox";
import type { SandboxInfo } from "@/types/sandbox";

type Handler = (req: Request) => Promise<NextResponse>;

interface ProxyGetOptions {
  servicePath: string;
  params?: (url: URL) => Record<string, string>;
}

interface ProxyPostOptions {
  servicePath: string;
  required?: string[];
  body?: (json: Record<string, unknown>) => Record<string, unknown>;
}

function buildServiceUrl(
  sandbox: SandboxInfo,
  path: string,
  query?: Record<string, string>,
): string {
  const url = new URL(`https://${sandbox.domains.services}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function forwardToService(
  url: string,
  init?: RequestInit,
): Promise<NextResponse> {
  const res = await fetch(url, init);
  const data = await res.json();
  return NextResponse.json(data);
}

export function proxyGet({ servicePath, params }: ProxyGetOptions): Handler {
  return async (req) => {
    const url = new URL(req.url);
    const result = await getAuthedSandbox(url.searchParams.get("workspaceId"));
    if (result instanceof NextResponse) return result;

    const query = params?.(url) ?? {};
    const serviceUrl = buildServiceUrl(result.sandbox, servicePath, query);
    return forwardToService(serviceUrl);
  };
}

export function proxyPost({
  servicePath,
  required = [],
  body: mapBody,
}: ProxyPostOptions): Handler {
  return async (req) => {
    const json = (await req.json()) as Record<string, unknown>;

    for (const field of required) {
      if (!json[field]) {
        return NextResponse.json(
          { error: `${field} required` },
          { status: 400 },
        );
      }
    }

    const result = await getAuthedSandbox(json.workspaceId as string | null);
    if (result instanceof NextResponse) return result;

    const payload = mapBody ? mapBody(json) : json;
    const { workspaceId: _, ...rest } = payload;

    const serviceUrl = buildServiceUrl(result.sandbox, servicePath);
    return forwardToService(serviceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rest),
    });
  };
}
