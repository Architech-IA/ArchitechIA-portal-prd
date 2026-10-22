import type { InboxCounts, InboxFilters, InboxMessage, InboxProvider } from './types';

function matchesQuery(message: InboxMessage, query: string): boolean {
  if (!query.trim()) return true;
  const normalized = query.toLowerCase();
  return (
    message.subject.toLowerCase().includes(normalized) ||
    message.senderName.toLowerCase().includes(normalized) ||
    message.senderEmail.toLowerCase().includes(normalized) ||
    message.bodyPreview.toLowerCase().includes(normalized) ||
    message.categories.some((c) => c.toLowerCase().includes(normalized))
  );
}

function matchesProvider(message: InboxMessage, provider: InboxFilters['provider']): boolean {
  return provider === 'ALL' || message.provider === provider;
}

function matchesStatus(message: InboxMessage, status: InboxFilters['status']): boolean {
  if (status === 'ALL') return true;
  return status === 'UNREAD' ? !message.isRead : message.isRead;
}

function matchesPriority(message: InboxMessage, priority: InboxFilters['priority']): boolean {
  return priority !== 'IMPORTANT' || message.isImportant;
}

function matchesDateRange(message: InboxMessage, from: string, to: string): boolean {
  const received = new Date(message.receivedAt);
  if (from) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    if (received < start) return false;
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (received > end) return false;
  }
  return true;
}

export function applyInboxFilters(messages: InboxMessage[], filters: InboxFilters): InboxMessage[] {
  return messages.filter((message) => {
    return (
      matchesQuery(message, filters.query) &&
      matchesProvider(message, filters.provider) &&
      matchesStatus(message, filters.status) &&
      matchesPriority(message, filters.priority) &&
      matchesDateRange(message, filters.dateFrom, filters.dateTo)
    );
  });
}

export function getInboxCounts(messages: InboxMessage[]): InboxCounts {
  return messages.reduce<InboxCounts>(
    (acc, message) => {
      acc.total += 1;
      if (!message.isRead) acc.unread += 1;
      if (message.isImportant) acc.important += 1;
      if (message.provider === 'MICROSOFT') acc.microsoft += 1;
      if (message.provider === 'GOOGLE') acc.google += 1;
      return acc;
    },
    { total: 0, unread: 0, important: 0, microsoft: 0, google: 0 }
  );
}

export function sortInboxByDate(messages: InboxMessage[]): InboxMessage[] {
  return [...messages].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );
}
