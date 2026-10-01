import type { NextConfig } from 'next';

/** Sent with every response (docs/BACKEND.md, "Camadas de segurança"). */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here is meant to be framed, the admin screen least of all.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // The game uses none of these browser features.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  // Browsers ignore HSTS over plain http, so it is harmless on localhost.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a production build be checked (NEXT_DIST_DIR=.next-build) while a dev server holds .next.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
