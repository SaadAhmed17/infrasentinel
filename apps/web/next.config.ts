import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Services page was renamed to Features; old links keep working.
  async redirects() {
    return [{ source: '/services', destination: '/features', permanent: true }];
  },
};

export default nextConfig;
