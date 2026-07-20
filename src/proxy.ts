import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/public-summary', '/api/vps', '/api/vps2', '/api/github'];

const SUPERADMIN_ONLY = ['/traceability', '/graph', '/reportes'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Internal API key — bypass auth for server-to-server calls
  if (pathname.startsWith('/api/')) {
    const apiKey = request.headers.get('x-api-key');
    if (apiKey && apiKey === process.env.INTERNAL_API_KEY) {
      return NextResponse.next();
    }
  }

  // Rutas públicas — sin protección
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // Archivos estáticos
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Verificar cookie de sesión de NextAuth
  const sessionToken =
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Rutas exclusivas SUPERADMIN
  const isRestricted = SUPERADMIN_ONLY.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isRestricted) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (token?.role !== 'SUPERADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
