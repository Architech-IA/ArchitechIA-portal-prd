import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      microsoftAccessToken: null,
      microsoftRefreshToken: null,
      microsoftTokenExpiry: null,
      microsoftAccountEmail: null,
    },
  });

  return NextResponse.json({ success: true });
}
