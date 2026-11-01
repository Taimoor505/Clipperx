import type {NextConfig} from 'next';

// CLIPPERX_DESKTOP=1 builds plain static files (out/) that the desktop app serves itself
const isDesktop = process.env.CLIPPERX_DESKTOP === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    unoptimized: isDesktop,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: isDesktop ? 'export' : 'standalone',
  // Separate build folder, so a desktop build can run while `next dev` is up
  distDir: isDesktop ? '.next-desktop' : '.next',
  // Files named *.web.ts exist only in the web build. The demo API route
  // (app/api/analyze/route.web.ts) needs a server, which a static desktop export can't have.
  pageExtensions: isDesktop ? ['tsx', 'ts', 'jsx', 'js'] : ['web.ts', 'tsx', 'ts', 'jsx', 'js'],
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
