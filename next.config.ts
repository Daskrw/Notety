import path from "path";
import type { NextConfig } from "next";

const isTauriBuild = process.env.TAURI_ENV_PLATFORM !== undefined || process.env.BUILD_TARGET === 'tauri';

const nextConfig: NextConfig = {
  output: isTauriBuild ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ['localhost:3000', '192.168.1.37'],
};

export default nextConfig;

