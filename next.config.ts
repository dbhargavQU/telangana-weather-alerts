import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    typedRoutes: true
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "tilecache.rainviewer.com" },
      { protocol: "https", hostname: "tile.openstreetmap.org" }
    ]
  }
};

export default nextConfig;


