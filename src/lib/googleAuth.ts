import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Cliente OAuth2 para Google (Gmail + Calendar).
 *
 * Variables de entorno esperadas:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REDIRECT_URI     (ej. https://tu-dominio.com/api/auth/google/callback)
 * - GOOGLE_TOKEN_ENCRYPTION_KEY (se hashea a 32 bytes para AES-256-GCM)
 *
 * Campos de Prisma esperados en User:
 * - googleAccessToken
 * - googleRefreshToken
 * - googleTokenExpiry
 */

const ALGORITHM = 'aes-256-gcm';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

function getEncryptionKey(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY no está configurada');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptGoogleToken(plainText: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptGoogleToken(cipherText: string): string {
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    // Fallback para tokens almacenados en texto plano (migración controlada).
    return cipherText;
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
  token_type: string;
  scope: string;
}

function parseJwt<T>(token: string): T {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(base64, 'base64').toString('utf8');
  return JSON.parse(json) as T;
}

function extractEmailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const claims = parseJwt<{ email?: string }>(idToken);
    return claims.email || null;
  } catch {
    return null;
  }
}

/**
 * Genera la URL de autorización de Google.
 */
export function getGoogleAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });
  if (state) params.set('state', state);
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Intercambia el código de autorización por tokens.
 */
export async function exchangeGoogleCode(code: string) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    grant_type: 'authorization_code',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as GoogleTokenResponse;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
    email: extractEmailFromIdToken(data.id_token),
    scopes: data.scope?.split(' ') ?? [],
  };
}

/**
 * Refresca el access token a partir de un refresh token.
 */
export async function refreshGoogleToken(refreshToken: string) {
  const plainRefreshToken = decryptGoogleToken(refreshToken);

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: plainRefreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google refresh token failed: ${res.status} ${text}`);
  }

  return (await res.json()) as GoogleTokenResponse;
}

/**
 * Devuelve un access token válido para el usuario, refrescándolo si es necesario.
 * Persiste el nuevo token en la base de datos.
 */
export async function getValidGoogleAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
    },
  });

  if (!user?.googleAccessToken) return null;

  const now = new Date();
  const stillValid =
    user.googleTokenExpiry && new Date(user.googleTokenExpiry) > new Date(now.getTime() + 60_000);

  if (stillValid) {
    return decryptGoogleToken(user.googleAccessToken);
  }

  if (!user.googleRefreshToken) return null;

  try {
    const refreshed = await refreshGoogleToken(user.googleRefreshToken);
    const encryptedAccess = encryptGoogleToken(refreshed.access_token);
    const expiry = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: encryptedAccess,
        googleTokenExpiry: expiry,
      },
    });

    return refreshed.access_token;
  } catch (error) {
    console.error('Google token refresh error:', error);
    return null;
  }
}

interface GmailApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

interface GmailApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

/**
 * Cliente ligero para la Gmail API.
 * `endpoint` debe comenzar con `/users/me/...`.
 */
export async function callGmailApi<T = unknown>(
  userId: string,
  endpoint: string,
  options: GmailApiOptions = {}
): Promise<GmailApiResult<T>> {
  let accessToken = await getValidGoogleAccessToken(userId);
  if (!accessToken) {
    return { ok: false, status: 401, data: null, error: 'No Google access token' };
  }

  const url = `${GMAIL_API_BASE}${endpoint}`;
  const fetchOptions: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };
  if (options.body) fetchOptions.body = JSON.stringify(options.body);

  let res = await fetch(url, fetchOptions);

  // Reintento automático con token refrescado ante 401.
  if (res.status === 401) {
    accessToken = await getValidGoogleAccessToken(userId);
    if (!accessToken) {
      return { ok: false, status: 401, data: null, error: 'Token inválido' };
    }
    fetchOptions.headers = {
      ...(fetchOptions.headers as Record<string, string>),
      Authorization: `Bearer ${accessToken}`,
    };
    res = await fetch(url, fetchOptions);
  }

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, data: null, error: text };
  }

  const data = (await res.json()) as T;
  return { ok: true, status: res.status, data };
}
