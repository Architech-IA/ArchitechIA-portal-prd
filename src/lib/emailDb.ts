/**
 * Helpers de Prisma para persistir y consultar correos cifrados.
 *
 * Nota de implementación: estos helpers usan `as any` sobre el cliente Prisma
 * porque los modelos `ExternalMessage` / `EmailAccount` se definen en
 * `src/db/schema-additions.prisma` y no existen en el cliente generado hasta que
 * se aplique la migración y se ejecute `prisma generate`.
 */

import { prisma } from '@/lib/prisma';
import {
  InboxFilters,
  InboxMessage,
  InboxThreadMessage,
} from '@/lib/inbox';
import {
  dbRecordToInboxMessage,
  dbRecordToThreadMessage,
  inboxMessageToCreateInput,
} from '@/lib/emailMapper';
import { encryptEmailField } from '@/lib/emailCrypto';

const externalMessageDelegate = () => (prisma as any).externalMessage;
const emailAccountDelegate = () => (prisma as any).emailAccount;

export interface SyncExternalMessageOptions {
  userId: string;
  accountId: string;
  message: InboxMessage;
}

/**
 * Sincroniza un mensaje: inserta si no existe o lo actualiza si ya está presente.
 * La clave natural es (accountId, externalId, provider).
 */
export async function syncExternalMessage({
  userId,
  accountId,
  message,
}: SyncExternalMessageOptions): Promise<void> {
  const data = inboxMessageToCreateInput(message, userId, accountId);

  await externalMessageDelegate().upsert({
    where: {
      accountId_externalId_provider: {
        accountId,
        externalId: message.externalId,
        provider: message.provider,
      },
    },
    update: data,
    create: data,
  });
}

function buildWhereFromFilters(userId: string, filters: InboxFilters): Record<string, unknown> {
  const where: Record<string, unknown> = { userId };

  if (filters.provider !== 'ALL') {
    where.provider = filters.provider;
  }

  if (filters.status === 'UNREAD') {
    where.isRead = false;
  } else if (filters.status === 'READ') {
    where.isRead = true;
  }

  if (filters.priority === 'IMPORTANT') {
    where.isImportant = true;
  }

  if (filters.dateFrom || filters.dateTo) {
    const receivedAt: Record<string, Date> = {};
    if (filters.dateFrom) {
      receivedAt.gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      // Incluir todo el día.
      const end = new Date(filters.dateTo);
      end.setUTCHours(23, 59, 59, 999);
      receivedAt.lte = end;
    }
    where.receivedAt = receivedAt;
  }

  return where;
}

/**
 * Lista mensajes descifrados aplicando los filtros del inbox.
 * Devuelve máximo `limit` resultados ordenados por fecha descendente.
 */
export async function getInboxMessages(
  userId: string,
  filters: InboxFilters,
  limit = 100
): Promise<InboxMessage[]> {
  const records: unknown[] = await externalMessageDelegate().findMany({
    where: buildWhereFromFilters(userId, filters),
    orderBy: { receivedAt: 'desc' },
    take: limit,
  });

  return records
    .map((record) => {
      try {
        return dbRecordToInboxMessage(record as Record<string, unknown>);
      } catch (err) {
        console.error('[emailDb] Error descifrando mensaje, se omite:', err);
        return null;
      }
    })
    .filter((msg): msg is InboxMessage => msg !== null);
}

/**
 * Carga todos los mensajes de un hilo, ordenados por fecha ascendente.
 */
export async function getThreadMessages(
  userId: string,
  threadId: string
): Promise<InboxThreadMessage[]> {
  const records: unknown[] = await externalMessageDelegate().findMany({
    where: { userId, threadId },
    orderBy: { receivedAt: 'asc' },
  });

  return records
    .map((record) => {
      try {
        return dbRecordToThreadMessage(record as Record<string, unknown>);
      } catch (err) {
        console.error('[emailDb] Error descifrando mensaje de hilo, se omite:', err);
        return null;
      }
    })
    .filter((msg): msg is InboxThreadMessage => msg !== null);
}

/**
 * Marca un mensaje como leído/no leído. No requiere descifrar nada.
 */
export async function markMessageRead(
  messageId: string,
  isRead: boolean
): Promise<void> {
  await externalMessageDelegate().update({
    where: { id: messageId },
    data: { isRead },
  });
}

export interface UpsertEmailAccountInput {
  userId: string;
  provider: 'GOOGLE' | 'MICROSOFT';
  accountEmail: string;
  externalAccountId?: string;
  syncCursor?: string;
}

/**
 * Crea o actualiza una cuenta de correo conectada.
 * El correo de la cuenta se cifra antes de guardar.
 */
export async function upsertEmailAccount(
  input: UpsertEmailAccountInput
): Promise<Record<string, unknown>> {
  return emailAccountDelegate().upsert({
    where: {
      userId_provider: {
        userId: input.userId,
        provider: input.provider,
      },
    },
    create: {
      userId: input.userId,
      provider: input.provider,
      accountEmailCipher: encryptEmailField(input.accountEmail),
      externalAccountId: input.externalAccountId ?? null,
      syncCursor: input.syncCursor ?? null,
    },
    update: {
      accountEmailCipher: encryptEmailField(input.accountEmail),
      externalAccountId: input.externalAccountId ?? null,
      syncCursor: input.syncCursor ?? null,
      lastSyncedAt: new Date(),
    },
  });
}
