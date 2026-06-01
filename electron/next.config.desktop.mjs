/**
 * Next.js config for Electron (desktop) builds.
 * Merge this into next.config.mjs when building for Electron.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Important for Electron: use standalone output so all files are self-contained
  output: 'standalone',
}

export default nextConfig
