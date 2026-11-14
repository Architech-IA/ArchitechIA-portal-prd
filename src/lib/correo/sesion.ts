import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { hasAdminAccess } from '@/lib/roles';

export interface SesionCorreo {
  userId: string;
  admin: boolean;
}

export async function sesionCorreo(req: NextRequest): Promise<SesionCorreo | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return null;
  return { userId: token.sub, admin: hasAdminAccess(token.role as string | undefined) };
}
