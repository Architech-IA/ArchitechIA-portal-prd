import { NextResponse } from 'next/server';
import { MOCK_INBOX_MESSAGES, sortInboxByDate } from '@/eaih';

/**
 * GET /api/inbox
 *
 * Devuelve los mensajes de demostración ordenados por fecha descendente.
 * En el Sprint 2 este endpoint se conectará a Prisma y a los conectores
 * de Gmail/Outlook.
 */
export async function GET() {
  try {
    const messages = sortInboxByDate(MOCK_INBOX_MESSAGES);
    return NextResponse.json({ messages, count: messages.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
