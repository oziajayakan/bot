import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow Vercel Cron to call without CORS issues
  async headers() {
    return [
      {
        source: '/api/cron',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};

export default nextConfig;
