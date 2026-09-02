import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exchangeMicrosoftCode, encryptToken } from '@/lib/microsoftAuth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.redirect(
      new URL('/login?error=microsoft_unauthorized', request.url)
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('microsoft_oauth_state')?.value;
  cookieStore.delete('microsoft_oauth_state');

  if (oauthError) {
    return NextResponse.redirect(
      new URL(
        `/profile?microsoft=error&message=${encodeURIComponent(
          errorDescription || oauthError
        )}`,
        request.url
      )
    );
  }

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      new URL('/profile?microsoft=error&message=invalid_state', request.url)
    );
  }

  try {
    const tokens = await exchangeMicrosoftCode(code);

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { microsoftRefreshToken: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        microsoftAccessToken: encryptToken(tokens.accessToken),
        microsoftRefreshToken: tokens.refreshToken
          ? encryptToken(tokens.refreshToken)
          : existing?.microsoftRefreshToken ?? null,
        microsoftTokenExpiry: tokens.expiresAt,
        microsoftAccountEmail: tokens.email,
      },
    });

    return NextResponse.redirect(
      new URL('/profile?microsoft=connected', request.url)
    );
  } catch (error) {
    console.error('Microsoft OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/profile?microsoft=error&message=token_exchange_failed', request.url)
    );
  }
}
