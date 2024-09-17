import dotenv from 'dotenv';

dotenv.config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: false,
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
