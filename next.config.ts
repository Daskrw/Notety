import type { NextConfig } from "next";

const isTauriBuild = process.env.TAURI_ENV_PLATFORM !== undefined || process.env.BUILD_TARGET === 'tauri';

const nextConfig: NextConfig = {
  output: isTauriBuild ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

