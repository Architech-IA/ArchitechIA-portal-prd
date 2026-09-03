/**
 * Tipos de dominio del Executive AI Inbox & Hub (EAIH).
 *
 * Diseñados para ser agnósticos a la capa de UI y a la fuente de datos.
 * Cuando se active la sincronización real (Gmail / Outlook), estos tipos
 * se alinearán con el modelo persistido en Prisma.
 */

export type InboxProvider = 'MICROSOFT' | 'GOOGLE';

export interface InboxThreadMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  bodyHtml: string;
  receivedAt: string; // ISO 8601
}

export interface InboxMessage {
  id: string;
  externalId: string;
  provider: InboxProvider;
  threadId: string;
  senderName: string;
  senderEmail: string;
  recipientEmails: string[];
  subject: string;
  bodyPreview: string;
  bodyHtml: string;
  receivedAt: string; // ISO 8601
  isRead: boolean;
  isImportant: boolean;
  categories: string[];
  hasAttachments: boolean;
  conversation: InboxThreadMessage[];
}

export interface InboxFilters {
  query: string;
  provider: 'ALL' | InboxProvider;
  status: 'ALL' | 'UNREAD' | 'READ';
  priority: 'ALL' | 'IMPORTANT';
  dateFrom: string; // yyyy-mm-dd
  dateTo: string;   // yyyy-mm-dd
}

export interface InboxCounts {
  total: number;
  unread: number;
  important: number;
  microsoft: number;
  google: number;
}
