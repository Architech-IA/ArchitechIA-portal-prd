import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidGoogleAccessToken } from '@/lib/googleAuth';
import { syncMicrosoftMessages } from '@/lib/microsoftGraph';

/**
 * Email sync + list API.
 *
 * DEPENDENCIAS DE SCHEMA (Prisma):
 *   model ExternalMessage {
 *     id                String   @id @default(cuid())
 *     userId            String
 *     externalId        String
 *     provider          String   @default("MICROSOFT")
 *     threadId          String?
 *     subject           String?
 *     sender            String?
 *     senderName        String?
 *     recipientsTo      String?
 *     recipientsCc      String?
 *     bodyPreview       String?
 *     bodyHtml          String?  @db.Text
 *     bodyText          String?  @db.Text
 *     receivedAt        DateTime?
 *     sentAt            DateTime?
 *     isRead            Boolean  @default(false)
 *     isDraft           Boolean  @default(false)
 *     importance        String   @default("normal")
 *     conversationId    String?
 *     internetMessageId String?
 *     raw               String?  @db.Text
 *     deletedAt         DateTime?
 *     createdAt         DateTime @default(now())
 *     updatedAt         DateTime @updatedAt
 *
 *     user User @relation(fields: [userId], references: [id], onDelete: Cascade)
 *     @@unique([userId, externalId, provider])
 *     @@index([userId, receivedAt])
 *     @@index([userId, conversationId])
 *   }
 *
 *   model User {
 *     ...existing...
 *     googleLastSyncAt     DateTime?
 *     microsoftLastSyncAt  DateTime?
 *   }
 */

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPartBody {
  data?: string;
  attachmentId?: string;
  size?: number;
}

interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: GmailPartBody;
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailPart;
  internalDate?: string;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryAfter(res: Response): number {
  const retryAfter = res.headers.get('Retry-After');
  if (!retryAfter) return 0;
  const seconds = parseInt(retryAfter, 10);
  return Number.isNaN(seconds) ? 0 : seconds * 1000;
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string | undefined {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function extractAddressList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => {
      const match = s.match(/<([^>]+)>/);
      return (match ? match[1] : s).trim();
    })
    .filter(Boolean);
}

function extractSenderName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : undefined;
}

function extractSenderEmail(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].trim() : raw.trim();
}

function findPart(root: GmailPart | undefined, mimeType: string): GmailPart | undefined {
  if (!root) return undefined;
  if (root.mimeType === mimeType && root.body?.data) return root;
  if (root.parts) {
    for (const part of root.parts) {
      const found = findPart(part, mimeType);
      if (found) return found;
    }
  }
  return undefined;
}

