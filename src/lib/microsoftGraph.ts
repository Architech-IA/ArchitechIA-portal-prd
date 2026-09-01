/**
 * Microsoft Graph incremental email sync client.
 *
 * Required schema additions (Prisma):
 *  model User {
 *    ...existing fields...
 *    microsoftAccessToken  String?
 *    microsoftRefreshToken String?
 *    microsoftTokenExpiry  DateTime?
 *    microsoftDeltaLink    String?   // stored deltaLink for incremental sync
 *    microsoftLastSyncAt   DateTime?
 *  }
 *
 *  model ExternalMessage {
 *    id              String   @id @default(cuid())
 *    userId          String
 *    externalId      String   // Microsoft Graph message id
 *    provider        String   @default("MICROSOFT")
 *    subject         String?
 *    sender          String?
 *    recipientsTo    String?  // JSON array
 *    recipientsCc    String?  // JSON array
 *    bodyPreview     String?
 *    bodyHtml        String?  @db.Text
 *    receivedAt      DateTime?
 *    sentAt          DateTime?
 *    isRead          Boolean  @default(false)
 *    isDraft         Boolean  @default(false)
 *    importance      String   @default("normal")
 *    conversationId  String?
 *    internetMessageId String?
 *    raw             String?  @db.Text
 *    deletedAt       DateTime?
 *    createdAt       DateTime @default(now())
 *    updatedAt       DateTime @updatedAt
 *
 *    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
 *    @@unique([userId, externalId, provider])
 *    @@index([userId, receivedAt])
 *    @@index([userId, conversationId])
 *  }
 */

import { prisma } from '@/lib/prisma';

const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MICROSOFT_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export interface MicrosoftMessage {
  id: string;
  subject?: string | null;
  sender?: {
    emailAddress?: { address?: string | null; name?: string | null } | null;
  } | null;
  toRecipients?: Array<{
    emailAddress?: { address?: string | null; name?: string | null } | null;
  }> | null;
  ccRecipients?: Array<{
    emailAddress?: { address?: string | null; name?: string | null } | null;
  }> | null;
  bodyPreview?: string | null;
  body?: { contentType?: string; content?: string | null } | null;
  receivedDateTime?: string | null;
  sentDateTime?: string | null;
  isRead?: boolean;
  isDraft?: boolean;
  importance?: string | null;
  conversationId?: string | null;
  internetMessageId?: string | null;
  '@odata.deltaLink'?: string | null;
  '@odata.nextLink'?: string | null;
  '@removed'?: { reason?: string } | null;
}

export interface MicrosoftDeltaResponse {
  value: MicrosoftMessage[];
  '@odata.deltaLink'?: string | null;
  '@odata.nextLink'?: string | null;
}

export interface SyncStats {
  processed: number;
  created: number;
  updated: number;
  deleted: number;
  errors: number;
  rateLimitHits: number;
  nextDeltaLink: string | null;
}

interface GraphFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
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

/**
 * Refresh the Microsoft access token using the stored refresh token.
 */
