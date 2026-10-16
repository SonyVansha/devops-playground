const basePath = process.env.BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // App ini tidak memakai next/image: matikan optimizer dan buang sharp/libvips (~37 MB) dari output standalone.
  images: { unoptimized: true },
  outputFileTracingExcludes: {
    '*': ['node_modules/sharp/**', 'node_modules/@img/**', 'node_modules/@next/swc-*/**'],
  },
  // Untuk tes ingress dengan sub-path: build dengan BASE_PATH=/playground
  basePath,
  // Diteruskan ke kode client agar fetch() ikut prefix.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
