'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';

// Mismo editor con pestañas del hub de Leads (guarda un JSON { tabs } en hub.notas)
const TabbedNotes = dynamic(() => import('@/components/TabbedNotes'), { ssr: false });
import { getDateStrUTC5, toDatetimeLocalInput } from '@/lib/timezone';
import AgenteReunion, { type Destino } from './AgenteReunion';
import { AGENDA_DAILY } from '@/lib/agendador/plantillas';
import DatosClave, { DATOS_VACIOS, DAILY_LINK, EQUIPO, TIPOS, listaAsistentes, type DatosReunion } from './DatosClave';

// Popup de la reunión (único): sirve para CREAR una reunión y para trabajarla
// después. A la izquierda, pestañas (agenda, contenido, pendientes, archivos);
// a la derecha, la información clave, que se edita ahí mismo.

export interface HubMeeting {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  status: string;
  link: string | null;
  location: string | null;
  attendees?: string | null;
  notes?: string | null;
  hub: string | null;
  actaFile: string | null;
  actaFileName: string | null;
  date: string;
  endDate: string | null;
  createdAt: string;
  user?: { name: string } | null;
}

type UsuarioHub = { id: string; name: string; email: string; role: string };
type ClienteHub = { id: string; nombre: string; contacto: string; email: string };

function datosDe(m: HubMeeting): DatosReunion {
  return {
    title: m.title, description: m.description || '', type: m.type,
    date: toDatetimeLocalInput(m.date), endDate: m.endDate ? toDatetimeLocalInput(m.endDate) : '',
    location: m.location || '', link: m.link || '', attendees: m.attendees || '', status: m.status,
  };
}

// Plantillas rápidas para crear (rellenan tipo, ubicación, enlace, asistentes y agenda base)
const PLANTILLAS_REUNION = [
  { label: 'Daily Intern - ArchitechIA', type: 'INTERNAL_DAILY', location: 'Virtual', link: DAILY_LINK, equipo: true },
];

interface Item { id: string; texto: string }
interface HubData { objetivo: string; puntos: Item[]; notas: string; decisiones: Item[] }
interface Accion {
  id: string; texto: string; responsable: string | null;
  fechaLimite: string | null; estado: 'PENDIENTE' | 'EN_CURSO' | 'HECHA'; backlogItemId: string | null;
}

const EMPTY_HUB: HubData = { objetivo: '', puntos: [], notas: '', decisiones: [] };
const PLANTILLA_DAILY = AGENDA_DAILY;
const uid = () => Math.random().toString(36).slice(2, 10);

// Las pestañas viven en hub.notas como JSON { tabs: [...] } (formato de TabbedNotes).
// Si quedaron 'paginas' de una version previa, se pliegan ahi.
function migrarNotas(notas: string, paginas: unknown): string {
  if (!Array.isArray(paginas) || paginas.length === 0) return notas;
  let tabs: { id: string; name: string; content: string }[] = [];
  try { const v = JSON.parse(notas); if (v && Array.isArray(v.tabs)) tabs = v.tabs; } catch {}
  if (tabs.length === 0) tabs = [{ id: uid(), name: 'General', content: notas }];
  for (const x of paginas as { id?: string; titulo?: string; html?: string }[]) {
    tabs.push({ id: x?.id || uid(), name: typeof x?.titulo === 'string' && x.titulo ? x.titulo : 'Nota', content: typeof x?.html === 'string' ? x.html : '' });
  }
  return JSON.stringify({ tabs });
}

// Texto plano de las notas (sea HTML suelto o el JSON de pestañas)
function textoNotas(raw: string): string {
  let t = raw;
  try { const v = JSON.parse(raw); if (v && Array.isArray(v.tabs)) t = v.tabs.map((x: { content?: string }) => x.content || '').join(' '); } catch {}
  return t.replace(/<[^>]+>/g, '').trim();
}

