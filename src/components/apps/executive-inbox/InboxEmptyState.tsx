import { Inbox } from 'lucide-react';

export interface InboxEmptyStateProps {
  title?: string;
  description?: string;
}

export function InboxEmptyState({
  title = 'Bandeja vacía',
  description = 'No hay correos que coincidan con los filtros seleccionados.',
}: InboxEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
        <Inbox className="w-6 h-6 text-gray-500" />
      </div>
      <h3 className="text-sm font-medium text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-500 max-w-xs">{description}</p>
    </div>
  );
}
