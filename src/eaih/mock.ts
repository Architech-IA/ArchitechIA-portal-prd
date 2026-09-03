import type { InboxMessage } from './types';

const today = new Date();

const hoursAgo = (h: number) => new Date(today.getTime() - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => new Date(today.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

/**
 * Fixture de demostración para el MVP.
 *
 * Todos los datos son ficticios. No contienen PII real de usuarios ni clientes.
 * Reemplazar por fetch a /api/inbox cuando la sincronización con Gmail/Outlook
 * esté disponible.
 */
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
    bodyPreview:
      'Hola, revisamos la propuesta y queremos agendar una sesión de alineación comercial para la semana entrante...',
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
    bodyPreview:
      'Adjunto el documento con los requisitos técnicos actualizados. Necesitamos validar el alcance...',
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
    externalId: 'msg-3-external',
    provider: 'GOOGLE',
    threadId: 'thread-3',
    senderName: 'María Elena Torres',
    senderEmail: 'melena.torres@ejemplo.org',
    recipientEmails: ['ceo@architechia.com'],
    subject: 'Invitación: revisión trimestral de gobierno corporativo',
    bodyPreview: 'Te invitamos a la revisión trimestral del comité de gobierno corporativo...',
    bodyHtml: `<p>Buenas tardes,</p><p>Te invitamos a la revisión trimestral del comité de gobierno corporativo el próximo jueves a las 09:00.</p><p>Saludos,<br>María Elena</p>`,
    receivedAt: daysAgo(1),
    isRead: false,
    isImportant: false,
    categories: ['Corporativo'],
    hasAttachments: false,
    conversation: [
      {
        id: 'msg-3',
        senderName: 'María Elena Torres',
        senderEmail: 'melena.torres@ejemplo.org',
        bodyHtml: `<p>Buenas tardes,</p><p>Te invitamos a la revisión trimestral del comité de gobierno corporativo el próximo jueves a las 09:00.</p><p>Saludos,<br>María Elena</p>`,
        receivedAt: daysAgo(1),
      },
    ],
  },
];
