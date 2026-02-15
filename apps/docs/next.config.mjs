import { createMDX } from 'fumadocs-mdx/next';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const withMDX = createMDX();
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  basePath: '/docs',
  trailingSlash: false,

  // Disable Image Optimization globally - required for multi-zone proxy setups
  // This bypasses the /_next/image API which has issues with basePath when proxied
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: repoRoot,
  },
  async rewrites() {
    return [
      {
        source: '/fcp/llms-full.txt',
        destination: '/llms-full.txt/fcp',
      },
      {
        source: '/fcp/:path+/llms-full.txt',
        destination: '/llms-full.txt/fcp/:path*',
      },
      {
        source: '/gateway/llms-full.txt',
        destination: '/llms-full.txt/gateway',
      },
      {
        source: '/gateway/:path+/llms-full.txt',
        destination: '/llms-full.txt/gateway/:path*',
      },
      {
        source: '/workspace/llms-full.txt',
        destination: '/llms-full.txt/workspace',
      },
      {
        source: '/workspace/:path+/llms-full.txt',
        destination: '/llms-full.txt/workspace/:path*',
      },
      {
        source: '/tools/llms-full.txt',
        destination: '/llms-full.txt/tools',
      },
      {
        source: '/tools/:path+/llms-full.txt',
        destination: '/llms-full.txt/tools/:path*',
      },
      {
        source: '/:path*.md',
        destination: '/llms.mdx/:path*',
      },
      {
        source: '/:path*.mdx',
        destination: '/llms.mdx/:path*',
      },
    ];
  },
};

export default withMDX(config);