function extractBody(message: GmailMessage, mimeType: 'text/html' | 'text/plain'): string | undefined {
  const part = findPart(message.payload, mimeType);
  if (part?.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  return undefined;
}

function parseGmailDate(dateHeader: string | undefined): Date | null {
  if (!dateHeader) return null;
  const ts = Date.parse(dateHeader);
  return Number.isNaN(ts) ? null : new Date(ts);
}

async function gmailFetch<T>(userId: string, path: string, options?: RequestInit): Promise<{ ok: true; data: T; headers: Headers } | { ok: false; status: number; text: string; retryAfter: number }> {
  const accessToken = await getValidGoogleAccessToken(userId);
  if (!accessToken) {
    return { ok: false, status: 401, text: 'No Google access token', retryAfter: 0 };
  }

  const url = `${GMAIL_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options?.headers || {}),
    },
  });

  if (res.status === 429 || res.status === 503) {
    return { ok: false, status: res.status, text: await res.text(), retryAfter: parseRetryAfter(res) };
  }

  if (!res.ok) {
    return { ok: false, status: res.status, text: await res.text(), retryAfter: 0 };
  }

  return { ok: true, data: (await res.json()) as T, headers: res.headers };
}

function normalizeGmailMessage(userId: string, msg: GmailMessage): {
  externalId: string;
  userId: string;
  provider: 'GOOGLE';
  threadId: string;
  subject: string | null;
  sender: string | null;
  senderName: string | null;
  recipientsTo: string;
  recipientsCc: string;
  bodyPreview: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  receivedAt: Date | null;
  sentAt: Date | null;
  isRead: boolean;
  isDraft: boolean;
  importance: string;
  conversationId: string | null;
  internetMessageId: string | null;
  raw: string;
} {
  const headers = msg.payload?.headers || [];
  const from = getHeader(headers, 'From');
  const toList = extractAddressList(getHeader(headers, 'To'));
  const ccList = extractAddressList(getHeader(headers, 'Cc'));
  const dateHeader = getHeader(headers, 'Date');
  const receivedAt = parseGmailDate(dateHeader);

  return {
    externalId: msg.id,
    userId,
    provider: 'GOOGLE',
    threadId: msg.threadId,
    subject: getHeader(headers, 'Subject') || null,
    sender: extractSenderEmail(from) || null,
    senderName: extractSenderName(from) || null,
    recipientsTo: JSON.stringify(toList),
    recipientsCc: JSON.stringify(ccList),
    bodyPreview: msg.snippet || null,
    bodyHtml: extractBody(msg, 'text/html') || null,
    bodyText: extractBody(msg, 'text/plain') || null,
    receivedAt,
    sentAt: receivedAt,
    isRead: !(msg.labelIds || []).includes('UNREAD'),
    isDraft: (msg.labelIds || []).includes('DRAFT'),
    importance: (msg.labelIds || []).includes('IMPORTANT') ? 'high' : 'normal',
    conversationId: msg.threadId || null,
    internetMessageId: getHeader(headers, 'Message-Id') || null,
    raw: JSON.stringify(msg),
  };
}

async function syncGmailMessages(userId: string, maxMessages = 100): Promise<{
  provider: 'GOOGLE';
  processed: number;
  created: number;
  updated: number;
  errors: number;
  nextPageToken: string | null;
}> {
  const stats = { provider: 'GOOGLE' as const, processed: 0, created: 0, updated: 0, errors: 0, nextPageToken: null as string | null };

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, googleAccessToken: true } as any,
    });

    if (!user || !(user as any).googleAccessToken) {
      return stats;
    }

    let pageToken: string | undefined;
    let fetched = 0;
    const pageSize = Math.min(maxMessages, 100);

    do {
      const params = new URLSearchParams({
        userId: 'me',
        maxResults: String(pageSize),
        labelIds: 'INBOX',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const list = await gmailFetch<GmailListResponse>(userId, `/users/me/messages?${params.toString()}`);
      if (!list.ok) {
        if (list.retryAfter > 0) await sleep(list.retryAfter);
        stats.errors += 1;
        break;
      }

      const messages = list.data.messages || [];
      for (const meta of messages) {
        const detail = await gmailFetch<GmailMessage>(userId, `/users/me/messages/${meta.id}?format=full`);
        if (!detail.ok) {
          if (detail.retryAfter > 0) await sleep(detail.retryAfter);
          stats.errors += 1;
          continue;
        }

        const normalized = normalizeGmailMessage(userId, detail.data);

        await (prisma as any).externalMessage.upsert({
          where: {
            userId_externalId_provider: {
              userId,
              externalId: normalized.externalId,
              provider: normalized.provider,
            },
          },
          update: {
            threadId: normalized.threadId,
            subject: normalized.subject,
            sender: normalized.sender,
            senderName: normalized.senderName,
            recipientsTo: normalized.recipientsTo,
            recipientsCc: normalized.recipientsCc,
            bodyPreview: normalized.bodyPreview,
            bodyHtml: normalized.bodyHtml,
            bodyText: normalized.bodyText,
            receivedAt: normalized.receivedAt,
            sentAt: normalized.sentAt,
            isRead: normalized.isRead,
            isDraft: normalized.isDraft,
            importance: normalized.importance,
            conversationId: normalized.conversationId,
            internetMessageId: normalized.internetMessageId,
            raw: normalized.raw,
            deletedAt: null,
          },
          create: normalized,
        });

        const existing = await (prisma as any).externalMessage.findUnique({
          where: {
            userId_externalId_provider: {
              userId,
              externalId: normalized.externalId,
              provider: normalized.provider,
            },
          },
          select: { id: true },
        });

        if (existing) {
          stats.updated += 1;
        } else {
          stats.created += 1;
        }

        stats.processed += 1;
        fetched += 1;
      }

      pageToken = list.data.nextPageToken;
      if (fetched >= maxMessages) break;
    } while (pageToken);

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { googleLastSyncAt: new Date() } as any,
      });
    } catch {
      // Campo opcional; ignorar si no existe en schema.
    }
  } catch (error) {
    console.error('syncGmailMessages error:', error);
    stats.errors += 1;
  }

  return stats;
}

// ------------------------------------------------------------------
// POST /api/emails  -> sincroniza Gmail y Microsoft
// ------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  let body: { maxMessagesPerProvider?: number } = {};
  try {
    body = await request.json();
  } catch {
    // body vacío es válido
  }

  const maxMessages = Math.min(Math.max(Number(body.maxMessagesPerProvider) || 100, 1), 500);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      googleAccessToken: true,
      microsoftAccessToken: true,
    } as any,
  });

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const hasGoogle = !!(user as any).googleAccessToken;
  const hasMicrosoft = !!(user as any).microsoftAccessToken;

  if (!hasGoogle && !hasMicrosoft) {
    return NextResponse.json(
      { error: 'No hay cuentas de correo conectadas. Conecta Gmail o Microsoft primero.' },
      { status: 400 }
    );
  }

  const results: Record<string, unknown> = {};

  if (hasGoogle) {
    results.google = await syncGmailMessages(userId, maxMessages);
  }

  if (hasMicrosoft) {
    try {
      const msStats = await syncMicrosoftMessages(userId, Math.ceil(maxMessages / 50));
      results.microsoft = msStats;
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { microsoftLastSyncAt: new Date() } as any,
        });
      } catch {
        // Campo opcional.
      }
    } catch (error) {
      console.error('Microsoft sync error:', error);
      results.microsoft = { error: (error as Error).message };
    }
  }

  return NextResponse.json({
    success: true,
    userId,
    maxMessagesPerProvider: maxMessages,
    results,
  });
}

// ------------------------------------------------------------------
// GET /api/emails -> lista paginada de correos sincronizados
// ------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const cursor = searchParams.get('cursor');
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '25'), 1), 100);

  const where: any = {
    userId,
    deletedAt: null,
  };

  if (provider && provider !== 'ALL') {
    where.provider = provider.toUpperCase();
  }

  if (status === 'UNREAD') {
    where.isRead = false;
  } else if (status === 'READ') {
    where.isRead = true;
  }

  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { sender: { contains: search, mode: 'insensitive' } },
      { bodyPreview: { contains: search, mode: 'insensitive' } },
    ];
  }

  const messages = await (prisma as any).externalMessage.findMany({
    where,
    take: limit + 1,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { receivedAt: 'desc' },
    select: {
      id: true,
      externalId: true,
      provider: true,
      threadId: true,
      subject: true,
      sender: true,
      senderName: true,
      recipientsTo: true,
      recipientsCc: true,
      bodyPreview: true,
      receivedAt: true,
      sentAt: true,
      isRead: true,
      isDraft: true,
      importance: true,
      conversationId: true,
      internetMessageId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hasMore = messages.length > limit;
  const trimmed = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id : null;

  const parsed = trimmed.map((m: any) => ({
    ...m,
    recipientsTo: safeJsonParse(m.recipientsTo, []),
    recipientsCc: safeJsonParse(m.recipientsCc, []),
  }));

  return NextResponse.json({
    messages: parsed,
    pagination: {
      nextCursor,
      hasMore,
      limit,
    },
  });
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
