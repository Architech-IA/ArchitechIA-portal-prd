import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import PortalLayoutClient from './PortalLayoutClient';
import { PageTitleProvider } from '@/lib/pageTitleContext';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();

  const token = await getToken({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    req: { cookies: cookieStore } as any,
    secret: process.env.NEXTAUTH_SECRET!,
    secureCookie: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,
  });

  let role = (token?.role as string) ?? '';

  // Si el JWT no tiene role (sesión antigua), buscarlo en la DB
  if (!role && token?.email) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { email: token.email as string },
        select: { role: true },
      });
      role = (dbUser?.role as string) ?? '';
    } catch { /* continuar sin role */ }
  }

  const isSuperAdmin = role === 'SUPERADMIN';

  // Leído en el servidor (no en localStorage) para que la primera pintura ya
  // venga con el ancho correcto — antes el sidebar siempre arrancaba
  // expandido y recién un useEffect lo colapsaba, causando un parpadeo
  // visible en cada navegación/recarga.
  const initialCollapsed = cookieStore.get('sidebar-collapsed')?.value === 'true';

  return (
    <PageTitleProvider>
      <PortalLayoutClient isSuperAdmin={isSuperAdmin} initialCollapsed={initialCollapsed}>
        {children}
      </PortalLayoutClient>
    </PageTitleProvider>
  );
}
