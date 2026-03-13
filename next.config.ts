import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'yt3.ggpht.com' },
      { hostname: 'yt3.googleusercontent.com' },
      { hostname: 'i.ytimg.com' },
      { hostname: 'lh3.googleusercontent.com' },
      { hostname: 'ytimg.googleusercontent.com' }
    ],
  },
};

export default nextConfig;
