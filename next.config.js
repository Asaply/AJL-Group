/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The sidebar prefetches whole pages (data included) for instant clicks.
    // Realtime refreshes clear them on changes, but tables without realtime
    // (notes) would otherwise stay cached for the 5 minute default.
    staleTimes: { dynamic: 0, static: 30 },
  },
};

module.exports = nextConfig;
