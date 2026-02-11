import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.vercel.sh",
      },
    ],
    dangerouslyAllowSVG: true,
  },
  serverExternalPackages: ["@vercel/sandbox"],
};

export default nextConfig;
