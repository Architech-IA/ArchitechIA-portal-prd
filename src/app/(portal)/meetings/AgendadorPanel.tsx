'use client';

import { useState, useRef, useEffect } from 'react';

// Chat del Booking Agent. Propone crear, mover o cancelar reuniones y solo aplica el cambio
// cuando se pulsa el botón de confirmación. onCambio recarga el calendario tras aplicar.
interface Msg { de: 'yo' | 'agente'; texto: string; propuestaId?: string; boton?: string; estado?: 'pendiente' | 'aplicada' | 'descartada' }

export default function AgendadorPanel({ onCambio }: { onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, abierto]);

  const post = async (body: object): Promise<{ texto?: string; propuestaId?: string; botonAplicar?: string; error?: string }> => {
    try {
      const r = await fetch('/api/agendador', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return await r.json();
    } catch { return { error: 'Error de conexión.' }; }
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t || ocupado) return;
    setTexto(''); setOcupado(true);
    setMsgs(m => [...m, { de: 'yo', texto: t }]);
    const r = await post({ mensaje: t });
    setMsgs(m => [...m, { de: 'agente', texto: r.texto || r.error || 'Sin respuesta.', propuestaId: r.propuestaId, boton: r.botonAplicar, estado: r.propuestaId ? 'pendiente' : undefined }]);
    setOcupado(false);
  };

  const decidir = async (i: number, accion: 'aplicar' | 'descartar') => {
    const id = msgs[i].propuestaId;
    if (!id || ocupado) return;
    setOcupado(true);
    const r = await post({ propuestaId: id, accion });
    setMsgs(m => [...m.map((x, k) => (k === i ? { ...x, estado: accion === 'aplicar' ? 'aplicada' as const : 'descartada' as const } : x)), { de: 'agente', texto: r.texto || r.error || 'Sin respuesta.' }]);
    setOcupado(false);
    if (accion === 'aplicar') onCambio();
  };

  const caja = { background: '#141a24', border: '1px solid rgba(255,255,255,0.09)' };
  return (
    <>
      <button onClick={() => setAbierto(a => !a)} aria-label="Booking Agent" className="fixed bottom-5 right-28 z-40 px-4 py-2.5 rounded-full bg-orange-600 text-white text-sm font-medium shadow-lg hover:bg-orange-500 transition-colors">
        {abierto ? 'Cerrar' : 'Booking Agent'}
      </button>
      {abierto && (
        <div className="fixed bottom-20 right-5 z-40 w-[min(24rem,calc(100vw-2.5rem))] h-[min(32rem,70vh)] rounded-xl flex flex-col shadow-2xl" style={caja}>
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">Booking Agent</p>
              {msgs.length > 0 && <button disabled={ocupado} onClick={async () => { await post({ nueva: true }); setMsgs([]); }} className="text-[11px] text-gray-400 hover:text-white disabled:opacity-50">Nueva conversación</button>}
            </div>
            <p className="text-xs text-gray-400">Pídeme crear, mover o cancelar reuniones, o preguntar qué tienes. Nada cambia hasta que confirmes. Recuerdo lo último que hablamos (unos 15 minutos).</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {msgs.length === 0 && (
              <div className="text-xs text-gray-400 space-y-1">
                <p>Ejemplos:</p>
                {['Agenda una reunión con Nexora el jueves a las 3 pm', 'Mueve la demo al viernes a las 10', 'Qué tengo hoy'].map(e => (
                  <button key={e} onClick={() => setTexto(e)} className="block text-left text-orange-300 hover:text-orange-200">{e}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.de === 'yo' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[88%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.de === 'yo' ? 'bg-orange-600/80 text-white' : 'text-gray-200'}`} style={m.de === 'agente' ? { background: 'rgba(255,255,255,0.06)' } : undefined}>
                  {m.texto}
                  {m.propuestaId && m.estado === 'pendiente' && (
                    <div className="flex gap-2 mt-3">
                      <button disabled={ocupado} onClick={() => decidir(i, 'aplicar')} className="px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-500 disabled:opacity-50">{m.boton || 'Aplicar'}</button>
                      <button disabled={ocupado} onClick={() => decidir(i, 'descartar')} className="px-3 py-1.5 rounded-md text-xs text-gray-300 hover:text-white disabled:opacity-50" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>Descartar</button>
                    </div>
                  )}
                  {m.estado === 'aplicada' && <p className="mt-2 text-xs text-green-400">Aplicado</p>}
                  {m.estado === 'descartada' && <p className="mt-2 text-xs text-gray-400">Descartado</p>}
                </div>
              </div>
            ))}
            {ocupado && <p className="text-xs text-gray-400">Pensando...</p>}
            <div ref={fin} />
          </div>
          <form onSubmit={e => { e.preventDefault(); enviar(); }} className="p-3 border-t border-white/10 flex gap-2">
            <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe tu pedido..." className="flex-1 rounded-lg px-3 py-2 text-sm text-white bg-transparent outline-none focus:ring-1 focus:ring-orange-500" style={{ border: '1px solid rgba(255,255,255,0.12)' }} />
            <button type="submit" disabled={ocupado || !texto.trim()} className="px-3 py-2 rounded-lg bg-orange-600 text-white text-sm disabled:opacity-50">Enviar</button>
          </form>
        </div>
      )}
    </>
  );
}
