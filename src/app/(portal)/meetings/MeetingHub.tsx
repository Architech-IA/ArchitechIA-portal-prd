'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import RichNotes from '../leads/[id]/hub/RichNotes';
import { getDateStrUTC5 } from '@/lib/timezone';

// Hub de la reunion: popup grande para PREPARAR (agenda), TOMAR NOTAS,
// registrar DECISIONES y dar seguimiento a ACCIONES de una reunion. Es
// distinto del popup de "Crear/Editar evento", que solo agenda (titulo,
// fecha, tipo, asistentes, link).

export interface HubMeeting {
  id: string;
  title: string;
  type: string;
  status: string;
  link: string | null;
  location: string | null;
  hub: string | null;
  actaFile: string | null;
  actaFileName: string | null;
}

interface Item { id: string; texto: string }
interface HubData { objetivo: string; puntos: Item[]; notas: string; decisiones: Item[] }
interface Accion {
  id: string; texto: string; responsable: string | null;
  fechaLimite: string | null; estado: 'PENDIENTE' | 'EN_CURSO' | 'HECHA'; backlogItemId: string | null;
}

const EMPTY_HUB: HubData = { objetivo: '', puntos: [], notas: '', decisiones: [] };
const PLANTILLA_DAILY = ['Qué hice desde la última daily', 'Qué haré hoy', 'Bloqueos e impedimentos'];
const uid = () => Math.random().toString(36).slice(2, 10);

function parseHub(raw: string | null): HubData {
  if (!raw) return EMPTY_HUB;
  try {
    const p = JSON.parse(raw);
    const items = (v: unknown): Item[] => Array.isArray(v)
      ? v.map((x: { id?: string; texto?: string }) => ({ id: x?.id || uid(), texto: typeof x?.texto === 'string' ? x.texto : '' }))
      : [];
    return {
      objetivo: typeof p.objetivo === 'string' ? p.objetivo : '',
      puntos: items(p.puntos), notas: typeof p.notas === 'string' ? p.notas : '',
      decisiones: items(p.decisiones),
    };
  } catch { return EMPTY_HUB; }
}

// A nivel de modulo (no dentro del componente) para que React no lo remonte
// en cada render y el cursor no se pierda al escribir.
function AutoArea({ value, onChange, placeholder, disabled, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return (
    <textarea ref={ref} rows={1} value={value} disabled={disabled} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} style={{ overflow: 'hidden' }}
      className={`w-full resize-none bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-orange-500/60 disabled:opacity-60 ${className ?? ''}`} />
  );
}

const ESTADO_ACCION: Record<Accion['estado'], { label: string; cls: string }> = {
  PENDIENTE: { label: 'Pendiente', cls: 'text-gray-300 border-gray-600 bg-gray-700/30' },
  EN_CURSO: { label: 'En curso', cls: 'text-orange-300 border-orange-600/50 bg-orange-900/20' },
  HECHA: { label: 'Hecha', cls: 'text-green-300 border-green-600/50 bg-green-900/20' },
};

type TabKey = 'agenda' | 'notas' | 'decisiones' | 'acciones' | 'archivos';

