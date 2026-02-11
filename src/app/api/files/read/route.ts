import { NextResponse } from "next/server";
import { proxyGet } from "@/lib/api/sandbox-proxy";

const proxy = proxyGet({
  servicePath: "/files/read",
  params: (url) => ({ path: url.searchParams.get("path")! }),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!url.searchParams.get("path")) {
    return NextResponse.json(
      { error: "workspaceId and path required" },
      { status: 400 },
    );
  }
  return proxy(req);
}
