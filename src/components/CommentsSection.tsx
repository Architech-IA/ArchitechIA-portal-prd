'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null };
  replies: Comment[];
}

export default function CommentsSection({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data: session } = useSession();
  const myId = (session?.user as { id?: string })?.id ?? '';

  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // SSE: actualizaciones en tiempo real
  useEffect(() => {
    const sse = new EventSource(`/api/comments/sse?entityType=${entityType}&entityId=${entityId}`);
    sse.onmessage = (e) => {
      try {
        setComments(JSON.parse(e.data));
        setLoading(false);
      } catch { /* ignorar */ }
    };
    return () => sse.close();
  }, [entityType, entityId]);

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments, loading]);

  const addComment = async (parentId: string | null = null) => {
    const body = parentId ? replyText : text;
    if (!body.trim() || !myId) return;
    setSending(true);
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body, entityType, entityId, parentId, userId: myId }),
    });
    if (parentId) { setReplyText(''); setReplyingTo(null); }
    else setText('');
    setSending(false);
  };

  const initials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

  const timeStr = (d: string) =>
    new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const dateStr = (d: string) =>
    new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

  return (
    <div className="flex flex-col h-full min-h-[300px]">
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Sin mensajes. ¡Sé el primero!</p>
          </div>
        ) : (
          comments.map(c => {
            const isMe = c.user.id === myId;
            return (
              <div key={c.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5
                  ${isMe ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {initials(c.user.name)}
                </div>

                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {/* Nombre + hora */}
                  <div className={`flex items-center gap-1.5 text-[10px] text-gray-500 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="font-medium text-gray-400">{isMe ? 'Tú' : c.user.name}</span>
                    <span>{dateStr(c.createdAt)} {timeStr(c.createdAt)}</span>
                  </div>

                  {/* Burbuja */}
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed
                    ${isMe
                      ? 'bg-orange-600 text-white rounded-tr-sm'
                      : 'bg-gray-800 text-gray-200 rounded-tl-sm border border-gray-700'
                    }`}>
                    {c.text}
                  </div>

                  {/* Respuestas */}
                  {c.replies.length > 0 && (
                    <div className={`ml-2 pl-3 border-l-2 border-gray-700 space-y-2 w-full`}>
                      {c.replies.map(r => {
                        const rMe = r.user.id === myId;
                        return (
                          <div key={r.id} className={`flex gap-1.5 ${rMe ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold
                              ${rMe ? 'bg-orange-400 text-white' : 'bg-gray-700 text-gray-400'}`}>
                              {initials(r.user.name)}
                            </div>
                            <div className={`px-2.5 py-1.5 rounded-xl text-xs
                              ${rMe ? 'bg-orange-500/80 text-white' : 'bg-gray-800 text-gray-300 border border-gray-700'}`}>
                              {r.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Botón responder */}
                  {!isMe && (
                    <button
                      onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                      className="text-[10px] text-gray-600 hover:text-orange-400 transition-colors"
                    >
                      {replyingTo === c.id ? 'Cancelar' : '↩ Responder'}
                    </button>
                  )}

                  {/* Input respuesta */}
                  {replyingTo === c.id && (
                    <div className="flex gap-1.5 mt-1 w-full">
                      <input
                        type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addComment(c.id)}
                        placeholder="Responder..."
                        className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      />
                      <button onClick={() => addComment(c.id)} disabled={!replyText.trim()}
                        className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs hover:bg-orange-500 disabled:opacity-40 transition-colors">
                        →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input principal */}
      <div className="flex gap-2 pt-3 border-t border-gray-800 mt-2">
        <input
          type="text" value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addComment()}
          placeholder="Escribe un mensaje..."
          className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
        />
        <button
          onClick={() => addComment()} disabled={!text.trim() || sending}
          className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white rounded-xl text-sm transition-colors flex items-center gap-1"
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
