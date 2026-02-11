import { proxyGet } from "@/lib/api/sandbox-proxy";

export const GET = proxyGet({ servicePath: "/desktop-entries" });
