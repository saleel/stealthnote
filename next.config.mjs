/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
  sassOptions: {
    includePaths: ['./app'],
  },
}

export default nextConfig;