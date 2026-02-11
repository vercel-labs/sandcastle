import { proxyPost } from "@/lib/api/sandbox-proxy";

export const POST = proxyPost({
  servicePath: "/files/delete",
  required: ["path"],
  body: ({ path }) => ({ path }),
});
