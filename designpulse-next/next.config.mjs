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
};

export default nextConfig;