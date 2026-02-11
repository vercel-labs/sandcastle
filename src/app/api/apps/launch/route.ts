import { proxyPost } from "@/lib/api/sandbox-proxy";

export const POST = proxyPost({
  servicePath: "/process/run",
  required: ["command"],
  body: ({ command, args }) => ({ command, args: args || [] }),
});