export default function MeetingHub({ meeting, asistentes, typeLabel, fechaTexto, onClose, onEdit, onToggleStatus, onHubSaved, onActaChanged }: {
  meeting: HubMeeting;
  asistentes: string[];
  typeLabel: string;
  fechaTexto: string;
  onClose: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onHubSaved: (id: string, hub: string) => void;
  onActaChanged: (updated: { id: string; actaFile: string | null; actaFileName: string | null }) => void;
}) {
  const [tab, setTab] = useState<TabKey>('agenda');
  const [hub, setHub] = useState<HubData>(() => parseHub(meeting.hub));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSaved = useRef<string>(JSON.stringify(parseHub(meeting.hub)));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [cargandoAcc, setCargandoAcc] = useState(true);
  const [nuevaAccion, setNuevaAccion] = useState('');
  const [errorAcc, setErrorAcc] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  // Las reuniones completadas se ven en modo lectura (agenda, notas y
  // decisiones); acciones y archivos siguen editables porque el seguimiento
  // continua despues de la reunion.
  const soloLectura = meeting.status === 'COMPLETED';

  async function guardarHub(data: HubData) {
    const json = JSON.stringify(data);
    if (json === lastSaved.current) return;
    setSaveState('saving');
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/hub`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hub: json }),
      });
      if (!res.ok) throw new Error();
      lastSaved.current = json;
      onHubSaved(meeting.id, json);
      setSaveState('saved');
    } catch { setSaveState('error'); }
  }

  // Autoguardado con debounce (no guarda en cada tecla).
  useEffect(() => {
    if (JSON.stringify(hub) === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void guardarHub(hub); }, 900);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/meetings/${meeting.id}/actions`).then(r => r.json())
      .then(d => { if (!cancelled) setAcciones(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancelled) setErrorAcc('No se pudieron cargar las acciones.'); })
      .finally(() => { if (!cancelled) setCargandoAcc(false); });
    return () => { cancelled = true; };
  }, [meeting.id]);

  async function cerrar() {
    if (timer.current) clearTimeout(timer.current);
    await guardarHub(hub);
    onClose();
  }

  async function editarDatos() {
    if (timer.current) clearTimeout(timer.current);
    await guardarHub(hub);
    onEdit();
  }

  async function completarOReabrir() {
    if (timer.current) clearTimeout(timer.current);
    await guardarHub(hub);
    onToggleStatus();
  }

  // ---- Agenda / decisiones (listas simples) ----
  const setItems = (key: 'puntos' | 'decisiones', fn: (prev: Item[]) => Item[]) =>
    setHub(h => ({ ...h, [key]: fn(h[key]) }));

  // ---- Acciones ----
  async function agregarAccion() {
    const texto = nuevaAccion.trim();
    if (!texto) return;
    setErrorAcc('');
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/actions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }),
      });
      if (!res.ok) throw new Error();
      const nueva: Accion = await res.json();
      setAcciones(prev => [...prev, nueva]);
      setNuevaAccion('');
    } catch { setErrorAcc('No se pudo crear la acción.'); }
  }

  async function actualizarAccion(id: string, patch: Partial<Accion> & { fechaLimite?: string | null }) {
    setAcciones(prev => prev.map(a => a.id === id ? { ...a, ...patch } as Accion : a));
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/actions/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setAcciones(prev => prev.map(a => a.id === id ? saved : a));
    } catch { setErrorAcc('No se pudo guardar el cambio de la acción.'); }
  }

  async function borrarAccion(id: string) {
    setAcciones(prev => prev.filter(a => a.id !== id));
    await fetch(`/api/meetings/${meeting.id}/actions/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  // ---- Archivos (acta) ----
  function subirActa(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSubiendo(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch(`/api/meetings/${meeting.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actaFile: reader.result as string, actaFileName: file.name }),
        });
        if (res.ok) onActaChanged(await res.json());
      } finally { setSubiendo(false); }
    };
    reader.readAsDataURL(file);
  }

  async function quitarActa() {
    const res = await fetch(`/api/meetings/${meeting.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actaFile: null, actaFileName: null }),
    });
    if (res.ok) onActaChanged(await res.json());
  }

  const pendientes = acciones.filter(a => a.estado !== 'HECHA').length;
  const TABS: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'agenda', label: 'Agenda', badge: hub.puntos.length || undefined },
    { key: 'notas', label: 'Notas' },
    { key: 'decisiones', label: 'Decisiones', badge: hub.decisiones.length || undefined },
    { key: 'acciones', label: 'Acciones', badge: pendientes || undefined },
    { key: 'archivos', label: 'Archivos', badge: meeting.actaFile ? 1 : undefined },
  ];

  const estadoGuardado = saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? 'Guardado' : saveState === 'error' ? 'Error al guardar' : soloLectura ? 'Solo lectura' : 'Autoguardado activo';
  const btnBase = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={() => { void cerrar(); }}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-5xl h-[88vh] rounded-2xl flex flex-col overflow-hidden relative"
        style={{ background: 'rgba(14,10,28,0.96)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 40px 80px rgba(0,0,0,0.65)' }}>

        {/* Encabezado */}
        <div className="px-6 pt-5 pb-3 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-orange-400 font-semibold">Hub de la reunión</p>
            <h2 className="text-lg font-bold text-white truncate">{meeting.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {fechaTexto} · {typeLabel}{meeting.location ? ` · ${meeting.location}` : ''}
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${soloLectura ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                {soloLectura ? 'Completada' : meeting.status === 'CANCELLED' ? 'Cancelada' : 'Programada'}
              </span>
            </p>
            {asistentes.length > 0 && <p className="text-[11px] text-gray-500 mt-1 truncate">Asistentes: {asistentes.join(', ')}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {meeting.link && (
              <a href={meeting.link} target="_blank" rel="noreferrer"
                className={`${btnBase} text-orange-300 border-orange-600/40 bg-orange-900/20 hover:bg-orange-900/40`}>Unirse</a>
            )}
            <button type="button" onClick={() => { void editarDatos(); }} className={`${btnBase} text-gray-300 border-white/10 hover:bg-white/[0.06]`}>Editar datos</button>
            <button type="button" onClick={() => { void cerrar(); }} title="Cerrar"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.08]">✕</button>
          </div>
        </div>

        {/* Pestañas */}
        <div className="px-6 flex items-center gap-1 border-b border-white/10">
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {t.label}
              {t.badge ? <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300">{t.badge}</span> : null}
            </button>
          ))}
        </div>

        {soloLectura && (tab === 'agenda' || tab === 'notas' || tab === 'decisiones') && (
          <div className="mx-6 mt-3 text-xs text-yellow-300/90 bg-yellow-900/10 border border-yellow-700/40 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
            <span>Reunión completada: agenda, notas y decisiones están en solo lectura. Las acciones y los archivos siguen editables.</span>
            <button type="button" onClick={() => { void completarOReabrir(); }} className="text-orange-300 hover:text-orange-200 font-semibold whitespace-nowrap">Reabrir para editar</button>
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'agenda' && (
            <div className="space-y-5 max-w-3xl">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Objetivo de la reunión</label>
                <AutoArea value={hub.objetivo} disabled={soloLectura} onChange={v => setHub(h => ({ ...h, objetivo: v }))}
                  placeholder="¿Qué tiene que quedar resuelto al terminar?" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-400">Puntos a tratar</label>
                  {!soloLectura && meeting.type === 'INTERNAL_DAILY' && hub.puntos.length === 0 && (
                    <button type="button" onClick={() => setItems('puntos', () => PLANTILLA_DAILY.map(t => ({ id: uid(), texto: t })))}
                      className="text-[11px] text-orange-400 hover:text-orange-300">Usar plantilla Daily</button>
                  )}
                </div>
                <div className="space-y-2">
                  {hub.puntos.length === 0 && <p className="text-xs text-gray-600 italic">Sin puntos todavía.</p>}
                  {hub.puntos.map((p, i) => (
                    <div key={p.id} className="flex items-start gap-2">
                      <span className="text-xs text-gray-500 font-mono mt-2.5 w-5 text-right">{i + 1}.</span>
                      <AutoArea value={p.texto} disabled={soloLectura} placeholder="Punto de agenda"
                        onChange={v => setItems('puntos', prev => prev.map(x => x.id === p.id ? { ...x, texto: v } : x))} />
                      {!soloLectura && (
                        <button type="button" onClick={() => setItems('puntos', prev => prev.filter(x => x.id !== p.id))}
                          className="mt-1.5 w-7 h-7 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/20 flex-shrink-0">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                {!soloLectura && (
                  <button type="button" onClick={() => setItems('puntos', prev => [...prev, { id: uid(), texto: '' }])}
                    className="mt-2 text-xs text-gray-500 hover:text-orange-400">+ Agregar punto</button>
                )}
              </div>
            </div>
          )}

          {tab === 'notas' && (
            <div className="max-w-3xl" {...(soloLectura ? { inert: true } : {})}>
              <RichNotes value={hub.notas} onChange={html => setHub(h => ({ ...h, notas: html }))}
                placeholder="Notas de la reunión: lo que se discute, contexto, ideas…" />
            </div>
          )}

          {tab === 'decisiones' && (
            <div className="max-w-3xl">
              <p className="text-xs text-gray-500 mb-3">Acuerdos tomados en la reunión, uno por línea. Lo que hay que HACER va en Acciones.</p>
              <div className="space-y-2">
                {hub.decisiones.length === 0 && <p className="text-xs text-gray-600 italic">Sin decisiones registradas.</p>}
                {hub.decisiones.map((d, i) => (
                  <div key={d.id} className="flex items-start gap-2">
                    <span className="text-xs text-gray-500 font-mono mt-2.5 w-5 text-right">{i + 1}.</span>
                    <AutoArea value={d.texto} disabled={soloLectura} placeholder="Decisión"
                      onChange={v => setItems('decisiones', prev => prev.map(x => x.id === d.id ? { ...x, texto: v } : x))} />
                    {!soloLectura && (
                      <button type="button" onClick={() => setItems('decisiones', prev => prev.filter(x => x.id !== d.id))}
                        className="mt-1.5 w-7 h-7 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/20 flex-shrink-0">✕</button>
                    )}
                  </div>
                ))}
              </div>
              {!soloLectura && (
                <button type="button" onClick={() => setItems('decisiones', prev => [...prev, { id: uid(), texto: '' }])}
                  className="mt-2 text-xs text-gray-500 hover:text-orange-400">+ Agregar decisión</button>
              )}
            </div>
          )}

          {tab === 'acciones' && (
            <div className="max-w-4xl">
              <div className="flex gap-2 mb-4">
                <input value={nuevaAccion} onChange={e => setNuevaAccion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void agregarAccion(); } }}
                  placeholder="Nueva acción (Enter para agregar)"
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-orange-500/60" />
                <button type="button" onClick={() => { void agregarAccion(); }} disabled={!nuevaAccion.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-40">Agregar</button>
              </div>
              {errorAcc && <p className="text-xs text-red-400 mb-2">{errorAcc}</p>}
              {cargandoAcc && <p className="text-xs text-gray-500">Cargando…</p>}
              {!cargandoAcc && acciones.length === 0 && <p className="text-xs text-gray-600 italic">Sin acciones todavía.</p>}
              <div className="space-y-2">
                {acciones.map(a => (
                  <div key={a.id} className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
                    <select value={a.estado} onChange={e => { void actualizarAccion(a.id, { estado: e.target.value as Accion['estado'] }); }}
                      className={`text-[11px] font-semibold px-2 py-1 rounded-full border focus:outline-none cursor-pointer bg-transparent ${ESTADO_ACCION[a.estado].cls}`}>
                      {(Object.keys(ESTADO_ACCION) as Accion['estado'][]).map(k => <option key={k} value={k} className="bg-gray-900">{ESTADO_ACCION[k].label}</option>)}
                    </select>
                    <input defaultValue={a.texto} onBlur={e => { const v = e.target.value.trim(); if (v && v !== a.texto) void actualizarAccion(a.id, { texto: v }); }}
                      className={`flex-1 min-w-0 bg-transparent text-sm focus:outline-none ${a.estado === 'HECHA' ? 'text-gray-500 line-through' : 'text-gray-100'}`} />
                    <select value={a.responsable ?? ''} onChange={e => { void actualizarAccion(a.id, { responsable: e.target.value || null }); }}
                      className="text-xs bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-gray-300 focus:outline-none max-w-[160px]">
                      <option value="" className="bg-gray-900">Sin responsable</option>
                      {[...new Set([...asistentes, ...(a.responsable ? [a.responsable] : [])])].map(n => <option key={n} value={n} className="bg-gray-900">{n}</option>)}
                    </select>
                    <input type="date" value={a.fechaLimite ? getDateStrUTC5(a.fechaLimite) : ''}
                      onChange={e => { void actualizarAccion(a.id, { fechaLimite: e.target.value || null }); }}
                      className="text-xs bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-gray-300 focus:outline-none [color-scheme:dark]" />
                    <button type="button" onClick={() => { void borrarAccion(a.id); }} title="Eliminar"
                      className="w-7 h-7 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/20 flex-shrink-0">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'archivos' && (
            <div className="max-w-3xl">
              <p className="text-xs font-semibold text-gray-400 mb-2">Acta de la reunión</p>
              {meeting.actaFile ? (
                <div className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5">
                  <a href={meeting.actaFile} download={meeting.actaFileName || 'acta'} className="text-sm text-orange-300 hover:text-orange-200 truncate">
                    {meeting.actaFileName || 'acta'}
                  </a>
                  <button type="button" onClick={() => { void quitarActa(); }} className="text-xs text-gray-500 hover:text-red-400">Quitar</button>
                </div>
              ) : <p className="text-xs text-gray-600 italic mb-2">Sin acta adjunta.</p>}
              <label className={`mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/20 text-xs text-gray-300 hover:border-orange-500/60 hover:text-orange-300 cursor-pointer ${subiendo ? 'opacity-50 pointer-events-none' : ''}`}>
                {subiendo ? 'Subiendo…' : meeting.actaFile ? 'Reemplazar acta' : 'Adjuntar acta'}
                <input type="file" className="hidden" onChange={subirActa} />
              </label>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between gap-3">
          <span className={`text-[11px] ${saveState === 'error' ? 'text-red-400' : saveState === 'saving' ? 'text-orange-400' : 'text-gray-500'}`}>{estadoGuardado}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { void cerrar(); }} className={`${btnBase} text-gray-300 border-white/10 hover:bg-white/[0.06]`}>Cerrar</button>
            <button type="button" onClick={() => { void completarOReabrir(); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white ${soloLectura ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}>
              {soloLectura ? 'Reabrir reunión' : 'Completar reunión'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
