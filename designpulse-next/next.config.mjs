/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['astonish-refusal-hug.ngrok-free.dev'],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/py-api/:path*',
        destination: 'http://127.0.0.1:8001/:path*',
      },
    ];
  },
};

export default nextConfig;