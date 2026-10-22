/**
 * Entrypoint público del dominio Executive AI Inbox & Hub (EAIH).
 *
 * Este archivo re-exporta los símbolos desde `src/eaih/` para mantener
 * compatibilidad con los imports existentes (`@/lib/inbox`) y centralizar
 * el acceso al dominio.
 *
 * NOTA: Este archivo es frontend-only para el MVP. Una vez desbloqueado el
 * backend de sincronización (Gmail/Outlook) y el schema de Prisma, los datos
 * deben servirse desde `/api/inbox` y estos tipos se alinearán con el modelo
 * persistido.
 */

export {
  MOCK_INBOX_MESSAGES,
  applyInboxFilters,
  formatInboxDate,
  getInboxCounts,
  sortInboxByDate,
} from '@/eaih';

export type {
  InboxProvider,
  InboxThreadMessage,
  InboxMessage,
  InboxFilters,
  InboxCounts,
} from '@/eaih';
