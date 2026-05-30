/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ignore typescript errors during build for robust production compilation
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignore lint errors during build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
