'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import RichNotes from '../leads/[id]/hub/RichNotes';
import { getDateStrUTC5, getTimeStrUTC5, getDateFullUTC5 } from '@/lib/timezone';

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
  date: string;
  endDate: string | null;
  createdAt: string;
  user?: { name: string } | null;
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

  // ── Datos del widget lateral (visible en todas las pestañas) ──
  const hoyStr = getDateStrUTC5(new Date());
  const diaNum = (d: string) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000);
  const relativo = (iso: string) => {
    const diff = diaNum(getDateStrUTC5(iso)) - diaNum(hoyStr);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff === -1) return 'Ayer';
    return diff > 0 ? `En ${diff} días` : `Hace ${-diff} días`;
  };
  const corta = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
  const durMin = meeting.endDate ? Math.round((new Date(meeting.endDate).getTime() - new Date(meeting.date).getTime()) / 60000) : 0;
  const durTxt = durMin > 0 ? (durMin >= 60 ? `${Math.floor(durMin / 60)} h${durMin % 60 ? ` ${durMin % 60} min` : ''}` : `${durMin} min`) : null;
  const accPend = acciones.filter(a => a.estado !== 'HECHA');
  const vencida = (a: Accion) => !!a.fechaLimite && a.estado !== 'HECHA' && diaNum(getDateStrUTC5(a.fechaLimite)) < diaNum(hoyStr);
  const vencidas = accPend.filter(vencida).length;
  const proxVenc = [...accPend].filter(a => a.fechaLimite).sort((a, b) => (a.fechaLimite! < b.fechaLimite! ? -1 : 1))[0];
  const hechas = acciones.length - accPend.length;
  const notasConContenido = hub.notas.replace(/<[^>]+>/g, '').trim().length > 0;
  const nPuntos = hub.puntos.filter(p => p.texto.trim()).length;
  const nDecisiones = hub.decisiones.filter(d => d.texto.trim()).length;
  const checklist: { tab: TabKey; label: string; ok: boolean; detalle: string }[] = [
    { tab: 'agenda', label: 'Agenda', ok: nPuntos > 0, detalle: nPuntos > 0 ? `${nPuntos} punto${nPuntos === 1 ? '' : 's'}` : 'Sin definir' },
    { tab: 'notas', label: 'Notas', ok: notasConContenido, detalle: notasConContenido ? 'Con contenido' : 'Sin notas' },
    { tab: 'decisiones', label: 'Decisiones', ok: nDecisiones > 0, detalle: nDecisiones > 0 ? `${nDecisiones} registrada${nDecisiones === 1 ? '' : 's'}` : 'Ninguna' },
    { tab: 'archivos', label: 'Acta', ok: !!meeting.actaFile, detalle: meeting.actaFile ? (meeting.actaFileName || 'Adjunta') : 'Sin adjuntar' },
  ];
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
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)' }}
      onClick={() => { void cerrar(); }}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-6xl h-[88vh] rounded-2xl flex flex-col overflow-hidden relative"
        style={{
          background: 'rgba(14,10,28,0.50)',
          backdropFilter: 'blur(48px) saturate(200%)', WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 40px 80px rgba(0,0,0,0.65), 0 0 60px rgba(249,115,22,0.07)',
        }}>
        {/* brillo especular del borde superior */}
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25) 50%, transparent)' }} />

        {/* Encabezado */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{meeting.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {fechaTexto} · {typeLabel}{meeting.location ? ` · ${meeting.location}` : ''}
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${soloLectura ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                {soloLectura ? 'Completada' : meeting.status === 'CANCELLED' ? 'Cancelada' : 'Programada'}
              </span>
            </p>
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

        {/* Contenido + widget lateral (el widget es transversal: se ve en todas las pestañas) */}
        <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
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

        <aside className="hidden md:flex w-72 shrink-0 flex-col gap-5 border-l border-white/10 overflow-y-auto px-4 py-5" style={{ background: 'rgba(255,255,255,0.035)' }}>
          {/* Información clave */}
          <section>
            <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Información clave</h4>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Tipo</dt><dd className="text-gray-200 text-right">{typeLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Estado</dt>
                <dd><span className={`px-1.5 py-0.5 rounded-full text-[10px] ${soloLectura ? 'bg-green-500/20 text-green-400' : meeting.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {soloLectura ? 'Completada' : meeting.status === 'CANCELLED' ? 'Cancelada' : 'Programada'}</span></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Lugar</dt><dd className="text-gray-200 text-right truncate">{meeting.location || '—'}</dd></div>
              {meeting.user?.name && <div className="flex justify-between gap-3"><dt className="text-gray-500">Organiza</dt><dd className="text-gray-200 text-right truncate">{meeting.user.name}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Asistentes</dt><dd className="text-gray-200">{asistentes.length}</dd></div>
            </dl>
            {asistentes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {asistentes.map(a => <span key={a} className="text-[10px] text-gray-300 bg-white/[0.06] border border-white/10 rounded-full px-2 py-0.5">{a}</span>)}
              </div>
            )}
            {meeting.link && (
              <a href={meeting.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] text-orange-300 hover:text-orange-200 underline underline-offset-2">Abrir enlace de la reunión</a>
            )}
          </section>

          {/* Fechas */}
          <section>
            <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Fechas</h4>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-3 items-center"><dt className="text-gray-500">Reunión</dt>
                <dd className="text-gray-200 text-right">{getDateFullUTC5(meeting.date)} <span className="ml-1 text-[10px] text-orange-300 bg-orange-500/10 border border-orange-600/30 rounded-full px-1.5 py-0.5">{relativo(meeting.date)}</span></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Horario</dt>
                <dd className="text-gray-200 text-right">{getTimeStrUTC5(meeting.date)}{meeting.endDate ? ` — ${getTimeStrUTC5(meeting.endDate)}` : ''}{durTxt ? <span className="text-gray-500"> · {durTxt}</span> : null}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Creada</dt><dd className="text-gray-200">{getDateFullUTC5(meeting.createdAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Próx. vencimiento</dt>
                <dd className={proxVenc && vencida(proxVenc) ? 'text-red-400 font-semibold' : 'text-gray-200'}>
                  {proxVenc?.fechaLimite ? `${corta(proxVenc.fechaLimite)} · ${relativo(proxVenc.fechaLimite)}` : '—'}</dd></div>
            </dl>
          </section>

          {/* Pendientes */}
          <section>
            <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2 flex items-center gap-2">
              Pendientes
              {vencidas > 0 && <span className="text-[10px] normal-case tracking-normal text-red-400 bg-red-500/10 border border-red-600/30 rounded-full px-1.5 py-0.5">{vencidas} vencida{vencidas === 1 ? '' : 's'}</span>}
            </h4>
            <ul className="space-y-1 mb-3">
              {checklist.map(c => (
                <li key={c.tab}>
                  <button type="button" onClick={() => setTab(c.tab)} className="w-full flex items-center gap-2 text-left text-xs rounded-md px-1.5 py-1 hover:bg-white/[0.05]">
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] flex-shrink-0 ${c.ok ? 'bg-green-600/30 border-green-500/60 text-green-300' : 'border-gray-600 text-transparent'}`}>✓</span>
                    <span className={c.ok ? 'text-gray-400' : 'text-gray-200'}>{c.label}</span>
                    <span className="ml-auto text-[10px] text-gray-500 truncate max-w-[110px]">{c.detalle}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
              <button type="button" onClick={() => setTab('acciones')} className="hover:text-orange-300">Acciones</button>
              <span>{hechas}/{acciones.length} hechas</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden mb-2">
              <div className="h-full bg-green-500/70 transition-all" style={{ width: acciones.length ? `${Math.round((hechas / acciones.length) * 100)}%` : '0%' }} />
            </div>
            {cargandoAcc && <p className="text-[11px] text-gray-500">Cargando…</p>}
            {!cargandoAcc && accPend.length === 0 && <p className="text-[11px] text-gray-500 italic">{acciones.length ? 'Sin acciones pendientes 🎉' : 'Sin acciones todavía.'}</p>}
            <ul className="space-y-1">
              {accPend.slice(0, 5).map(a => (
                <li key={a.id} className="flex items-start gap-2 text-xs rounded-md px-1.5 py-1 hover:bg-white/[0.05]">
                  <button type="button" onClick={() => { void actualizarAccion(a.id, { estado: 'HECHA' }); }} title="Marcar como hecha"
                    className="mt-0.5 w-4 h-4 rounded border border-gray-600 hover:border-green-400 hover:bg-green-500/20 flex-shrink-0" />
                  <button type="button" onClick={() => setTab('acciones')} className="flex-1 min-w-0 text-left">
                    <span className="block text-gray-200 truncate">{a.texto}</span>
                    <span className="block text-[10px] text-gray-500 truncate">
                      {a.responsable || 'Sin responsable'}
                      {a.fechaLimite && <span className={vencida(a) ? 'text-red-400' : ''}> · {corta(a.fechaLimite)}{vencida(a) ? ' (vencida)' : ''}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {accPend.length > 5 && (
              <button type="button" onClick={() => setTab('acciones')} className="mt-1.5 text-[11px] text-orange-300 hover:text-orange-200">Ver las {accPend.length} pendientes →</button>
            )}
          </section>
        </aside>
        </div>

        {/* Pie */}
        <div className="px-6 py-3 flex items-center justify-between gap-3" style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.10)' }}>
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
