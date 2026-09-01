import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { authOptions } from '@/lib/auth';
import { getMicrosoftAuthUrl } from '@/lib/microsoftAuth';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const state = crypto.randomBytes(32).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('microsoft_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 minutos
  });

  const authUrl = await getMicrosoftAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
