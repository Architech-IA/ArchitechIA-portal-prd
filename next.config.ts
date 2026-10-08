import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Carpeta de salida configurable: scripts/deploy-prod.sh compila en .next-build mientras el portal
  // sigue sirviendo desde .next, y recién después intercambia (ver ese script).
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
