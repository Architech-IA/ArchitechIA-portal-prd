import crypto from 'crypto';
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import { prisma } from '@/lib/prisma';

/**
 * Variables de entorno esperadas:
 * - MICROSOFT_CLIENT_ID
 * - MICROSOFT_CLIENT_SECRET
 * - MICROSOFT_REDIRECT_URI  (ej. https://tu-dominio.com/api/auth/microsoft/callback)
 * - MICROSOFT_TOKEN_ENCRYPTION_KEY (se hashea a 32 bytes para AES-256-GCM)
 */

const ALGORITHM = 'aes-256-gcm';
const AUTHORITY = 'https://login.microsoftonline.com/common';
const TOKEN_ENDPOINT = `${AUTHORITY}/oauth2/v2.0/token`;
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

export const MICROSOFT_SCOPES = [
  'openid',
  'email',
  'profile',
  'offline_access',
  'Mail.Read',
  'Calendars.Read',
  'User.Read',
];

const msalConfig: Configuration = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    authority: AUTHORITY,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  },
};

export const msalClient = new ConfidentialClientApplication(msalConfig);

function getEncryptionKey(): Buffer {
  const raw = process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('MICROSOFT_TOKEN_ENCRYPTION_KEY no está configurada');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptToken(plainText: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(cipherText: string): string {
  const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Token de Microsoft con formato inválido');
  }
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

interface MicrosoftTokenResponse {
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
    const claims = parseJwt<{
      preferred_username?: string;
      email?: string;
      upn?: string;
    }>(idToken);
    return claims.preferred_username || claims.email || claims.upn || null;
  } catch {
    return null;
  }
}

/**
 * Genera la URL de autorización de Microsoft usando MSAL.
 * Se recomienda enviar un `state` criptográfico para prevenir CSRF.
 */
export async function getMicrosoftAuthUrl(state?: string): Promise<string> {
  return msalClient.getAuthCodeUrl({
    scopes: MICROSOFT_SCOPES,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
    state,
    prompt: 'consent',
  });
}

/**
 * Intercambia el código de autorización por tokens.
 * MSAL no expone el refresh_token en AuthenticationResult, por lo que usamos
 * directamente el endpoint de token de Microsoft (respuesta cruda) y persistimos
 * el refresh_token nosotros mismos, siguiendo el mismo patrón de Google.
 */
export async function exchangeMicrosoftCode(code: string) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    grant_type: 'authorization_code',
    scope: MICROSOFT_SCOPES.join(' '),
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as MicrosoftTokenResponse;

  if (!data.access_token) {
    throw new Error('Microsoft no devolvió access_token');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    email: extractEmailFromIdToken(data.id_token),
  };
}

/**
 * Refresca el access_token usando el refresh_token almacenado.
 * Microsoft puede devolver un nuevo refresh_token; si no lo hace, conservamos
 * el anterior en el llamador.
 */
export async function refreshMicrosoftToken(refreshToken: string) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: MICROSOFT_SCOPES.join(' '),
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token refresh failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as MicrosoftTokenResponse;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Obtiene un access_token válido para el usuario.
 * - Si el token almacenado aún no vence, lo descifra y lo devuelve.
 * - Si venció o falta, usa el refresh_token para renovarlo y persiste el resultado.
 *
 * Los tokens se almacenan cifrados en los campos:
 *   microsoftAccessToken, microsoftRefreshToken, microsoftTokenExpiry, microsoftAccountEmail
 */
export async function getValidMicrosoftAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user?.microsoftAccessToken || !user.microsoftRefreshToken) {
    return null;
  }

  try {
    const accessToken = decryptToken(user.microsoftAccessToken);

    if (user.microsoftTokenExpiry && new Date() < user.microsoftTokenExpiry) {
      return accessToken;
    }
  } catch {
    // Si falla el descifrado, continuamos al refresh para reemplazar el token.
  }

  try {
    const refreshToken = decryptToken(user.microsoftRefreshToken);
    const refreshed = await refreshMicrosoftToken(refreshToken);

    await prisma.user.update({
      where: { id: userId },
      data: {
        microsoftAccessToken: encryptToken(refreshed.accessToken),
        microsoftRefreshToken: refreshed.refreshToken
          ? encryptToken(refreshed.refreshToken)
          : user.microsoftRefreshToken,
        microsoftTokenExpiry: refreshed.expiresAt,
      },
    });

    return refreshed.accessToken;
  } catch (e) {
    console.error('Error refrescando token de Microsoft:', e);
    return null;
  }
}

/**
 * Helper genérico para llamar a Microsoft Graph.
 * El endpoint puede ser una ruta relativa (se prefija /v1.0) o una URL completa.
 * Devuelve null si no hay token válido.
 */
export async function callMicrosoftGraph(
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response | null> {
  const accessToken = await getValidMicrosoftAccessToken(userId);
  if (!accessToken) return null;

  const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_BASE_URL}${endpoint}`;

  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}
