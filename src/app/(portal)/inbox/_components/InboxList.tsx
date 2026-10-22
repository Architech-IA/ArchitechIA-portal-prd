'use client';

import { MailOpen, Paperclip, Star } from 'lucide-react';
import type { InboxMessage } from '@/eaih';
import { formatInboxDate } from '@/eaih';
import { PROVIDER_LABELS, PROVIDER_STYLES } from '../_lib/constants';

export interface InboxListProps {
  messages: InboxMessage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleImportant: (id: string, e: React.MouseEvent) => void;
  onMarkUnread: (id: string, e: React.MouseEvent) => void;
}

export function InboxList({
  messages,
  selectedId,
  onSelect,
  onToggleImportant,
  onMarkUnread,
}: InboxListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-sm">
        <MailOpen className="w-8 h-8 mb-2 opacity-50" />
        <p>No se encontraron mensajes.</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {messages.map((message) => {
        const isSelected = message.id === selectedId;
        return (
          <button
            key={message.id}
            type="button"
            onClick={() => onSelect(message.id)}
            className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${
              isSelected ? 'bg-white/10' : 'hover:bg-white/5'
            } ${!message.isRead ? 'bg-white/[0.02]' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white truncate">
                    {message.senderName}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${PROVIDER_STYLES[message.provider]}`}
                  >
                    {PROVIDER_LABELS[message.provider]}
                  </span>
                </div>
                <p
                  className={`text-sm truncate ${
                    message.isRead ? 'text-gray-400' : 'text-gray-200 font-medium'
                  }`}
                >
                  {message.subject}
                </p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{message.bodyPreview}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {formatInboxDate(message.receivedAt)}
                </span>
                <div className="flex items-center gap-2">
                  {message.hasAttachments && (
                    <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => onToggleImportant(message.id, e)}
                    className="focus:outline-none"
                    aria-label={message.isImportant ? 'Quitar importancia' : 'Marcar como importante'}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        message.isImportant ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => onMarkUnread(message.id, e)}
                    className="focus:outline-none"
                    aria-label="Marcar como no leído"
                  >
                    <MailOpen
                      className={`w-4 h-4 ${message.isRead ? 'text-gray-600' : 'text-blue-400'}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
