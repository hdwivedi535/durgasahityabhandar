/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@dsb/shared'],
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

module.exports = nextConfig;
