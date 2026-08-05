import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow loading /_next/* dev assets when hitting the Pi over its LAN IP
  allowedDevOrigins: ["10.155.127.228"],
};

export default nextConfig;
