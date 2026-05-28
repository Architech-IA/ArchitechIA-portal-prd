import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const SUPERADMIN_ONLY = ['/traceability', '/graph', '/reportes'];

const PUBLIC_PATHS = ['/api/public-summary', '/login'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (PUBLIC_PATHS.some(p => path.startsWith(p))) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const isRestricted = SUPERADMIN_ONLY.some(p => path === p || path.startsWith(p + '/'));
  if (isRestricted && token?.role !== 'SUPERADMIN') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/traceability/:path*', '/graph/:path*', '/reportes/:path*'],
};
