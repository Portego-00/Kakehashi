import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/media-converter/[asset]": [
      "./node_modules/@ffmpeg/core/dist/esm/*",
      "./node_modules/@ffmpeg/ffmpeg/dist/esm/*.js",
    ],
    "/api/subjects/enrichments": [
      "../assets/pitch/wanikani_pitch_accents.json",
      "../assets/patterns/wanikani_vocabulary_patterns.json",
    ],
  },
  outputFileTracingRoot: join(projectRoot, ".."),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.myanimelist.net", pathname: "/images/anime/**" },
      { protocol: "https", hostname: "i.scdn.co", pathname: "/image/**" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
      { protocol: "https", hostname: "www.gravatar.com", pathname: "/avatar/**" },
    ],
  },
  turbopack: {
    root: join(projectRoot, ".."),
  },
  webpack(config) {
    config.resolve.modules = [join(projectRoot, "node_modules"), ...(config.resolve.modules ?? [])];
    return config;
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
