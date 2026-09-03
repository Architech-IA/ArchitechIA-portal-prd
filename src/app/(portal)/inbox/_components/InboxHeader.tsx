'use client';

import { Inbox } from 'lucide-react';

export interface InboxHeaderProps {
  title?: string;
  subtitle?: string;
}

export function InboxHeader({
  title = 'Unified Inbox',
  subtitle = 'Correos de Microsoft 365 y Google Workspace en un solo lugar',
}: InboxHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
          <Inbox className="w-4 h-4 text-orange-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">{title}</h1>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
