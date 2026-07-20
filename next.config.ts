import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['portal.architechia.co'],
  async redirects() {
    return [
      { source: '/pipeline', destination: '/leads', permanent: true },
      { source: '/cuentas', destination: '/resources/cuentas', permanent: true },
      { source: '/team', destination: '/hub', permanent: true },
      { source: '/productos', destination: '/solutions', permanent: true },
      { source: '/productos/:path*', destination: '/solutions/:path*', permanent: true },
    ];
  },
};

export default nextConfig;
