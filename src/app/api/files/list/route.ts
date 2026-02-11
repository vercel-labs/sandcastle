import { proxyGet } from "@/lib/api/sandbox-proxy";

export const GET = proxyGet({
  servicePath: "/files/list",
  params: (url) => ({
    path: url.searchParams.get("path") || "/vercel/sandbox",
  }),
});
