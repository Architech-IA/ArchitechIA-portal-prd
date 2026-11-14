'use client';

import { useState } from 'react';
import Microfono from '@/components/Microfono';
import { createPortal } from 'react-dom';

// Agente Documentador dentro de la reunión: propone la agenda, el resumen del contenido
// o los pendientes. Nunca guarda por sí solo: la persona revisa la propuesta y la aplica.

export type Destino = 'agenda' | 'contenido' | 'pendientes';
export type EstadoReunion = { datos: Record<string, string>; hub: string };
type Propuesta =
  | { destino: 'agenda'; objetivo: string; puntos: string[]; cambios?: string }
  | { destino: 'contenido'; titulo: string; markdown: string; cambios?: string }
  | { destino: 'pendientes'; acciones: { texto: string; responsable: string; fechaLimite: string }[]; cambios?: string };

const TEXTOS: Record<Destino, { titulo: string; que: string; boton: string; ph: string }> = {
  agenda: { titulo: 'Agenda', que: 'Propone el objetivo y los puntos a tratar con lo que sabe de la reunión: reuniones anteriores con el mismo título, pendientes abiertos y la ficha del cliente.', boton: 'Proponer agenda', ph: 'Indicaciones (opcional): por ejemplo, «enfócala en el avance del piloto»' },
  contenido: { titulo: 'Contenido', que: 'Ordena tus notas en un resumen con temas, decisiones y pendientes por definir. Solo usa lo que escribiste: no agrega nada nuevo.', boton: 'Resumir las notas', ph: 'Indicaciones (opcional): por ejemplo, «tono formal para el cliente»' },
  pendientes: { titulo: 'Pendientes', que: 'Detecta las acciones que se desprenden de las notas y decisiones. Tú eliges cuáles crear.', boton: 'Proponer pendientes', ph: 'Indicaciones (opcional): por ejemplo, «solo lo de Daniel»' },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

/** Markdown sencillo (#, ##, ###, listas, negrita) a HTML para el editor de notas. */
export function mdAHtml(md: string): string {
  const out: string[] = [];
  let lista = false;
  const cerrar = () => { if (lista) { out.push('</ul>'); lista = false; } };
  for (const raw of md.split('\n')) {
    const l = raw.trimEnd();
    if (!l.trim()) { cerrar(); continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    if (h) { cerrar(); out.push(`<h${Math.max(2, h[1].length)}>${inline(h[2])}</h${Math.max(2, h[1].length)}>`); continue; }
    const li = /^\s*[-*]\s+(.*)$/.exec(l);
    if (li) { if (!lista) { out.push('<ul>'); lista = true; } out.push(`<li><p>${inline(li[1])}</p></li>`); continue; }
    cerrar(); out.push(`<p>${inline(l)}</p>`);
  }
  cerrar();
  return out.join('');
}

export default function AgenteReunion({ destino, meetingId, obtener, existentes, onAplicarAgenda, onAplicarContenido, onCrearAcciones, onCerrar }: {
  destino: Destino;
  meetingId?: string;
  obtener: () => EstadoReunion;
  existentes?: { puntos: number };
  onAplicarAgenda: (objetivo: string, puntos: string[], modo: 'reemplazar' | 'anadir') => void;
  onAplicarContenido: (titulo: string, html: string) => void;
  onCrearAcciones: (acciones: { texto: string; responsable: string; fechaLimite: string }[]) => Promise<void>;
  onCerrar: () => void;
}) {
  const t = TEXTOS[destino];
  const [instruccion, setInstruccion] = useState('');
  const [ajuste, setAjuste] = useState('');
  const [prop, setProp] = useState<Propuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());
  const [modoAgenda, setModoAgenda] = useState<'reemplazar' | 'anadir'>('reemplazar');

  async function pedir(ind: string, previo?: Propuesta) {
    setCargando(true); setError('');
    try {
      const e = obtener();
      const res = await fetch('/api/agente-reunion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destino, meetingId, datos: e.datos, hub: e.hub, instruccion: ind, previo: previo ? JSON.stringify(previo) : undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo consultar al Agente Documentador');
      setProp(d as Propuesta); setAjuste('');
      setElegidas(new Set(d.acciones ? (d.acciones as unknown[]).map((_, i) => i) : []));
    } catch (er) { setError(er instanceof Error ? er.message : 'No se pudo consultar al Agente Documentador'); } finally { setCargando(false); }
  }

  async function aplicar() {
    if (!prop) return;
    if (prop.destino === 'agenda') onAplicarAgenda(prop.objetivo, prop.puntos, modoAgenda);
    else if (prop.destino === 'contenido') onAplicarContenido(prop.titulo, mdAHtml(prop.markdown));
    else {
      setCargando(true);
      try { await onCrearAcciones(prop.acciones.filter((_, i) => elegidas.has(i))); } finally { setCargando(false); }
    }
    onCerrar();
  }

  const btn = 'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors';
  const campo = 'w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-orange-500/60';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end" style={{ background: 'rgba(3,4,12,0.6)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="h-full w-full sm:w-[440px] flex flex-col" role="dialog" aria-label="Agente Documentador"
        style={{ background: 'rgba(8,9,22,0.99)', borderLeft: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="flex items-start gap-2 px-5 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-orange-400">Agente Documentador · {t.titulo}</p>
            <h3 className="text-sm font-semibold text-white truncate">{obtener().datos.title || 'Reunión nueva'}</h3>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.08]">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 text-gray-200">
          {!prop && !cargando && (
            <>
              <p className="text-sm text-gray-400">{t.que}</p>
              <textarea value={instruccion} onChange={e => setInstruccion(e.target.value)} rows={3} placeholder={t.ph} className={campo + ' resize-none'} />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { void pedir(instruccion.trim()); }} className={`${btn} bg-orange-600 hover:bg-orange-500 text-white`}>{t.boton}</button>
                <Microfono onTexto={x => setInstruccion(v => (v.trim() ? v.trim() + ' ' : '') + x)} onError={setError} />
              </div>
              <p className="text-[11px] text-[#7f8a9c]">No guarda nada: revisas la propuesta y decides si la aplicas.</p>
            </>
          )}
          {cargando && <p className="text-sm text-gray-400">El Agente Documentador está trabajando…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {error && !cargando && !prop && <button type="button" onClick={() => setError('')} className={`${btn} border border-white/10 text-gray-300 hover:bg-white/[0.06]`}>Volver</button>}

          {prop && !cargando && (
            <div className="space-y-3">
              {prop.destino === 'agenda' && (
                <>
                  <div><p className="text-[11px] font-semibold text-gray-400 mb-1">Objetivo</p><p className="text-sm bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2">{prop.objetivo || '(sin cambios)'}</p></div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 mb-1">Puntos a tratar</p>
                    <ol className="space-y-1.5">{prop.puntos.map((p, i) => <li key={i} className="text-sm bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5"><span className="text-[#7f8a9c] mr-1.5">{i + 1}.</span>{p}</li>)}</ol>
                  </div>
                  {!!existentes?.puntos && (
                    <div className="flex gap-1.5 text-xs">
                      {(['reemplazar', 'anadir'] as const).map(m => (
                        <button key={m} type="button" onClick={() => setModoAgenda(m)}
                          className={`px-2.5 py-1 rounded-md border ${modoAgenda === m ? 'border-orange-500/60 bg-orange-600/20 text-orange-300 font-semibold' : 'border-white/10 text-gray-400'}`}>
                          {m === 'reemplazar' ? 'Reemplazar los puntos actuales' : 'Añadir al final'}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {prop.destino === 'contenido' && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 mb-1">Se agregará como pestaña nueva «{prop.titulo}» en Contenido (tus notas no se tocan)</p>
                  <div className="text-sm bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap">{prop.markdown}</div>
                </div>
              )}
              {prop.destino === 'pendientes' && (
                prop.acciones.length === 0
                  ? <p className="text-sm text-gray-400">No encontré acciones claras en las notas. Escribe más detalle en Contenido o pídeme un ajuste.</p>
                  : <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-gray-400">Elige cuáles crear</p>
                      {prop.acciones.map((a, i) => (
                        <label key={i} className="flex items-start gap-2 text-sm bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 cursor-pointer">
                          <input type="checkbox" checked={elegidas.has(i)} className="mt-1"
                            onChange={() => setElegidas(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                          <span className="min-w-0">
                            {a.texto}
                            <span className="block text-[11px] text-[#7f8a9c]">{a.responsable || 'Sin responsable'} · {a.fechaLimite || 'Sin fecha'}</span>
                          </span>
                        </label>
                      ))}
                    </div>
              )}
              {prop.cambios && <p className="text-xs text-gray-400"><span className="font-semibold">Qué propongo:</span> {prop.cambios}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => { void aplicar(); }} disabled={prop.destino === 'pendientes' && elegidas.size === 0}
                  className={`${btn} bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-40`}>
                  {prop.destino === 'pendientes' ? `Crear ${elegidas.size} pendiente${elegidas.size === 1 ? '' : 's'}` : prop.destino === 'contenido' ? 'Agregar pestaña' : 'Aplicar a la agenda'}
                </button>
                <button type="button" onClick={() => { setProp(null); }} className={`${btn} text-gray-400 hover:bg-white/[0.06]`}>Descartar</button>
              </div>
              <form className="flex gap-2 pt-1" onSubmit={e => { e.preventDefault(); if (ajuste.trim()) void pedir(ajuste.trim(), prop); }}>
                <input value={ajuste} onChange={e => setAjuste(e.target.value)} placeholder="Pide un ajuste y lo rehago…" className={campo} />
                <Microfono onTexto={x => setAjuste(v => (v.trim() ? v.trim() + ' ' : '') + x)} onError={setError} />
                <button type="submit" disabled={!ajuste.trim()} className={`${btn} border border-white/10 text-gray-200 hover:bg-white/[0.06] disabled:opacity-40`}>Ajustar</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
