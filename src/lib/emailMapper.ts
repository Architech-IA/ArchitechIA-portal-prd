/**
 * Mapeo entre el dominio del inbox (`InboxMessage`) y el modelo cifrado de BD.
 *
 * Reglas de privacidad aplicadas aquí:
 * - Cualquier campo identificable o legible por humanos se cifra antes de persistir.
 * - Metadatos técnicos (ids de proveedor, fechas, flags) permanecen en claro para
 *   permitir búsquedas, filtros e índices sin exponer contenido.
 */

import {
  InboxMessage,
  InboxProvider,
  InboxThreadMessage,
} from '@/lib/inbox';
import {
  decryptEmailField,
  decryptJson,
  encryptEmailField,
  encryptJson,
} from '@/lib/emailCrypto';

export interface EncryptedSender {
  name: string;
  email: string;
}

export interface EncryptedRecipient {
  name?: string;
  email: string;
}

export interface EncryptedAttachment {
  name: string;
  contentType: string;
  size?: number;
  contentId?: string;
}

export interface ExternalMessageCreateInput {
  userId: string;
  accountId: string;
  provider: InboxProvider;
  externalId: string;
  threadId: string;
  conversationIndex?: string | null;
  receivedAt: Date;
  isRead: boolean;
  isImportant: boolean;
  isDraft?: boolean;
  hasAttachments: boolean;
  labelsJson: string;
  categoriesJson: string;
  senderCipher: string;
  recipientsCipher: string;
  subjectCipher: string;
  bodyPreviewCipher: string;
  bodyHtmlCipher: string;
  bodyTextCipher?: string | null;
  headersCipher?: string | null;
  attachmentsCipher?: string | null;
  rawPayloadCipher?: string | null;
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Convierte un `InboxMessage` (dominio) en un objeto listo para Prisma,
 * cifrando todos los campos PII/contenido.
 */
export function inboxMessageToCreateInput(
  msg: InboxMessage,
  userId: string,
  accountId: string
): ExternalMessageCreateInput {
  const recipients: EncryptedRecipient[] = msg.recipientEmails.map((email) => ({ email }));

  return {
    userId,
    accountId,
    provider: msg.provider,
    externalId: msg.externalId,
    threadId: msg.threadId,
    receivedAt: new Date(msg.receivedAt),
    isRead: msg.isRead,
    isImportant: msg.isImportant,
    isDraft: false,
    hasAttachments: msg.hasAttachments,
    labelsJson: JSON.stringify(msg.categories || []),
    categoriesJson: JSON.stringify(msg.categories || []),
    senderCipher: encryptJson<EncryptedSender>({
      name: msg.senderName,
      email: msg.senderEmail,
    }),
    recipientsCipher: encryptJson<EncryptedRecipient[]>(recipients),
    subjectCipher: encryptEmailField(msg.subject),
    bodyPreviewCipher: encryptEmailField(msg.bodyPreview),
    bodyHtmlCipher: encryptEmailField(msg.bodyHtml),
    attachmentsCipher: msg.hasAttachments
      ? encryptJson<EncryptedAttachment[]>([]) // el pipeline de sync debe poblarlo
      : encryptJson<EncryptedAttachment[]>([]),
  };
}

/**
 * Descifra un registro de BD y lo devuelve como `InboxMessage`.
 * La conversación se deja vacía; debe cargarse mediante `getThreadMessages`.
 */
export function dbRecordToInboxMessage(record: Record<string, unknown>): InboxMessage {
  const sender = decryptJson<EncryptedSender>(String(record.senderCipher));
  const recipients = decryptJson<EncryptedRecipient[]>(String(record.recipientsCipher));

  return {
    id: String(record.id),
    externalId: String(record.externalId),
    provider: String(record.provider) as InboxProvider,
    threadId: String(record.threadId),
    senderName: sender.name,
    senderEmail: sender.email,
    recipientEmails: recipients.map((r) => r.email),
    subject: decryptEmailField(String(record.subjectCipher)),
    bodyPreview: decryptEmailField(String(record.bodyPreviewCipher)),
    bodyHtml: decryptEmailField(String(record.bodyHtmlCipher)),
    receivedAt: (record.receivedAt as Date).toISOString(),
    isRead: Boolean(record.isRead),
    isImportant: Boolean(record.isImportant),
    categories: safeJsonParse(String(record.categoriesJson), []),
    hasAttachments: Boolean(record.hasAttachments),
    conversation: [],
  };
}

/**
 * Utilidad para descifrar un mensaje de hilo (versión reducida sin metadatos).
 */
export function dbRecordToThreadMessage(record: Record<string, unknown>): InboxThreadMessage {
  const sender = decryptJson<EncryptedSender>(String(record.senderCipher));
  return {
    id: String(record.id),
    senderName: sender.name,
    senderEmail: sender.email,
    bodyHtml: decryptEmailField(String(record.bodyHtmlCipher)),
    receivedAt: (record.receivedAt as Date).toISOString(),
  };
}
