'use client';

import { useState, useRef, useEffect } from 'react';

// Chat con Sage, el orquestador. Delega a Booking Agent, Documentador o Presales + Documentador.
// Si el pedido es largo (Presales), consulta el hilo cada pocos segundos hasta que termine.
interface Msg { de: 'yo' | 'sage'; texto: string; agente?: string; propuestaId?: string; boton?: string; estado?: 'pendiente' | 'aplicada' | 'descartada'; hiloId?: string; enCurso?: boolean }
const ETIQUETA: Record<string, string> = { 'booking-agent': 'Booking Agent', documentador: 'Documentador', presales: 'Presales + Documentador' };
const PASOS: Record<string, string> = { contenido: 'Presales entregó el contenido', borrador: 'El Documentador redactó un borrador', ajustes: 'Presales pidió ajustes', aprobado: 'Presales aprobó' };

export default function OrquestadorPanel() {
  const [abierto, setAbierto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [progreso, setProgreso] = useState<Record<string, string>>({});
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, abierto, progreso]);

  // Consulta de los hilos en curso
  const enCurso = msgs.filter(m => m.enCurso && m.hiloId).map(m => m.hiloId as string).join(',');
  useEffect(() => {
    if (!enCurso) return;
    const t = setInterval(async () => {
      for (const id of enCurso.split(',')) {
        try {
          const r = await fetch(`/api/orquestador/hilo/${id}`);
          if (!r.ok) continue;
          const h = await r.json() as { estado: string; resultado: string | null; traspasos: { tipo: string; ronda: number }[] };
          const ultimo = h.traspasos[h.traspasos.length - 1];
          if (ultimo) setProgreso(p => ({ ...p, [id]: `${PASOS[ultimo.tipo] || ultimo.tipo}${ultimo.ronda ? ` (ronda ${ultimo.ronda})` : ''}` }));
          if (h.estado !== 'EN_CURSO') setMsgs(m => [...m.map(x => (x.hiloId === id ? { ...x, enCurso: false } : x)), { de: 'sage', agente: 'presales', texto: h.resultado || 'Terminó.' }]);
        } catch { /* se reintenta en el siguiente ciclo */ }
      }
    }, 6000);
    return () => clearInterval(t);
  }, [enCurso]);

  const post = async (url: string, body: object) => {
    try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return await r.json(); }
    catch { return { error: 'Error de conexión.' }; }
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t || ocupado) return;
    setTexto(''); setOcupado(true);
    setMsgs(m => [...m, { de: 'yo', texto: t }]);
    const r = await post('/api/orquestador', { mensaje: t });
    setMsgs(m => [...m, { de: 'sage', texto: r.texto || r.error || 'Sin respuesta.', agente: r.agente, propuestaId: r.propuestaId, boton: r.botonAplicar, estado: r.propuestaId ? 'pendiente' : undefined, hiloId: r.hiloId, enCurso: !!r.enCurso }]);
    setOcupado(false);
  };

  const decidir = async (i: number, accion: 'aplicar' | 'descartar') => {
    const id = msgs[i].propuestaId;
    if (!id || ocupado) return;
    setOcupado(true);
    const r = await post('/api/agendador', { propuestaId: id, accion });
    setMsgs(m => [...m.map((x, k) => (k === i ? { ...x, estado: accion === 'aplicar' ? 'aplicada' as const : 'descartada' as const } : x)), { de: 'sage', agente: 'booking-agent', texto: r.texto || r.error || 'Sin respuesta.' }]);
    setOcupado(false);
  };

  return (
    <>
      <button onClick={() => setAbierto(a => !a)} aria-label="Sage, orquestador" className="fixed bottom-5 right-5 z-40 px-4 py-2.5 rounded-full text-white text-sm font-medium shadow-lg transition-colors" style={{ background: '#3b4a63', border: '1px solid rgba(255,255,255,0.15)' }}>
        {abierto ? 'Cerrar' : 'Sage'}
      </button>
      {abierto && (
        <div className="fixed bottom-20 right-5 z-40 w-[min(26rem,calc(100vw-2.5rem))] h-[min(34rem,70vh)] rounded-xl flex flex-col shadow-2xl" style={{ background: '#141a24', border: '1px solid rgba(255,255,255,0.09)' }}>
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-sm font-semibold text-white">Sage, orquestador</p>
            <p className="text-xs text-gray-400">Dime qué necesitas y lo delego: agenda (Booking Agent), backlog (Backlog Manager), consultas (Documentador) o documentos técnicos (Presales + Documentador).</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {msgs.length === 0 && (
              <div className="text-xs text-gray-400 space-y-1">
                <p>Ejemplos:</p>
                {['Agenda una reunión con Nexora el jueves a las 3 pm', 'Qué quedó pendiente con VAIGEN', 'Mejora el briefing del primer contacto de La Promotora Seguros'].map(e => (
                  <button key={e} onClick={() => setTexto(e)} className="block text-left text-sky-300 hover:text-sky-200">{e}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.de === 'yo' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.de === 'yo' ? 'text-white' : 'text-gray-200'}`} style={{ background: m.de === 'yo' ? '#3b4a63' : 'rgba(255,255,255,0.06)' }}>
                  {m.agente && <p className="text-[10px] uppercase tracking-wide text-sky-300 mb-1">{ETIQUETA[m.agente] || m.agente}</p>}
                  {m.texto}
                  {m.enCurso && m.hiloId && <p className="mt-2 text-xs text-amber-300">{progreso[m.hiloId] || 'Trabajando...'}</p>}
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
            {ocupado && <p className="text-xs text-gray-400">Decidiendo a quién delegar...</p>}
            <div ref={fin} />
          </div>
          <form onSubmit={e => { e.preventDefault(); enviar(); }} className="p-3 border-t border-white/10 flex gap-2">
            <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe tu pedido..." className="flex-1 rounded-lg px-3 py-2 text-sm text-white bg-transparent outline-none focus:ring-1 focus:ring-sky-400" style={{ border: '1px solid rgba(255,255,255,0.12)' }} />
            <button type="submit" disabled={ocupado || !texto.trim()} className="px-3 py-2 rounded-lg text-white text-sm disabled:opacity-50" style={{ background: '#3b4a63' }}>Enviar</button>
          </form>
        </div>
      )}
    </>
  );
}
