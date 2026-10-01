import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a production build be checked (NEXT_DIST_DIR=.next-build) while a dev server holds .next.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
