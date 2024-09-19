import dotenv from 'dotenv';

dotenv.config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/messages': [
        'node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/barretenberg-threads.wasm',
        'node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/barretenberg_wasm_main/factory/node/main.worker.js',
        '/node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/barretenberg_wasm_thread/factory/node/thread.worker.js'
      ],
    },
  },
  reactStrictMode: true,
  sassOptions: {
    includePaths: ['./'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'developers.google.com',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  },
  webpack: (config) => {
    config.experiments = {
      asyncWebAssembly: true,
      syncWebAssembly: true,
      layers: true,
    }
    return config
  },
};

export default nextConfig;
