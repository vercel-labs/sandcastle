import { proxyPost } from "@/lib/api/sandbox-proxy";

export const POST = proxyPost({
  servicePath: "/files/write",
  required: ["path"],
  body: ({ path, content }) => ({ path, content }),
});
