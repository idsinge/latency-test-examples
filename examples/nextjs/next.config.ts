import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/latency-test-examples/nextjs',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
