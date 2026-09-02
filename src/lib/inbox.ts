/**
 * Inbox domain types and mock data.
 *
 * NOTE: This file is frontend-only for the MVP. Once the backend sync
 * (SP-0002-0003-005) and Prisma schema are unlocked, these types map
 * directly to the proposed ExternalMessage model and the data must be
 * served from /api/inbox instead of the static fixture below.
 */

export type InboxProvider = 'MICROSOFT' | 'GOOGLE';

export interface InboxThreadMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  bodyHtml: string;
  receivedAt: string;
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
  receivedAt: string;
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

const today = new Date();
const hoursAgo = (h: number) => new Date(today.getTime() - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => new Date(today.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

export const MOCK_INBOX_MESSAGES: InboxMessage[] = [
  {
    id: 'msg-1',
    externalId: 'AAMkAGI5...',
    provider: 'MICROSOFT',
    threadId: 'thread-1',
    senderName: 'Victoria Ruiz',
    senderEmail: 'victoria.ruiz@contoso.com',
    recipientEmails: ['ceo@architechia.com'],
    subject: 'Propuesta de partnership Q3: próximos pasos',
    bodyPreview: 'Hola, revisamos la propuesta y queremos agendar una sesión de alineación comercial para la semana entrante...',
    bodyHtml: `<p>Hola,</p><p>Revisamos la propuesta y queremos agendar una sesión de alineación comercial para la semana entrante. ¿Tienes disponibilidad el martes o miércoles por la mañana?</p><p>Saludos,<br>Victoria</p>`,
    receivedAt: hoursAgo(2),
    isRead: false,
    isImportant: true,
    categories: ['Comercial', 'Partnership'],
    hasAttachments: true,
    conversation: [
      {
        id: 'msg-1a',
        senderName: 'Victoria Ruiz',
        senderEmail: 'victoria.ruiz@contoso.com',
        bodyHtml: `<p>Hola,</p><p>Te envío el deck preliminar para revisión.</p>`,
        receivedAt: daysAgo(2),
      },
      {
        id: 'msg-1',
        senderName: 'Victoria Ruiz',
        senderEmail: 'victoria.ruiz@contoso.com',
        bodyHtml: `<p>Hola,</p><p>Revisamos la propuesta y queremos agendar una sesión de alineación comercial para la semana entrante. ¿Tienes disponibilidad el martes o miércoles por la mañana?</p><p>Saludos,<br>Victoria</p>`,
        receivedAt: hoursAgo(2),
      },
    ],
  },
  {
    id: 'msg-2',
    externalId: '18f8b2a3...',
    provider: 'GOOGLE',
    threadId: 'thread-2',
    senderName: 'Carlos Mendoza',
    senderEmail: 'cmendoza@cliente.com',
    recipientEmails: ['ceo@architechia.com', 'comercial@architechia.com'],
    subject: 'Actualización de requisitos: integración con SAP',
    bodyPreview: 'Adjunto el documento con los requisitos técnicos actualizados. Necesitamos validar el alcance...',
    bodyHtml: `<p>Buenos días,</p><p>Adjunto el documento con los requisitos técnicos actualizados. Necesitamos validar el alcance y estimación antes del viernes.</p><p>Gracias,<br>Carlos</p>`,
    receivedAt: hoursAgo(5),
    isRead: true,
    isImportant: true,
    categories: ['Proyecto', 'Integración'],
    hasAttachments: true,
    conversation: [
      {
        id: 'msg-2',
        senderName: 'Carlos Mendoza',
        senderEmail: 'cmendoza@cliente.com',
        bodyHtml: `<p>Buenos días,</p><p>Adjunto el documento con los requisitos técnicos actualizados. Necesitamos validar el alcance y estimación antes del viernes.</p><p>Gracias,<br>Carlos</p>`,
        receivedAt: hoursAgo(5),
      },
    ],
  },
  {
    id: 'msg-3',
    externalId: 'AAMkAGI6...',
    provider: 'MICROSOFT',
    threadId: 'thread-3',
    senderName: 'Equipo Legal',
    senderEmail: 'legal@architechia.com',
    recipientEmails: ['ceo@architechia.com'],
    subject: 'Revisión de contrato: NDA con proveedor cloud',
    bodyPreview: 'El equipo legal dejó sus comentarios en el contrato. Revisar los puntos 3.2 y 7.1...',
    bodyHtml: `<p>CEO,</p><p>El equipo legal dejó sus comentarios en el contrato. Revisar los puntos 3.2 y 7.1 antes de la firma.</p>`,
    receivedAt: hoursAgo(8),
    isRead: false,
    isImportant: false,
    categories: ['Legal', 'Interno'],
    hasAttachments: false,
    conversation: [
      {
        id: 'msg-3',
        senderName: 'Equipo Legal',
        senderEmail: 'legal@architechia.com',
        bodyHtml: `<p>CEO,</p><p>El equipo legal dejó sus comentarios en el contrato. Revisar los puntos 3.2 y 7.1 antes de la firma.</p>`,
        receivedAt: hoursAgo(8),
      },
    ],
  },
  {
    id: 'msg-4',
    externalId: 'AAMkAGI7...',
    provider: 'MICROSOFT',
    threadId: 'thread-4',
    senderName: 'Laura Gómez',
    senderEmail: 'laura.gomez@proveedor.com',
    recipientEmails: ['ceo@architechia.com'],
    subject: 'Invoice #2025-044 pendiente de aprobación',
    bodyPreview: 'Recordatorio amistoso: la factura #2025-044 vence en 3 días hábiles...',
    bodyHtml: `<p>Hola,</p><p>Recordatorio amistoso: la factura #2025-044 vence en 3 días hábiles. ¿Podrías confirmar la aprobación?</p>`,
    receivedAt: daysAgo(1),
    isRead: true,
    isImportant: false,
    categories: ['Finanzas'],
    hasAttachments: true,
    conversation: [
      {
        id: 'msg-4',
        senderName: 'Laura Gómez',
        senderEmail: 'laura.gomez@proveedor.com',
        bodyHtml: `<p>Hola,</p><p>Recordatorio amistoso: la factura #2025-044 vence en 3 días hábiles. ¿Podrías confirmar la aprobación?</p>`,
        receivedAt: daysAgo(1),
      },
    ],
  },
  {
    id: 'msg-5',
    externalId: '1a2b3c4d...',
    provider: 'GOOGLE',
    threadId: 'thread-5',
    senderName: 'Ana Torres',
    senderEmail: 'ana.torres@inversor.com',
    recipientEmails: ['ceo@architechia.com'],
    subject: 'Follow up: reunión de board del jueves',
    bodyPreview: 'Confirmo asistencia al board. Comparto el resumen financiero preliminar...',
    bodyHtml: `<p>Hola,</p><p>Confirmo asistencia al board del jueves. Comparto el resumen financiero preliminar para tu revisión.</p>`,
    receivedAt: daysAgo(2),
    isRead: false,
    isImportant: true,
    categories: ['Board', 'Finanzas'],
    hasAttachments: true,
    conversation: [
      {
        id: 'msg-5',
        senderName: 'Ana Torres',
        senderEmail: 'ana.torres@inversor.com',
        bodyHtml: `<p>Hola,</p><p>Confirmo asistencia al board del jueves. Comparto el resumen financiero preliminar para tu revisión.</p>`,
        receivedAt: daysAgo(2),
      },
    ],
  },
  {
    id: 'msg-6',
    externalId: 'AAMkAGI8...',
    provider: 'MICROSOFT',
    threadId: 'thread-6',
    senderName: 'Soporte Microsoft 365',
    senderEmail: 'noreply@microsoft.com',
    recipientEmails: ['ceo@architechia.com'],
    subject: 'Alerta de seguridad: inicio de sesión no habitual',
    bodyPreview: 'Detectamos un inicio de sesión desde una ubicación no reconocida...',
    bodyHtml: `<p>Detectamos un inicio de sesión desde una ubicación no reconocida. Si no fuiste tú, revisa la actividad reciente.</p>`,
    receivedAt: daysAgo(3),
    isRead: true,
    isImportant: false,
    categories: ['Seguridad'],
    hasAttachments: false,
    conversation: [
      {
        id: 'msg-6',
        senderName: 'Soporte Microsoft 365',
        senderEmail: 'noreply@microsoft.com',
        bodyHtml: `<p>Detectamos un inicio de sesión desde una ubicación no reconocida. Si no fuiste tú, revisa la actividad reciente.</p>`,
        receivedAt: daysAgo(3),
      },
    ],
  },
];

export function applyInboxFilters(messages: InboxMessage[], filters: InboxFilters): InboxMessage[] {
  const query = filters.query.toLowerCase().trim();
  const from = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00').getTime() : 0;
  const to = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59').getTime() : Infinity;

  return messages.filter((m) => {
    if (filters.provider !== 'ALL' && m.provider !== filters.provider) return false;
    if (filters.status === 'UNREAD' && m.isRead) return false;
    if (filters.status === 'READ' && !m.isRead) return false;
    if (filters.priority === 'IMPORTANT' && !m.isImportant) return false;

    const received = new Date(m.receivedAt).getTime();
    if (received < from || received > to) return false;

    if (query) {
      const haystack = `${m.senderName} ${m.senderEmail} ${m.subject} ${m.bodyPreview}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

export function formatInboxDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function getInboxCounts(messages: InboxMessage[]) {
  return {
    all: messages.length,
    unread: messages.filter((m) => !m.isRead).length,
    important: messages.filter((m) => m.isImportant).length,
    microsoft: messages.filter((m) => m.provider === 'MICROSOFT').length,
    google: messages.filter((m) => m.provider === 'GOOGLE').length,
  };
}