function parseHub(raw: string | null): HubData {
  if (!raw) return EMPTY_HUB;
  try {
    const p = JSON.parse(raw);
    const items = (v: unknown): Item[] => Array.isArray(v)
      ? v.map((x: { id?: string; texto?: string }) => ({ id: x?.id || uid(), texto: typeof x?.texto === 'string' ? x.texto : '' }))
      : [];
    return {
      objetivo: typeof p.objetivo === 'string' ? p.objetivo : '',
      puntos: items(p.puntos), notas: migrarNotas(typeof p.notas === 'string' ? p.notas : '', p.paginas),
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

export default function MeetingHub({ meeting, crear, users, clientes, onClose, onToggleStatus, onHubSaved, onActaChanged, onMeetingUpdated }: {
  meeting: HubMeeting;
  // Modo crear: la reunión aún no existe. onCrear devuelve el mensaje de error, o null si salió bien.
  crear?: { dia: string; onCrear: (datos: DatosReunion, hub: string) => Promise<string | null> };
  users: UsuarioHub[];
  clientes: ClienteHub[];
  onClose: () => void;
  onToggleStatus: () => void;
  onHubSaved: (id: string, hub: string) => void;
  onActaChanged: (updated: { id: string; actaFile: string | null; actaFileName: string | null }) => void;
  onMeetingUpdated: (m: Record<string, unknown> & { id: string }) => void;
}) {
  const esNuevo = !!crear;
  const [tab, setTab] = useState<TabKey>('agenda');
  const [hub, setHub] = useState<HubData>(() => parseHub(meeting.hub));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSaved = useRef<string>(JSON.stringify(parseHub(meeting.hub)));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Datos clave (título, tipo, fecha, ubicación, enlace, asistentes, estado)
  const [datos, setDatos] = useState<DatosReunion>(() => esNuevo
    ? { ...DATOS_VACIOS, date: `${crear!.dia}T09:00`, link: DAILY_LINK, location: '' }
    : datosDe(meeting));
  const lastDatos = useRef<DatosReunion>(esNuevo ? { ...DATOS_VACIOS } : datosDe(meeting));
  const [errorDatos, setErrorDatos] = useState('');
  const [errorCrear, setErrorCrear] = useState('');
  const [creando, setCreando] = useState(false);
  const [menuEstado, setMenuEstado] = useState(false);
  const [agente, setAgente] = useState<Destino | null>(null);
  const asistentes = useMemo(() => listaAsistentes(datos.attendees).map(a => users.find(u => u.email === a)?.name ?? a), [datos.attendees, users]);
  const typeLabel = TIPOS.find(t => t.value === datos.type)?.label || datos.type;
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [cargandoAcc, setCargandoAcc] = useState(true);
  const [nuevaAccion, setNuevaAccion] = useState('');
  const [errorAcc, setErrorAcc] = useState('');
  // Borrador de acta con IA (null = panel cerrado)
  const [actaBorrador, setActaBorrador] = useState<string | null>(null);
  const [generandoActa, setGenerandoActa] = useState(false);
  const [guardandoActa, setGuardandoActa] = useState(false);
  const [errorActa, setErrorActa] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  // Las reuniones completadas se ven en modo lectura (agenda, notas y
  // decisiones); acciones y archivos siguen editables porque el seguimiento
  // continua despues de la reunion.
  const soloLectura = meeting.status === 'COMPLETED';

  async function guardarHub(data: HubData) {
    if (esNuevo) return; // al crear, la agenda se guarda junto con la reunión
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

  // Datos clave: qué cambió desde lo último guardado
  function cambiosDatos(d: DatosReunion): Partial<DatosReunion> {
    const c: Partial<DatosReunion> = {};
    (Object.keys(d) as (keyof DatosReunion)[]).forEach(k => { if (d[k] !== lastDatos.current[k]) c[k] = d[k]; });
    return c;
  }
  function errorDeDatos(d: DatosReunion): string {
    if (!d.title.trim()) return 'El título es obligatorio';
    if (!d.date) return 'La fecha es obligatoria';
    return '';
  }

  async function guardarDatos(d: DatosReunion) {
    const c = cambiosDatos(d);
    if (Object.keys(c).length === 0) return;
    setSaveState('saving');
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c),
      });
      if (!res.ok) throw new Error();
      lastDatos.current = { ...lastDatos.current, ...c };
      onMeetingUpdated(await res.json());
      setSaveState('saved');
    } catch { setSaveState('error'); }
  }

  // Autoguardado de los datos clave (solo en reuniones ya creadas)
  useEffect(() => {
    if (esNuevo) return;
    if (Object.keys(cambiosDatos(datos)).length === 0) { setErrorDatos(''); return; }
    const e = errorDeDatos(datos);
    setErrorDatos(e);
    if (e) return;
    const t = setTimeout(() => { void guardarDatos(datos); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos]);

  // Si el estado cambia desde fuera (Completar / Reabrir), se refleja en los datos
  useEffect(() => {
    if (esNuevo) return;
    setDatos(d => (d.status === meeting.status ? d : { ...d, status: meeting.status }));
    lastDatos.current = { ...lastDatos.current, status: meeting.status };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.status]);

  useEffect(() => {
    if (esNuevo) { setCargandoAcc(false); return; }
    let cancelled = false;
    fetch(`/api/meetings/${meeting.id}/actions`).then(r => r.json())
      .then(d => { if (!cancelled) setAcciones(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancelled) setErrorAcc('No se pudieron cargar las acciones.'); })
      .finally(() => { if (!cancelled) setCargandoAcc(false); });
    return () => { cancelled = true; };
  }, [meeting.id]);

  // Guarda lo pendiente (agenda/notas y datos clave) antes de cerrar o cambiar de estado
  async function guardarPendiente() {
    if (timer.current) clearTimeout(timer.current);
    await guardarHub(hub);
    if (!errorDeDatos(datos)) await guardarDatos(datos);
  }

  async function cerrar() {
    if (esNuevo) {
      const sucio = !!datos.title.trim() || !!datos.description.trim() || hub.puntos.some(p => p.texto.trim()) || textoNotas(hub.notas).length > 0;
      if (sucio && !window.confirm('¿Descartar la reunión sin crearla?')) return;
      onClose();
      return;
    }
    await guardarPendiente();
    onClose();
  }

  async function completarOReabrir() {
    await guardarPendiente();
    onToggleStatus();
  }

  async function crearReunion() {
    const e = errorDeDatos(datos);
    if (e) { setErrorCrear(e); return; }
    setErrorCrear(''); setCreando(true);
    const err = await crear!.onCrear(datos, JSON.stringify(hub));
    setCreando(false);
    if (err) setErrorCrear(err);
  }

  // Plantilla rápida (solo al crear)
  function aplicarPlantilla(p: typeof PLANTILLAS_REUNION[number]) {
    setDatos(d => ({ ...d, title: p.label, type: p.type, location: p.location, link: p.link, attendees: p.equipo ? EQUIPO.join(', ') : d.attendees }));
    setHub(h => (h.puntos.length === 0 && p.type === 'INTERNAL_DAILY' ? { ...h, puntos: PLANTILLA_DAILY.map(t => ({ id: uid(), texto: t })) } : h));
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

  // ---- Agente Documentador ----
  const botonAgente = (destino: Destino, texto: string) => (
    <button type="button" onClick={() => setAgente(destino)}
      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full cursor-pointer border border-orange-400/25 bg-orange-400/[0.08] text-orange-400 transition-all duration-150 hover:bg-orange-400/20 hover:border-orange-400/60 hover:text-orange-300 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      {texto}
    </button>
  );
  const estadoParaAgente = () => ({ datos: { ...datos, typeLabel } as Record<string, string>, hub: JSON.stringify(hub) });
  function aplicarAgenda(objetivo: string, puntos: string[], modo: 'reemplazar' | 'anadir') {
    if (objetivo) setDatos(d => ({ ...d, description: objetivo }));
    const nuevos = puntos.map(t => ({ id: uid(), texto: t }));
    setHub(h => ({ ...h, puntos: modo === 'anadir' ? [...h.puntos, ...nuevos] : nuevos }));
  }
  function aplicarContenido(titulo: string, html: string) {
    setHub(h => {
      let tabs: { id: string; name: string; content: string }[] = [];
      try { const v = JSON.parse(h.notas); if (v && Array.isArray(v.tabs)) tabs = v.tabs; } catch {}
      if (tabs.length === 0 && h.notas.trim()) tabs = [{ id: uid(), name: 'General', content: h.notas }];
      return { ...h, notas: JSON.stringify({ tabs: [...tabs, { id: uid(), name: titulo, content: html }] }) };
    });
    setTab('notas');
  }
  async function crearAcciones(lista: { texto: string; responsable: string; fechaLimite: string }[]) {
    for (const a of lista) {
      try {
        const res = await fetch(`/api/meetings/${meeting.id}/actions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: a.texto, responsable: a.responsable || null, fechaLimite: a.fechaLimite || null }),
        });
        if (res.ok) { const nueva: Accion = await res.json(); setAcciones(prev => [...prev, nueva]); }
      } catch { setErrorAcc('No se pudieron crear todas las acciones.'); }
    }
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

  async function generarActa() {
    setGenerandoActa(true); setErrorActa(null);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/acta-generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hub: JSON.stringify(hub), asistentes, typeLabel }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.texto) throw new Error(d.error || 'No se pudo generar el acta');
      setActaBorrador(d.texto);
    } catch (e) {
      setErrorActa(e instanceof Error ? e.message : 'No se pudo generar el acta');
    } finally { setGenerandoActa(false); }
  }

  // Convierte el borrador (# titulo, ## seccion, - item) en un PDF y lo adjunta como acta
  async function guardarActaPdf() {
    if (!actaBorrador?.trim()) return;
    if (meeting.actaFile && !window.confirm('Ya hay un acta adjunta. ¿Reemplazarla por esta?')) return;
    setGuardandoActa(true); setErrorActa(null);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
      const M = 56, ancho = W - M * 2;
      let y = 64;
      // Las fuentes estandar de jsPDF solo cubren Latin-1: se normalizan comillas, guiones, etc.
      const limpiar = (t: string) => t
        .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-')
        .replace(/\u2026/g, '...').replace(/[\u2022\u00B7]/g, '-').replace(/\u2192/g, '->')
        .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '');
      const escribir = (txt: string, x: number, w: number, size: number, bold: boolean, salto: number) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
        for (const l of doc.splitTextToSize(limpiar(txt), w) as string[]) {
          if (y > H - 64) { doc.addPage(); y = 64; }
          doc.text(l, x, y); y += salto;
        }
      };
      for (const raw of actaBorrador.split('\n')) {
        const l = raw.trimEnd();
        if (!l.trim()) { y += 6; continue; }
        if (l.startsWith('## ')) {
          y += 8; doc.setTextColor(194, 65, 12);
          escribir(l.slice(3), M, ancho, 12.5, true, 17);
          doc.setTextColor(0); y += 2;
        } else if (l.startsWith('# ')) {
          escribir(l.slice(2), M, ancho, 17, true, 22); y += 4;
        } else if (/^\s*[-*] /.test(l)) {
          if (y > H - 64) { doc.addPage(); y = 64; }
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
          doc.text('-', M + 4, y);
          escribir(l.replace(/^\s*[-*] /, ''), M + 16, ancho - 16, 10.5, false, 14.5);
        } else {
          escribir(l, M, ancho, 10.5, false, 14.5);
        }
      }
      const n = doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) {
        doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
        doc.text(`ArchiTechIA - Acta de reunion - Pagina ${i} de ${n}`, M, H - 32);
      }
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error('No se pudo leer el PDF'));
        r.readAsDataURL(doc.output('blob'));
      });
      const nombre = `Acta - ${meeting.title} - ${getDateStrUTC5(meeting.date)}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actaFile: dataUrl, actaFileName: nombre }),
      });
      if (!res.ok) throw new Error('No se pudo adjuntar el acta');
      onActaChanged(await res.json());
      setActaBorrador(null);
    } catch (e) {
      setErrorActa(e instanceof Error ? e.message : 'No se pudo guardar el acta');
    } finally { setGuardandoActa(false); }
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
  const accPend = acciones.filter(a => a.estado !== 'HECHA');
  const vencida = (a: Accion) => !!a.fechaLimite && a.estado !== 'HECHA' && diaNum(getDateStrUTC5(a.fechaLimite)) < diaNum(hoyStr);
  const vencidas = accPend.filter(vencida).length;
  const hechas = acciones.length - accPend.length;
  const notasConContenido = textoNotas(hub.notas).length > 0;
  const nPuntos = hub.puntos.filter(p => p.texto.trim()).length;
  const checklist: { tab: TabKey; label: string; ok: boolean; detalle: string }[] = [
    { tab: 'agenda', label: 'Agenda', ok: nPuntos > 0, detalle: nPuntos > 0 ? `${nPuntos} punto${nPuntos === 1 ? '' : 's'}` : 'Sin definir' },
    { tab: 'notas', label: 'Contenido', ok: notasConContenido, detalle: notasConContenido ? 'Con contenido' : 'Sin contenido' },
    { tab: 'archivos', label: 'Acta', ok: !!meeting.actaFile, detalle: meeting.actaFile ? (meeting.actaFileName || 'Adjunta') : 'Sin adjuntar' },
  ];
  const TABS: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'agenda', label: 'Agenda', badge: hub.puntos.length || undefined },
    { key: 'notas', label: 'Contenido' },
    { key: 'acciones', label: 'Pendientes', badge: pendientes || undefined },
    { key: 'archivos', label: 'Archivos', badge: meeting.actaFile ? 1 : undefined },
  ];

  const estadoGuardado = errorDatos ? `${errorDatos}: no se guardan los cambios de los datos` : saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? 'Guardado' : saveState === 'error' ? 'Error al guardar' : soloLectura ? 'Solo lectura' : 'Autoguardado activo';
  const btnBase = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)' }}>
      <div
        className="w-full max-w-6xl h-[88vh] rounded-2xl flex flex-col overflow-hidden relative"
        style={{
          background: 'rgba(8,9,22,0.98)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 40px 80px rgba(0,0,0,0.65)',
        }}>
        {/* brillo especular del borde superior */}
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(253,186,116,0.55) 50%, transparent)' }} />

        {/* Encabezado: el título se edita aquí mismo */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.16) 0%, rgba(249,115,22,0.04) 55%, rgba(255,255,255,0.02) 100%)', borderBottom: '1px solid rgba(251,146,60,0.20)' }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
            <input type="text" value={datos.title} onChange={e => { setDatos(d => ({ ...d, title: e.target.value })); setErrorCrear(''); }}
              placeholder={esNuevo ? 'Título de la reunión' : 'Sin título'} aria-label="Título de la reunión" autoFocus={esNuevo}
              className="min-w-0 flex-1 bg-transparent text-lg font-bold text-white placeholder-white/30 truncate focus:outline-none border-b border-dashed border-transparent hover:border-white/20 focus:border-orange-500/60 transition-colors" />
            {!esNuevo && (
              <div className="relative flex-shrink-0">
                <button type="button" onClick={() => setMenuEstado(v => !v)} aria-label="Estado de la reunión" title="Estado de la reunión"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.08] ${soloLectura ? 'text-yellow-300' : 'text-gray-400 hover:text-white'}`}>
                  {soloLectura ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                  )}
                </button>
                {menuEstado && createPortal(
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(3,4,12,0.7)', backdropFilter: 'blur(6px)' }} onMouseDown={e => { if (e.target === e.currentTarget) setMenuEstado(false); }}>
                    <div className="w-full max-w-sm rounded-2xl p-5 space-y-3" style={{ background: 'rgba(8,9,22,0.98)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 40px 80px rgba(0,0,0,0.65)' }}>
                      <p className="text-[11px] font-semibold text-white">Estado de la reunión</p>
                      <p className="text-[11px] text-[#7f8a9c] leading-snug">
                        {soloLectura ? 'Completada: la agenda y las notas están en solo lectura. Los pendientes y los archivos siguen editables.' : 'Mientras no esté completada, la agenda y las notas se pueden editar.'}
                      </p>
                      {[{ v: 'SCHEDULED', t: 'Programada' }, { v: 'COMPLETED', t: 'Completada' }, { v: 'CANCELLED', t: 'Cancelada' }].map(o => (
                        <button key={o.v} type="button" disabled={datos.status === o.v}
                          onClick={() => { void guardarPendiente(); setDatos(d => ({ ...d, status: o.v })); setMenuEstado(false); }}
                          className={`w-full px-2.5 py-1.5 text-xs text-left rounded-lg transition-colors ${datos.status === o.v ? 'bg-orange-600/20 text-orange-300 cursor-default' : 'text-gray-300 hover:bg-white/10'}`}>
                          {o.t}{datos.status === o.v ? ' (actual)' : o.v === 'SCHEDULED' && soloLectura ? ' (reabrir para editar)' : ''}
                        </button>
                      ))}
                      <div className="flex justify-end pt-1">
                        <button type="button" onClick={() => setMenuEstado(false)} className="px-3 py-1.5 text-xs text-gray-300 rounded-lg border border-white/10 hover:bg-white/[0.06]">Cerrar</button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            )}
            </div>
            {esNuevo && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-[#7f8a9c]">Plantillas</span>
                {PLANTILLAS_REUNION.map(p => (
                  <button key={p.label} type="button" onClick={() => aplicarPlantilla(p)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] leading-4 font-medium rounded-full transition-colors hover:bg-orange-500/20"
                    style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)', color: '#fb923c' }}>
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {datos.link && !esNuevo && (
              <a href={datos.link} target="_blank" rel="noreferrer"
                className={`${btnBase} text-orange-300 border-orange-600/40 bg-orange-900/20 hover:bg-orange-900/40`}>Unirse</a>
            )}
            <button type="button" onClick={() => { void cerrar(); }} title="Cerrar" aria-label="Cerrar"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.08]">✕</button>
          </div>
        </div>

        {/* Pestañas (Pendientes y Archivos se activan al crear la reunión) */}
        <div className="px-6 flex items-center gap-1 border-b border-white/10">
          {TABS.map(t => {
            const apagada = esNuevo && (t.key === 'acciones' || t.key === 'archivos');
            return (
              <button key={t.key} type="button" disabled={apagada} onClick={() => setTab(t.key)}
                title={apagada ? 'Se activa al crear la reunión' : undefined}
                className={`px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${apagada ? 'border-transparent text-[#7f8a9c] opacity-40 cursor-not-allowed' : tab === t.key ? 'border-orange-500 text-orange-400' : 'border-transparent text-[#7f8a9c] hover:text-gray-300'}`}>
                {t.label}
                {t.badge ? <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300">{t.badge}</span> : null}
              </button>
            );
          })}
        </div>


        {/* Contenido + widget lateral (el widget es transversal: se ve en todas las pestañas) */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-visible">
        <div className="md:flex-1 min-w-0 md:overflow-y-auto px-6 py-5 shrink-0 md:shrink">
          {tab === 'agenda' && (
            <div className="space-y-5 max-w-3xl">
              {!soloLectura && <div className="flex justify-end -mb-2">{botonAgente('agenda', 'Agente Documentador')}</div>}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Objetivo</label>
                <AutoArea value={datos.description} disabled={soloLectura} placeholder="Para qué es la reunión, en una frase."
                  onChange={v => setDatos(d => ({ ...d, description: v }))} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-400">Puntos a tratar</label>
                  {!soloLectura && datos.type === 'INTERNAL_DAILY' && hub.puntos.length === 0 && (
                    <button type="button" onClick={() => setItems('puntos', () => PLANTILLA_DAILY.map(t => ({ id: uid(), texto: t })))}
                      className="text-[11px] text-orange-400 hover:text-orange-300">Usar plantilla Daily</button>
                  )}
                </div>
                <div className="space-y-2">
                  {hub.puntos.length === 0 && <p className="text-xs text-[#7f8a9c] italic">Sin puntos todavía.</p>}
                  {hub.puntos.map((p, i) => (
                    <div key={p.id} className="flex items-start gap-2">
                      <span className="text-xs text-[#7f8a9c] font-mono mt-2.5 w-5 text-right">{i + 1}.</span>
                      <AutoArea value={p.texto} disabled={soloLectura} placeholder="Punto de agenda"
                        onChange={v => setItems('puntos', prev => prev.map(x => x.id === p.id ? { ...x, texto: v } : x))} />
                      {!soloLectura && (
                        <button type="button" onClick={() => setItems('puntos', prev => prev.filter(x => x.id !== p.id))}
                          className="mt-1.5 w-7 h-7 rounded text-[#7f8a9c] hover:text-red-400 hover:bg-red-900/20 flex-shrink-0">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                {!soloLectura && (
                  <button type="button" onClick={() => setItems('puntos', prev => [...prev, { id: uid(), texto: '' }])}
                    className="mt-2 text-xs text-[#7f8a9c] hover:text-orange-400">+ Agregar punto</button>
                )}
              </div>
              {esNuevo && <p className="text-[11px] text-[#7f8a9c]">Puedes preparar la agenda antes de crear la reunión. Pendientes y Archivos se activan al crearla.</p>}
            </div>
          )}

          {tab === 'notas' && (
            <div className="h-full min-h-[460px] flex flex-col gap-3">
              {!esNuevo && !!meeting.notes?.trim() && textoNotas(hub.notas).length === 0 && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-[11px] text-[#7f8a9c] mb-1">Notas guardadas con el formulario anterior (solo lectura)</p>
                  <p className="text-xs text-gray-300 whitespace-pre-wrap">{meeting.notes}</p>
                </div>
              )}
              {!soloLectura && <div className="flex justify-end">{botonAgente('contenido', 'Resumir con el Agente Documentador')}</div>}
              <div className="flex-1 min-h-0 flex flex-col" {...(soloLectura ? { inert: true } : {})}>
                <TabbedNotes value={hub.notas} onChange={v => setHub(h => ({ ...h, notas: v }))} />
              </div>
            </div>
          )}

          {tab === 'acciones' && (
            <div className="max-w-4xl">
              <div className="flex justify-end mb-2">{botonAgente('pendientes', 'Extraer pendientes con el Agente Documentador')}</div>
              <div className="flex gap-2 mb-4">
                <input value={nuevaAccion} onChange={e => setNuevaAccion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void agregarAccion(); } }}
                  placeholder="Nueva acción (Enter para agregar)"
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-orange-500/60" />
                <button type="button" onClick={() => { void agregarAccion(); }} disabled={!nuevaAccion.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-40">Agregar</button>
              </div>
              {errorAcc && <p className="text-xs text-red-400 mb-2">{errorAcc}</p>}
              {cargandoAcc && <p className="text-xs text-[#7f8a9c]">Cargando…</p>}
              {!cargandoAcc && acciones.length === 0 && <p className="text-xs text-[#7f8a9c] italic">Sin acciones todavía.</p>}
              <div className="space-y-2">
                {acciones.map(a => (
                  <div key={a.id} className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
                    <select value={a.estado} onChange={e => { void actualizarAccion(a.id, { estado: e.target.value as Accion['estado'] }); }}
                      className={`text-[11px] font-semibold px-2 py-1 rounded-full border focus:outline-none cursor-pointer bg-transparent ${ESTADO_ACCION[a.estado].cls}`}>
                      {(Object.keys(ESTADO_ACCION) as Accion['estado'][]).map(k => <option key={k} value={k} className="bg-gray-900">{ESTADO_ACCION[k].label}</option>)}
                    </select>
                    <input defaultValue={a.texto} onBlur={e => { const v = e.target.value.trim(); if (v && v !== a.texto) void actualizarAccion(a.id, { texto: v }); }}
                      className={`flex-1 min-w-0 bg-transparent text-sm focus:outline-none ${a.estado === 'HECHA' ? 'text-[#7f8a9c] line-through' : 'text-gray-100'}`} />
                    <select value={a.responsable ?? ''} onChange={e => { void actualizarAccion(a.id, { responsable: e.target.value || null }); }}
                      className="text-xs bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-gray-300 focus:outline-none max-w-[160px]">
                      <option value="" className="bg-gray-900">Sin responsable</option>
                      {[...new Set([...asistentes, ...(a.responsable ? [a.responsable] : [])])].map(n => <option key={n} value={n} className="bg-gray-900">{n}</option>)}
                    </select>
                    <input type="date" value={a.fechaLimite ? getDateStrUTC5(a.fechaLimite) : ''}
                      onChange={e => { void actualizarAccion(a.id, { fechaLimite: e.target.value || null }); }}
                      className="text-xs bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-gray-300 focus:outline-none [color-scheme:dark]" />
                    <button type="button" onClick={() => { void borrarAccion(a.id); }} title="Eliminar"
                      className="w-7 h-7 rounded text-[#7f8a9c] hover:text-red-400 hover:bg-red-900/20 flex-shrink-0">✕</button>
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
                  <button type="button" onClick={() => { void quitarActa(); }} className="text-xs text-[#7f8a9c] hover:text-red-400">Quitar</button>
                </div>
              ) : <p className="text-xs text-[#7f8a9c] italic mb-2">Sin acta adjunta.</p>}
              <label className={`mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/20 text-xs text-gray-300 hover:border-orange-500/60 hover:text-orange-300 cursor-pointer ${subiendo ? 'opacity-50 pointer-events-none' : ''}`}>
                {subiendo ? 'Subiendo…' : meeting.actaFile ? 'Reemplazar acta' : 'Adjuntar acta'}
                <input type="file" className="hidden" onChange={subirActa} />
              </label>
              <button type="button" onClick={() => { void generarActa(); }} disabled={generandoActa || guardandoActa}
                className="mt-3 ml-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-500/40 bg-orange-500/10 text-xs text-orange-300 hover:bg-orange-500/20 disabled:opacity-50 disabled:cursor-wait">
                {generandoActa ? 'Generando acta…' : actaBorrador !== null ? 'Regenerar con IA' : 'Generar acta con IA'}
              </button>
              {errorActa && <p className="mt-2 text-xs text-red-400">{errorActa}</p>}
              {actaBorrador !== null && (
                <div className="mt-4">
                  <p className="text-[11px] text-[#7f8a9c] mb-1.5">Borrador generado con IA a partir de la agenda, el contenido y los pendientes. Revísalo y edítalo antes de guardar.</p>
                  <textarea value={actaBorrador} onChange={e => setActaBorrador(e.target.value)} rows={20} spellCheck={false}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-100 leading-relaxed focus:outline-none focus:border-orange-500/50 resize-y" />
                  <div className="mt-2 flex items-center gap-2 justify-end">
                    <button type="button" onClick={() => setActaBorrador(null)} disabled={guardandoActa}
                      className="px-3 py-2 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-gray-200">Descartar</button>
                    <button type="button" onClick={() => { void guardarActaPdf(); }} disabled={guardandoActa || !actaBorrador.trim()}
                      className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-xs font-semibold text-black disabled:opacity-50">
                      {guardandoActa ? 'Guardando…' : 'Guardar como acta (PDF)'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="flex w-full md:w-[22.5rem] shrink-0 flex-col gap-5 border-t md:border-t-0 md:border-l border-white/10 md:overflow-y-auto px-4 py-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {/* Información clave (editable) */}
          <section>
            <h4 className="text-[11px] uppercase tracking-wider text-orange-400 font-semibold mb-3">Información clave</h4>
            <DatosClave datos={datos} users={users} clientes={clientes}
              onChange={patch => { setDatos(d => ({ ...d, ...patch })); setErrorCrear(''); }} />
          </section>

          {!esNuevo && (
          <section>
            <h4 className="text-[11px] uppercase tracking-wider text-[#7f8a9c] font-semibold mb-2 flex items-center gap-2">
              Pendientes
              {vencidas > 0 && <span className="text-[11px] normal-case tracking-normal text-red-400 bg-red-500/10 border border-red-600/30 rounded-full px-1.5 py-0.5">{vencidas} vencida{vencidas === 1 ? '' : 's'}</span>}
            </h4>
            <ul className="space-y-1 mb-3">
              {checklist.map(c => (
                <li key={c.tab}>
                  <button type="button" onClick={() => setTab(c.tab)} className="w-full flex items-center gap-2 text-left text-xs rounded-md px-1.5 py-1 hover:bg-white/[0.05]">
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] flex-shrink-0 ${c.ok ? 'bg-green-600/30 border-green-500/60 text-green-300' : 'border-gray-600 text-transparent'}`}>✓</span>
                    <span className={c.ok ? 'text-gray-400' : 'text-gray-200'}>{c.label}</span>
                    <span className="ml-auto text-[11px] text-[#7f8a9c] truncate max-w-[110px]">{c.detalle}</span>
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
            {cargandoAcc && <p className="text-[11px] text-[#7f8a9c]">Cargando…</p>}
            {!cargandoAcc && accPend.length === 0 && <p className="text-[11px] text-[#7f8a9c] italic">{acciones.length ? 'Sin acciones pendientes 🎉' : 'Sin acciones todavía.'}</p>}
            <ul className="space-y-1">
              {accPend.slice(0, 5).map(a => (
                <li key={a.id} className="flex items-start gap-2 text-xs rounded-md px-1.5 py-1 hover:bg-white/[0.05]">
                  <button type="button" onClick={() => { void actualizarAccion(a.id, { estado: 'HECHA' }); }} title="Marcar como hecha"
                    className="mt-0.5 w-4 h-4 rounded border border-gray-600 hover:border-green-400 hover:bg-green-500/20 flex-shrink-0" />
                  <button type="button" onClick={() => setTab('acciones')} className="flex-1 min-w-0 text-left">
                    <span className="block text-gray-200 truncate">{a.texto}</span>
                    <span className="block text-[11px] text-[#7f8a9c] truncate">
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
          )}
        </aside>
        </div>

        {/* Pie */}
        <div className="px-6 py-3 flex items-center justify-between gap-3" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {esNuevo ? (
            <span className={`text-[11px] ${errorCrear ? 'text-red-400' : 'text-[#7f8a9c]'}`}>{errorCrear || 'Obligatorios: título, tipo y fecha'}</span>
          ) : (
            <span className={`text-[11px] ${errorDatos || saveState === 'error' ? 'text-red-400' : saveState === 'saving' ? 'text-orange-400' : 'text-[#7f8a9c]'}`}>{estadoGuardado}</span>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { void cerrar(); }} className={`${btnBase} text-gray-300 border-white/10 hover:bg-white/[0.06]`}>{esNuevo ? 'Cancelar' : 'Cerrar'}</button>
            {esNuevo ? (
              <button type="button" onClick={() => { void crearReunion(); }} disabled={creando}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-60">
                {creando ? 'Creando…' : 'Crear reunión'}
              </button>
            ) : (
              <button type="button" onClick={() => { void completarOReabrir(); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white ${soloLectura ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500'}`}>
                {soloLectura ? 'Reabrir reunión' : 'Completar reunión'}
              </button>
            )}
          </div>
        </div>
      </div>
      {agente && (
        <AgenteReunion destino={agente} meetingId={esNuevo ? undefined : meeting.id} obtener={estadoParaAgente}
          existentes={{ puntos: hub.puntos.filter(p => p.texto.trim()).length }}
          onAplicarAgenda={aplicarAgenda} onAplicarContenido={aplicarContenido} onCrearAcciones={crearAcciones} onCerrar={() => setAgente(null)} />
      )}
    </div>,
    document.body,
  );
}
