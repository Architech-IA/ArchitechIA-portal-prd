const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
};

const FULL_FORMAT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(date: Date, now: Date): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

/**
 * Formatea una fecha de recepción para mostrar en la lista de mensajes.
 * - Hoy: hh:mm
 * - Ayer: "Ayer"
 * - Otro día: dd MMM
 */
export function formatInboxDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();

  if (isSameDay(date, now)) {
    return date.toLocaleTimeString('es-ES', TIME_FORMAT);
  }

  if (isYesterday(date, now)) {
    return 'Ayer';
  }

  return date.toLocaleDateString('es-ES', DATE_FORMAT);
}

/**
 * Formatea una fecha completa para el detalle de un mensaje.
 */
export function formatInboxDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-ES', FULL_FORMAT);
}
