import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@plataforma/core'],
  images: { unoptimized: true },
};

export default config;
