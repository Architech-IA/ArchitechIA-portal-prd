'use client';

import { Paperclip } from 'lucide-react';
import type { InboxMessage } from '@/eaih';
import { formatInboxDateTime } from '@/eaih';
import { PROVIDER_LABELS, PROVIDER_STYLES } from '../_lib/constants';

export interface InboxDetailProps {
  message: InboxMessage | null;
}

export function InboxDetail({ message }: InboxDetailProps) {
  if (!message) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Selecciona un mensaje para ver el detalle.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border ${PROVIDER_STYLES[message.provider]}`}
          >
            {PROVIDER_LABELS[message.provider]}
          </span>
          {message.isImportant && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
              Importante
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold text-white mb-1">{message.subject}</h2>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            {message.senderName} &lt;{message.senderEmail}&gt;
          </span>
          <span>{formatInboxDateTime(message.receivedAt)}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Para: {message.recipientEmails.join(', ')}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div
          className="prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
        />
      </div>

      {message.hasAttachments && (
        <div className="px-5 py-3 border-t border-white/5 text-xs text-gray-400 flex items-center gap-2">
          <Paperclip className="w-3.5 h-3.5" />
          Este mensaje contiene adjuntos.
        </div>
      )}
    </div>
  );
}
