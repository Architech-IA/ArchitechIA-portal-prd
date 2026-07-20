import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

async function logSession(userId: string | null, email: string | null, action: string, success: boolean, details?: string) {
  try {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      || headersList.get('x-real-ip')
      || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    await prisma.sessionLog.create({
      data: { userId, email, action, ip, userAgent, success, details },
    });
  } catch (e) {
    console.error('SessionLog error:', e);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',       type: 'email'    },
        password: { label: 'Contraseña',  type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          await logSession(null, credentials?.email || null, 'FAILED_LOGIN', false, 'Usuario no encontrado');
          return null;
        }

        const passwordOk = await compare(credentials.password, user.password);
        if (!passwordOk) {
          await logSession(user.id, user.email, 'FAILED_LOGIN', false, 'Contraseña incorrecta');
          return null;
        }

        return {
          id:     user.id,
          name:   user.name,
          email:  user.email,
          role:   user.role,
          avatar: user.avatar,
          googleConnected: !!(user.googleAccessToken),
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, credentials }) {
      if (account?.provider === 'google' && account.access_token) {
        const email = user.email!;
        const existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser) {
          await prisma.user.update({
            where: { email },
            data: {
              googleAccessToken: account.access_token,
              googleRefreshToken: account.refresh_token,
              googleTokenExpiry: account.expires_at ? new Date(account.expires_at * 1000) : null,
            },
          });
        } else {
          const hashedPassword = await (await import('bcryptjs')).hash(Math.random().toString(36).slice(2) + Date.now().toString(36), 12);
          await prisma.user.create({
            data: {
              name: user.name || email.split('@')[0],
              email,
              password: hashedPassword,
              role: 'PARTNER',
              avatar: (user as { image?: string }).image || null,
              googleAccessToken: account.access_token,
              googleRefreshToken: account.refresh_token,
              googleTokenExpiry: account.expires_at ? new Date(account.expires_at * 1000) : null,
            },
          });
        }
      }

      if (user?.id) {
        await logSession(user.id, credentials?.email as string || user.email || '', 'LOGIN', true);
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id   = user.id;
        token.role = (user as unknown as { role: string }).role;
        token.avatar = (user as unknown as { avatar: string | null }).avatar;
        token.googleConnected = (user as unknown as { googleConnected: boolean }).googleConnected;
      }
      if (account?.provider === 'google') {
        token.googleAccessToken = account.access_token;
        token.googleRefreshToken = account.refresh_token;
        token.googleTokenExpiry = account.expires_at;
        token.googleConnected = true;
      }
      // Google OAuth no incluye role/avatar en el objeto user — buscar en DB si falta
      if (!token.role && token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email as string },
            select: { id: true, role: true, avatar: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.id = dbUser.id;
            if (!token.avatar) token.avatar = dbUser.avatar;
          }
        } catch (e) {
          console.error('JWT role fetch error:', e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string; role: string; avatar: string | null; googleConnected: boolean }).id   = token.id as string;
        (session.user as { id: string; role: string; avatar: string | null; googleConnected: boolean }).role = token.role as string;
        (session.user as { id: string; role: string; avatar: string | null; googleConnected: boolean }).avatar = token.avatar as string | null;
        (session.user as { id: string; role: string; avatar: string | null; googleConnected: boolean }).googleConnected = !!(token.googleConnected as boolean);
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      try {
        await prisma.sessionLog.create({
          data: {
            userId: (token.id as string) || null,
            email: (token.email as string) || null,
            action: 'LOGOUT',
            ip: 'unknown',
            userAgent: 'unknown',
            success: true,
          },
        });
      } catch (e) {
        console.error('SessionLog signOut error:', e);
      }
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function verifyInternalApiKey(request: Request): boolean {
  const key = request.headers.get('x-api-key');
  return !!key && key === process.env.INTERNAL_API_KEY;
}