export async function refreshMicrosoftToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      microsoftRefreshToken: true,
    } as any,
  });

  if (!user || !(user as any).microsoftRefreshToken) return null;

  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    refresh_token: (user as any).microsoftRefreshToken,
    grant_type: 'refresh_token',
    scope: 'Mail.Read offline_access User.Read openid email profile',
  });

  const res = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[microsoftGraph] token refresh failed for ${userId}:`, text);
    return null;
  }

  const data = await res.json();
  const accessToken = data.access_token as string;
  const refreshToken = (data.refresh_token as string | undefined) || (user as any).microsoftRefreshToken;
  const expiresAt = data.expires_in
    ? new Date(Date.now() + (data.expires_in as number) * 1000)
    : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      microsoftAccessToken: accessToken,
      microsoftRefreshToken: refreshToken,
      microsoftTokenExpiry: expiresAt,
    } as any,
  });

  return accessToken;
}

/**
 * Return a valid access token, refreshing it when close to expiry.
 */
export async function getValidMicrosoftToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      microsoftAccessToken: true,
      microsoftTokenExpiry: true,
    } as any,
  });

  if (!user) return null;

  const accessToken = (user as any).microsoftAccessToken;
  const tokenExpiry = (user as any).microsoftTokenExpiry;

  if (!accessToken) return null;

  // Refresh if expired or expiring in the next 5 minutes.
  const needsRefresh = !tokenExpiry || new Date(tokenExpiry.getTime() - 5 * 60 * 1000) <= new Date();
  if (needsRefresh) {
    return refreshMicrosoftToken(userId);
  }

  return accessToken;
}

/**
 * Graph fetch wrapper with exponential backoff for 429/503 and transient errors.
 *
 * Microsoft Graph rate-limit guidance:
 *  - Honor Retry-After when present.
 *  - Use exponential backoff with jitter.
 *  - Max ~4 retries by default to avoid runaway loops.
 */
async function graphFetch<T>(
  url: string,
  accessToken: string,
  options: GraphFetchOptions = {},
): Promise<{ ok: true; data: T; res: Response } | { ok: false; res: Response; text: string }> {
  const { method = 'GET', body, headers = {} } = options;

  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'outlook.body-content-type="html"',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.ok) {
      const data = (await res.json()) as T;
      return { ok: true, data, res };
    }

    const text = await res.text();

    // Rate limit or server busy: retry with backoff.
    if (res.status === 429 || res.status === 503 || res.status >= 500) {
      const retryAfterMs = parseRetryAfter(res);
      const baseDelay = Math.min(1000 * 2 ** attempt, 32000);
      const jitter = Math.floor(Math.random() * 1000);
      const delay = retryAfterMs > 0 ? retryAfterMs + jitter : baseDelay + jitter;

      console.warn(
        `[microsoftGraph] ${res.status} on ${url} (attempt ${attempt + 1}/${maxAttempts}), sleeping ${delay}ms`,
        text.slice(0, 200),
      );

      await sleep(delay);
      attempt++;
      continue;
    }

    // Non-retryable error.
    return { ok: false, res, text };
  }

  // Exceeded retries: return last attempt metadata.
  return {
    ok: false,
    res: new Response('Max retries exceeded', { status: 503 }),
    text: 'Max retries exceeded',
  };
}

function extractAddresses(
  recipients: Array<{ emailAddress?: { address?: string | null; name?: string | null } | null }> | null | undefined,
): string[] {
  if (!recipients) return [];
  return recipients
    .map(r => r?.emailAddress?.address)
    .filter((a): a is string => typeof a === 'string' && a.length > 0);
}

/**
 * Persist a single message. Uses upsert by (userId, externalId, provider).
 * If the message was removed by Graph delta, soft-delete it.
 */
async function persistMessage(
  userId: string,
  msg: MicrosoftMessage,
  stats: SyncStats,
): Promise<void> {
  try {
    const externalId = msg.id;
    const isRemoved = !!msg['@removed'];

    if (isRemoved) {
      await (prisma as any).externalMessage.updateMany({
        where: { userId, externalId, provider: 'MICROSOFT' },
        data: { deletedAt: new Date() } as any,
      });
      stats.deleted++;
      return;
    }

    const subject = msg.subject || '(sin asunto)';
    const sender = msg.sender?.emailAddress?.address || null;
    const recipientsTo = extractAddresses(msg.toRecipients);
    const recipientsCc = extractAddresses(msg.ccRecipients);
    const bodyHtml = msg.body?.contentType === 'html' ? msg.body.content : null;

    const payload = {
      userId,
      externalId,
      provider: 'MICROSOFT',
      subject,
      sender,
      recipientsTo: recipientsTo.length ? JSON.stringify(recipientsTo) : null,
      recipientsCc: recipientsCc.length ? JSON.stringify(recipientsCc) : null,
      bodyPreview: msg.bodyPreview || null,
      bodyHtml,
      receivedAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : null,
      sentAt: msg.sentDateTime ? new Date(msg.sentDateTime) : null,
      isRead: msg.isRead ?? false,
      isDraft: msg.isDraft ?? false,
      importance: msg.importance || 'normal',
      conversationId: msg.conversationId || null,
      internetMessageId: msg.internetMessageId || null,
      raw: JSON.stringify(msg),
      deletedAt: null,
    };

    await (prisma as any).externalMessage.upsert({
      where: {
        userId_externalId_provider: {
          userId,
          externalId,
          provider: 'MICROSOFT',
        },
      },
      create: payload,
      update: payload,
    });

    stats.created++;
  } catch (e) {
    console.error(`[microsoftGraph] failed to persist message ${msg.id} for ${userId}:`, e);
    stats.errors++;
  }
}

/**
 * Perform one incremental sync page.
 *
 * @param userId               User to sync.
 * @param accessToken          Valid Microsoft access token.
 * @param deltaLink            Previous deltaLink or null for initial sync.
 * @param stats                Accumulated stats object.
 * @param maxPages             Safety cap to avoid runaway syncs (default 50).
 */
async function syncOnePage(
  userId: string,
  accessToken: string,
  deltaLink: string | null,
  stats: SyncStats,
  maxPages: number,
): Promise<string | null> {
  const url =
    deltaLink ||
    `${MICROSOFT_GRAPH_BASE}/me/messages/delta?$select=id,subject,sender,toRecipients,ccRecipients,bodyPreview,body,receivedDateTime,sentDateTime,isRead,isDraft,importance,conversationId,internetMessageId&$top=50`;

  const result = await graphFetch<MicrosoftDeltaResponse>(url, accessToken);

  if (!result.ok) {
    if (result.res.status === 429) stats.rateLimitHits++;
    throw new Error(`Graph delta request failed: ${result.res.status} ${result.text}`);
  }

  const data = result.data;

  for (const msg of data.value || []) {
    stats.processed++;
    await persistMessage(userId, msg, stats);
  }

  if (data['@odata.deltaLink']) {
    return data['@odata.deltaLink'];
  }

  if (data['@odata.nextLink'] && maxPages > 1) {
    return syncOnePage(userId, accessToken, data['@odata.nextLink'], stats, maxPages - 1);
  }

  return null;
}

/**
 * Run incremental sync for a single user.
 *
 * @param userId   Target user.
 * @param maxPages Maximum delta pages to consume per run.
 */
export async function syncMicrosoftMessages(
  userId: string,
  maxPages = 50,
): Promise<SyncStats> {
  const stats: SyncStats = {
    processed: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: 0,
    rateLimitHits: 0,
    nextDeltaLink: null,
  };

  const accessToken = await getValidMicrosoftToken(userId);
  if (!accessToken) {
    throw new Error(`No valid Microsoft token for user ${userId}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, microsoftDeltaLink: true } as any,
  });

  const previousDeltaLink = (user as any)?.microsoftDeltaLink || null;

  try {
    const nextDeltaLink = await syncOnePage(userId, accessToken, previousDeltaLink, stats, maxPages);
    stats.nextDeltaLink = nextDeltaLink;

    // Always persist the latest delta link so the next run resumes incrementally.
    if (nextDeltaLink) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          microsoftDeltaLink: nextDeltaLink,
          microsoftLastSyncAt: new Date(),
        } as any,
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { microsoftLastSyncAt: new Date() } as any,
      });
    }
  } catch (e) {
    console.error(`[microsoftGraph] sync failed for ${userId}:`, e);
    throw e;
  }

  return stats;
}

/**
 * Run incremental sync for all users connected to Microsoft 365.
 *
 * Returns per-user results and a global summary. Failures for one user do
 * not abort the batch.
 */
export async function syncAllMicrosoftUsers(
  maxPages = 50,
): Promise<{ results: Array<{ userId: string; ok: boolean; stats?: SyncStats; error?: string }>; summary: SyncStats }> {
  const users = await prisma.user.findMany({
    where: { microsoftAccessToken: { not: null } } as any,
    select: { id: true },
  });

  const results: Array<{ userId: string; ok: boolean; stats?: SyncStats; error?: string }> = [];
  const summary: SyncStats = {
    processed: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: 0,
    rateLimitHits: 0,
    nextDeltaLink: null,
  };

  for (const user of users) {
    try {
      const stats = await syncMicrosoftMessages(user.id, maxPages);
      results.push({ userId: user.id, ok: true, stats });
      summary.processed += stats.processed;
      summary.created += stats.created;
      summary.updated += stats.updated;
      summary.deleted += stats.deleted;
      summary.errors += stats.errors;
      summary.rateLimitHits += stats.rateLimitHits;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ userId: user.id, ok: false, error: message });
      summary.errors++;
    }
  }

  return { results, summary };
}
