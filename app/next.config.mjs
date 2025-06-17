import dotenv from 'dotenv';
import webpack from 'webpack';

dotenv.config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@stealthnote/provider-organization-google-jwt', '@stealthnote/provider-organization-email'],
  experimental: {
    outputFileTracingIncludes: {
      '/api/messages': [
        '../node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/**/*',
        '../node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/barretenberg_wasm_thread/factory/node/thread.worker.js',
        '../node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/barretenberg_wasm_main/factory/node/main.worker.js',
      ],
      '/api/messages/': [
        '../node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/**/*',
        '../node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/barretenberg_wasm_thread/factory/node/thread.worker.js',
        '../node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/barretenberg_wasm_main/factory/node/main.worker.js',
      ],
    },
  },
  reactStrictMode: false,
  sassOptions: {
    includePaths: ['./'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'developers.google.com',
      },
      {
        protocol: 'https',
        hostname: 'img.logo.dev',
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
    };
    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      new webpack.NormalModuleReplacementPlugin(/node:/, (resource) => {
        const mod = resource.request.replace(/^node:/, '');
        switch (mod) {
          case 'buffer':
            resource.request = 'buffer';
            break;
          case 'stream':
            resource.request = 'readable-stream';
            break;
          default:
            throw new Error(`Not found ${mod}`);
        }
      }),
    );
    return config;
  },
  // async headers() {
  //   return [
  //     {
  //       // Exclude all oauth-callback paths
  //       source: '/((?!oauth-callback).*)',
  //       headers: [
  //         {
  //           key: 'Cross-Origin-Embedder-Policy',
  //           value: 'require-corp',
  //         },
  //         {
  //           key: 'Cross-Origin-Opener-Policy',
  //           value: 'same-origin',
  //         },
  //       ],
  //     },
  //     {
  //       // Special case for iOS devices - disable COOP/COEP
  //       source: '/((?!oauth-callback).*)',
  //       headers: [
  //         {
  //           key: 'Cross-Origin-Embedder-Policy',
  //           value: 'unsafe-none',
  //         },
  //         {
  //           key: 'Cross-Origin-Opener-Policy',
  //           value: 'unsafe-none',
  //         },
  //       ],
  //       // Only apply these headers for iOS devices
  //       has: [
  //         {
  //           type: 'header',
  //           key: 'user-agent',
  //           value: '(.*iPhone|iPad|iPod.*)',
  //         },
  //       ],
  //     },
  //   ];
  // },
};

export default nextConfig;
