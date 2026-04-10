import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "googleapis", "prisma"],
};

export default nextConfig;
