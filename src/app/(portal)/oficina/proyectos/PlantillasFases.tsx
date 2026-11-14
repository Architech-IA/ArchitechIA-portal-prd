'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, X, Plus, Trash2, RotateCcw, History, Save, Lock, ChevronUp, ChevronDown, Copy, FileText, Link2, Check } from 'lucide-react'
import { ETIQUETA_TIPO, type TipoSesion } from '@/lib/proyectos/tipos'
import { TITULO_DE_TAB } from '../../solutions/pilots/[id]/ArbolArtefactos'
import type { TabKey } from '../../solutions/pilots/[id]/espacio'
import { api, post, put, hace } from './api'
import { FORMATO } from './formatos'

// Editor de las plantillas de fases: objetivo, aprobador y criterios de la puerta, entregables obligatorios (con su verificación) y roles de sesión.
// Lo que se guarda se aplica de inmediato a los proyectos nuevos y a los que ya están en marcha.

interface Verifica { rol?: string; tipo: string; clave?: string; aprobado?: boolean; min_requisitos?: number | null; min?: number; hechas_min?: number; sin_fallidas?: boolean; estados?: string[]; nivel?: string }
interface Requerido { clave: string; titulo: string; ayuda: string; formato: string; verifica: Verifica }
interface Rol { clave: string; titulo: string; tipo: string; objetivo: string; artefactos: string[]; resultado: string; cierre: string[] }
interface Actividad { clave: string; titulo: string; tipo: string; area: string; backlogType: string; prioridad: string; descripcion: string; entregable?: string }
interface FaseEd { clave: string; numero: number; bloque: string; nombre: string; leadStatus: string | null; tipoPuerta: string; objetivo: string; aprobador: string; criterios: string[]; entregables: string[]; requeridos: Requerido[]; sesiones: Rol[]; actividades: Actividad[] }
interface Plantilla { codigo: string; nombre: string; modificada: boolean; version: number; actualizadoPor: string | null; actualizadoEn: string | null; efectiva: FaseEd[]; base: FaseEd[] }
interface Catalogo { rolesFicha: string[]; formatosManuales: string[]; aprobadores: string[]; tiposVerificacion: string[]; tiposSesion: string[]; artefactos: string[]; estadosPropuesta: string[]; documentos: string[]; areas: string[]; tiposTarea: string[]; prioridades: string[] }
interface Datos { puedeEditar: boolean; catalogo: Catalogo; plantillas: Plantilla[] }
interface Hist { id: string; version: number; nota: string | null; usuario: string | null; en: string; fasesEditadas: number }

const APROBADOR: Record<string, string> = { COMERCIAL: 'Responsable comercial', LIDER_PREVENTA: 'Líder de preventa', LIDER_TECNICO: 'Líder técnico', DIRECCION: 'Dirección', LIDER_PROYECTO: 'Líder de proyecto', CLIENTE: 'El cliente', DUENO: 'Dueño de la iniciativa' }
const VERIF: Record<string, string> = {
  nota_lead: 'Notas de la fase en el proyecto', reunion_lead: 'Reunión registrada en el lead', documento: 'Documento (PRD, diseño o plan)', arquitectura: 'Diagrama de arquitectura',
  propuesta: 'Propuesta del lead', tareas: 'Tareas del backlog', despliegue: 'URL de despliegue registrada', manual: 'Archivo o enlace que aporta una persona', documento_fase: 'Documento que se escribe en el portal',
  lead_registrado: 'Lead registrado en el módulo de leads', ficha_cliente: 'Ficha del cliente completa', ficha_contacto: 'Persona identificada en la ficha del cliente',
}
const DOC: Record<string, string> = { prd: 'PRD', diseno: 'Diseño técnico', plan: 'Plan de ejecución' }
const ESTADO_PROP: Record<string, string> = { DRAFT: 'Borrador', SENT: 'Enviada', UNDER_REVIEW: 'En revisión', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada' }
const ROL_FICHA: Record<string, string> = { DECISOR: 'Quién decide la compra', REPRESENTANTE_LEGAL: 'Representante legal', FIRMANTE: 'Quién firma la aceptación y el cierre' }
const AUTO_FORMATO: Record<string, string> = { lead_registrado: 'registro', ficha_cliente: 'ficha', ficha_contacto: 'ficha', nota_lead: 'nota', reunion_lead: 'registro', documento: 'portal', documento_fase: 'doc', arquitectura: 'diagrama', propuesta: 'propuesta', tareas: 'backlog', despliegue: 'url' }
const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const claveDe = (t: string) => (t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'nuevo') + '_' + Math.random().toString(36).slice(2, 5)
const campo = 'w-full rounded-md px-2 py-1.5 text-[12px] text-gray-200 bg-black/30 border border-white/10 outline-none focus:border-indigo-500/50 disabled:opacity-60 [color-scheme:dark]'
const TIPO_TAREA: Record<string, string> = { TASK: 'Tarea', FEATURE: 'Funcionalidad', IMPROVEMENT: 'Mejora', DOCUMENTACION: 'Documentación', TEST_QA: 'Pruebas / QA', INFRAESTRUCTURA: 'Infraestructura', DESARROLLO: 'Desarrollo' }
const PRIORIDAD: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' }
const etiqueta = 'block text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1'

// Qué se entrega y cómo se comprueba, agrupado por quién lo da por bueno
const GRUPOS_RESULTADO: { titulo: string; items: { v: string; t: string; d: string; icono?: 'archivo' | 'enlace' | 'documento' }[] }[] = [
  { titulo: 'Se escribe y se edita en el portal', items: [
    { v: 'documento_fase', t: 'Documento editable', d: 'Actas, informes, planes… Se descarga como Word, PDF, HTML o MD', icono: 'documento' },
  ] },
  { titulo: 'Vive fuera del portal', items: [
    { v: 'manual_enlace', t: 'Enlace externo', d: 'Contrato firmado, Drive u otro sitio; se pega el enlace como evidencia', icono: 'enlace' },
    { v: 'manual_archivo', t: 'Archivo suelto (anterior)', d: 'Solo donde ya se usaba; conviene pasarlo a Documento editable', icono: 'archivo' },
  ] },
  { titulo: 'Se comprueba con lo que hay en el portal', items: [
    { v: 'nota_lead', t: 'Notas de la fase', d: 'Hay una nota escrita en el proyecto' },
    { v: 'documento', t: 'PRD, diseño o plan', d: 'Los documentos propios del proyecto' },
    { v: 'arquitectura', t: 'Diagrama de arquitectura', d: 'Componentes dibujados en el portal' },
    { v: 'propuesta', t: 'Propuesta comercial', d: 'La propuesta del lead en un estado dado' },
    { v: 'tareas', t: 'Tareas del backlog', d: 'Tareas creadas, hechas o sin fallos' },
  ] },
  { titulo: 'Registros del sistema', items: [
    { v: 'reunion_lead', t: 'Reunión registrada', d: 'Una interacción guardada en el lead' },
    { v: 'lead_registrado', t: 'Lead registrado', d: 'Existe en el módulo de leads' },
    { v: 'ficha_cliente', t: 'Ficha del cliente', d: 'Datos esenciales o ficha completa' },
    { v: 'ficha_contacto', t: 'Persona en la ficha', d: 'Quién decide, firma o representa' },
    { v: 'despliegue', t: 'URL de despliegue', d: 'La URL de producción registrada' },
  ] },
]

/** Menú propio (el nativo del navegador no sigue el estilo del portal). */
function SelectorResultado({ valor, onCambio, disponibles, deshabilitado }: { valor: string; onCambio: (v: string) => void; disponibles: string[]; deshabilitado: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAbierto(false) } }
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', tecla, true)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla, true) }
  }, [abierto])
  const grupos = GRUPOS_RESULTADO.map(g => ({ ...g, items: g.items.filter(i => (i.v === 'manual_archivo' ? valor === 'manual_archivo' : i.v.startsWith('manual') || disponibles.includes(i.v))) })).filter(g => g.items.length > 0)
  const actual = grupos.flatMap(g => g.items).find(i => i.v === valor)
  const Icono = ({ k }: { k?: 'archivo' | 'enlace' | 'documento' }) => (k === 'archivo' || k === 'documento' ? <FileText size={12} className="text-amber-300" /> : k === 'enlace' ? <Link2 size={12} className="text-amber-300" /> : null)
  return (
    <div ref={caja} className="relative">
      <button type="button" disabled={deshabilitado} onClick={() => setAbierto(o => !o)} aria-haspopup="listbox" aria-expanded={abierto}
        className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-gray-100 border outline-none disabled:opacity-60"
        style={{ background: 'rgba(0,0,0,0.3)', borderColor: abierto ? 'rgba(249,115,22,0.6)' : 'rgba(255,255,255,0.1)' }}>
        <Icono k={actual?.icono} /><span>{actual?.t ?? 'Elegir…'}</span><ChevronDown size={12} className="text-[#7f8a9c]" />
      </button>
      {abierto && (
        <div role="listbox" className="absolute left-0 top-full mt-1.5 z-30 w-[330px] max-h-[360px] overflow-y-auto rounded-xl" style={{ background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          {grupos.map((g, gi) => (
            <div key={g.titulo} className={gi > 0 ? 'border-t border-white/5' : ''}>
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-[#7f8a9c]">{g.titulo}</p>
              {g.items.map(i => (
                <button type="button" key={i.v} role="option" aria-selected={i.v === valor} onClick={() => { setAbierto(false); if (i.v !== valor) onCambio(i.v) }}
                  className="w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-white/5">
                  <span className="w-3 pt-0.5 flex-shrink-0">{i.v === valor ? <Check size={12} className="text-orange-300" /> : null}</span>
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-[12px] text-gray-100"><Icono k={i.icono} />{i.t}</span><span className="block text-[10px] text-[#7f8a9c] leading-snug">{i.d}</span></span>
                </button>))}
            </div>))}
        </div>)}
    </div>
  )
}

function ListaTextos({ valores, onCambio, vacio, deshabilitado, max = 12 }: { valores: string[]; onCambio: (v: string[]) => void; vacio: string; deshabilitado: boolean; max?: number }) {
  return (
    <div className="space-y-1.5">
      {valores.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input value={v} disabled={deshabilitado} onChange={e => onCambio(valores.map((x, j) => (j === i ? e.target.value : x)))} className={campo} />
          {!deshabilitado && <button onClick={() => onCambio(valores.filter((_, j) => j !== i))} title="Quitar" className="text-[#7f8a9c] hover:text-red-400 flex-shrink-0"><Trash2 size={13} /></button>}
        </div>))}
      {valores.length === 0 && <p className="text-[11px] text-[#7f8a9c]">{vacio}</p>}
      {!deshabilitado && valores.length < max && <button onClick={() => onCambio([...valores, ''])} className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200"><Plus size={11} /> Añadir</button>}
    </div>
  )
}

/** Mover, duplicar, copiar a otra fase y quitar un elemento de una lista. */
function Acciones({ i, total, max, minimo, fases, onSubir, onBajar, onDuplicar, onCopiar, onQuitar }: {
  i: number; total: number; max: number; minimo: number; fases: FaseEd[]
  onSubir: () => void; onBajar: () => void; onDuplicar: () => void; onCopiar: (fase: string) => void; onQuitar: () => void
}) {
  const b = 'p-1 rounded text-[#7f8a9c] hover:text-gray-100 hover:bg-white/10 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-[#7f8a9c]'
  return (
    <span className="flex items-center gap-0.5 flex-shrink-0">
      <button onClick={onSubir} disabled={i === 0} title="Subir" className={b}><ChevronUp size={13} /></button>
      <button onClick={onBajar} disabled={i === total - 1} title="Bajar" className={b}><ChevronDown size={13} /></button>
      <button onClick={onDuplicar} disabled={total >= max} title={total >= max ? `Máximo ${max}` : 'Duplicar'} className={b}><Copy size={12} /></button>
      <select value="" onChange={e => { if (e.target.value) onCopiar(e.target.value) }} title="Copiar a otra fase" className="w-[74px] rounded px-1 py-0.5 text-[10px] text-gray-400 bg-black/30 border border-white/10 outline-none">
        <option value="">Copiar a…</option>{fases.map(f => <option key={f.clave} value={f.clave}>{f.numero}. {f.nombre}</option>)}</select>
      <button onClick={onQuitar} disabled={total <= minimo} title={total <= minimo ? 'Cada fase necesita al menos uno' : 'Quitar'} className={`${b} hover:!text-red-400`}><Trash2 size={13} /></button>
    </span>
  )
}

export default function PlantillasFases({ onCerrar, onCambio, inicial }: { onCerrar: () => void; onCambio: () => void; inicial?: { codigo: string; fase: string } }) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [codigo, setCodigo] = useState(inicial?.codigo ?? 'PROYECTO_COMPLETO')
  const [faseSel, setFaseSel] = useState<string>(inicial?.fase ?? '')
  const [borrador, setBorrador] = useState<Record<string, Record<string, FaseEd>>>({})
  const [nota, setNota] = useState('')
  const [actualizarTareas, setActualizarTareas] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [hist, setHist] = useState<Hist[] | null>(null)
  const [abiertos, setAbiertos] = useState<string[]>([])
  const alternar = (k: string) => setAbiertos(a => a.includes(k) ? a.filter(x => x !== k) : [...a, k])
  const [verHist, setVerHist] = useState(false)

  const cargar = useCallback(async () => {
    try { const d = await api<Datos>('/api/fases/plantillas'); setDatos(d); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las plantillas') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const plantilla = datos?.plantillas.find(p => p.codigo === codigo) ?? null
  useEffect(() => { if (plantilla && !plantilla.efectiva.some(f => f.clave === faseSel)) setFaseSel(plantilla.efectiva[0]?.clave ?? '') }, [plantilla, faseSel])
  const editable = !!datos?.puedeEditar
  const bor = borrador[codigo] ?? {}
  const fase: FaseEd | null = plantilla ? (bor[faseSel] ?? plantilla.efectiva.find(f => f.clave === faseSel) ?? null) : null
  const sucias = useMemo(() => (plantilla ? plantilla.efectiva.filter(f => bor[f.clave] && JSON.stringify(bor[f.clave]) !== JSON.stringify(f)).map(f => f.clave) : []), [plantilla, bor])

  function cambiar(parche: Partial<FaseEd>) {
    if (!fase) return
    setBorrador(b => ({ ...b, [codigo]: { ...(b[codigo] ?? {}), [fase.clave]: { ...fase, ...parche } } }))
  }
  const cambiarReq = (i: number, r: Partial<Requerido>) => cambiar({ requeridos: (fase?.requeridos ?? []).map((x, j) => (j === i ? { ...x, ...r } : x)) })
  const cambiarAct = (i: number, r: Partial<Actividad>) => cambiar({ actividades: (fase?.actividades ?? []).map((x, j) => (j === i ? { ...x, ...r } : x)) })
  const cambiarRol = (i: number, r: Partial<Rol>) => cambiar({ sesiones: (fase?.sesiones ?? []).map((x, j) => (j === i ? { ...x, ...r } : x)) })

  // Reordenar, duplicar y copiar entre fases (entregables y roles)
  type Lista = 'requeridos' | 'sesiones' | 'actividades'
  const MAX: Record<Lista, number> = { requeridos: 8, sesiones: 4, actividades: 6 }
  function mover(k: Lista, i: number, d: -1 | 1) {
    if (!fase) return
    const a = [...fase[k]] as unknown[]; const j = i + d
    if (j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]
    cambiar({ [k]: a } as Partial<FaseEd>)
  }
  function duplicar(k: Lista, i: number) {
    if (!fase || fase[k].length >= MAX[k]) return
    const a = [...fase[k]] as (Requerido | Rol | Actividad)[]
    const o = copia(a[i]); o.clave = claveDe(o.titulo || 'copia'); o.titulo = (o.titulo || 'Sin título') + ' (copia)'
    a.splice(i + 1, 0, o)
    cambiar({ [k]: a } as Partial<FaseEd>)
  }
  /** Añade una copia a otra fase de la misma plantilla (si cabe). */
  function copiarA(k: Lista, i: number, destino: string) {
    if (!fase || !plantilla) return
    const d = bor[destino] ?? plantilla.efectiva.find(f => f.clave === destino)
    if (!d) return
    if (d[k].length >= MAX[k]) { setError(`La fase «${d.nombre}» ya tiene el máximo (${MAX[k]}).`); return }
    const o = copia((fase[k] as (Requerido | Rol | Actividad)[])[i]); o.clave = claveDe(o.titulo || 'copia')
    setError(''); setAviso(`Copiado a «${d.nombre}». Revísalo y guarda.`)
    setBorrador(b => ({ ...b, [codigo]: { ...(b[codigo] ?? {}), [destino]: { ...d, [k]: [...d[k], o] } } }))
  }
  /** Reemplaza los entregables de la fase actual por los de otra fase. */
  function copiarDesde(origen: string) {
    if (!fase || !plantilla) return
    const o = bor[origen] ?? plantilla.efectiva.find(f => f.clave === origen)
    if (!o || !window.confirm(`Se reemplazan los ${fase.requeridos.length} entregable(s) de esta fase por los ${o.requeridos.length} de «${o.nombre}». ¿Continuar?`)) return
    cambiar({ requeridos: copia(o.requeridos).map(r => ({ ...r, clave: claveDe(r.titulo || 'copia') })) })
  }

  async function guardar() {
    if (!plantilla || sucias.length === 0) return
    setGuardando(true); setError(''); setAviso('')
    try {
      const fases: Record<string, unknown> = {}
      for (const k of sucias) { const f = bor[k]; fases[k] = { objetivo: f.objetivo, aprobador: f.aprobador, criterios: f.criterios, entregables: f.entregables, requeridos: f.requeridos, sesiones: f.sesiones, actividades: f.actividades } }
      const r = await put<{ proyectosActualizados: number; tareasActualizadas?: number }>(`/api/fases/plantillas/${codigo}`, { fases, nota: nota.trim() || undefined, actualizarTareas })
      setBorrador(b => ({ ...b, [codigo]: {} })); setNota(''); setHist(null)
      setAviso(`Guardado. ${r.proyectosActualizados} proyecto(s) en marcha actualizado(s)${actualizarTareas ? ` y ${r.tareasActualizadas ?? 0} tarea(s) en cola actualizada(s)` : ''}.`)
      await cargar(); onCambio()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setGuardando(false) }
  }

  async function restaurar(cuerpo: Record<string, unknown>, pregunta: string) {
    if (!window.confirm(pregunta)) return
    setGuardando(true); setError(''); setAviso('')
    try {
      const r = await post<{ proyectosActualizados: number }>(`/api/fases/plantillas/${codigo}/restaurar`, cuerpo)
      setBorrador(b => ({ ...b, [codigo]: {} })); setHist(null)
      setAviso(`Restaurado. ${r.proyectosActualizados} proyecto(s) en marcha actualizado(s).`)
      await cargar(); onCambio()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo restaurar') } finally { setGuardando(false) }
  }

  async function abrirHistorial() {
    setVerHist(o => !o)
    if (!hist) { try { setHist(await api<Hist[]>(`/api/fases/plantillas/${codigo}/historial`)) } catch { setHist([]) } }
  }

  function cerrar() {
    if (sucias.length > 0 && !window.confirm('Hay cambios sin guardar en las plantillas. ¿Cerrar y descartarlos?')) return
    onCerrar()
  }

  const cat = datos?.catalogo
  const conLead = !!fase?.leadStatus && codigo === 'PROYECTO_COMPLETO'
  const comercial = codigo === 'PROYECTO_COMPLETO'
  const dis = !editable || guardando

  /** Formato y verificación del resultado: se eligen en la actividad. */
  function ctrlReq(r: Requerido, i: number) {
    if (!fase || !cat) return null
                        const v = r.verifica
                        const tipos = cat.tiposVerificacion.filter(t => t !== 'reunion_lead' || conLead).filter(t => (t !== 'propuesta' && t !== 'lead_registrado' && t !== 'ficha_cliente' && t !== 'ficha_contacto') || comercial)
                        const cambiarV = (p: Partial<Verifica>) => cambiarReq(i, { verifica: { ...v, ...p } })
                        const nuevoTipo = (t: string) => cambiarReq(i, { ...(t === 'documento_fase' && (!r.ayuda || /notas de la fase/i.test(r.ayuda)) ? { ayuda: 'Escribe el documento en el portal (o pídele un borrador a la IA). Se descarga como Word, PDF, HTML o MD.' } : {}), formato: t === 'manual' ? 'enlace' : AUTO_FORMATO[t] ?? 'enlace', verifica: t === 'documento' ? { tipo: t, clave: 'prd' } : t === 'arquitectura' ? { tipo: t, min: 1 } : t === 'propuesta' ? { tipo: t, estados: ['SENT'] } : t === 'tareas' ? { tipo: t, min: 1, hechas_min: 0, sin_fallidas: false } : t === 'ficha_contacto' ? { tipo: t, rol: 'FIRMANTE' } : { tipo: t } })
    return (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-gray-400">Resultado</span>
                              <SelectorResultado valor={v.tipo === 'manual' ? (r.formato === 'enlace' ? 'manual_enlace' : 'manual_archivo') : v.tipo} deshabilitado={dis} disponibles={tipos}
                                onCambio={t => { if (t === 'manual_archivo') cambiarReq(i, { formato: r.formato !== 'enlace' && v.tipo === 'manual' ? r.formato : 'pdf', verifica: { tipo: 'manual' } }); else if (t === 'manual_enlace') cambiarReq(i, { formato: 'enlace', verifica: { tipo: 'manual' } }); else nuevoTipo(t) }} />
                              {v.tipo === 'manual'
                                ? (r.formato === 'enlace'
                                  ? <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }}>Una persona pega el enlace como evidencia</span>
                                  : <select value={r.formato} disabled={dis} onChange={e => cambiarReq(i, { formato: e.target.value })} title="Formato del archivo: solo se aceptará esa extensión" className={`${campo} !w-auto`}>{[['Documentos', ['pdf', 'pdf_firmado', 'texto', 'hoja']], ['Texto', ['md', 'html', 'txt', 'csv']], ['Otros', ['zip']]].map(([g, fs]) => <optgroup key={g as string} label={g as string}>{(fs as string[]).filter(f => cat.formatosManuales.includes(f)).map(f => <option key={f} value={f}>{FORMATO[f] ?? f}</option>)}</optgroup>)}</select>)
                                : <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }} title="Lo fija la verificación">Formato: {FORMATO[AUTO_FORMATO[v.tipo]] ?? AUTO_FORMATO[v.tipo]}</span>}
                              {v.tipo === 'documento' && (<>
                                <select value={v.clave ?? 'prd'} disabled={dis} onChange={e => cambiarV({ clave: e.target.value })} className={`${campo} !w-auto`}>{cat.documentos.map(d => <option key={d} value={d}>{DOC[d] ?? d}</option>)}</select>
                                <select value={v.aprobado ? 'aprobado' : v.min_requisitos ? 'req' : 'contenido'} disabled={dis} onChange={e => cambiarV({ aprobado: e.target.value === 'aprobado' ? true : undefined, min_requisitos: e.target.value === 'req' ? 1 : null })} className={`${campo} !w-auto`}>
                                  <option value="contenido">Con contenido</option><option value="aprobado">Aprobado</option><option value="req">Con requisitos</option></select>
                                {!!v.min_requisitos && <label className="flex items-center gap-1 text-[11px] text-gray-400">mínimo <input type="number" min={1} max={50} value={v.min_requisitos} disabled={dis} onChange={e => cambiarV({ min_requisitos: Number(e.target.value) || 1 })} className={`${campo} !w-16`} /></label>}
                              </>)}
                              {v.tipo === 'ficha_cliente' && <select value={v.nivel === 'basica' ? 'basica' : 'completa'} disabled={dis} onChange={e => cambiarV({ nivel: e.target.value === 'basica' ? 'basica' : undefined })} title='Cuántos datos de la ficha se exigen' className={`${campo} !w-auto`}><option value='basica'>Datos esenciales (5)</option><option value='completa'>Ficha completa (11)</option></select>}
                              {v.tipo === 'ficha_contacto' && <select value={v.rol ?? 'FIRMANTE'} disabled={dis} onChange={e => cambiarV({ rol: e.target.value })} className={`${campo} !w-auto`}>{cat.rolesFicha.map(x => <option key={x} value={x}>{ROL_FICHA[x] ?? x}</option>)}</select>}
                              {v.tipo === 'arquitectura' && <label className="flex items-center gap-1 text-[11px] text-gray-400">componentes mínimos <input type="number" min={1} max={50} value={v.min ?? 1} disabled={dis} onChange={e => cambiarV({ min: Number(e.target.value) || 1 })} className={`${campo} !w-16`} /></label>}
                              {v.tipo === 'propuesta' && cat.estadosPropuesta.map(e => (
                                <label key={e} className="flex items-center gap-1 text-[11px] text-gray-300 cursor-pointer"><input type="checkbox" disabled={dis} checked={(v.estados ?? []).includes(e)} className="accent-indigo-500"
                                  onChange={x => cambiarV({ estados: x.target.checked ? [...(v.estados ?? []), e] : (v.estados ?? []).filter(y => y !== e) })} />{ESTADO_PROP[e] ?? e}</label>))}
                              {v.tipo === 'tareas' && (<>
                                <label className="flex items-center gap-1 text-[11px] text-gray-400">tareas mín. <input type="number" min={1} value={v.min ?? 1} disabled={dis} onChange={e => cambiarV({ min: Number(e.target.value) || 1 })} className={`${campo} !w-16`} /></label>
                                <label className="flex items-center gap-1 text-[11px] text-gray-400">hechas mín. <input type="number" min={0} value={v.hechas_min ?? 0} disabled={dis} onChange={e => cambiarV({ hechas_min: Math.max(0, Number(e.target.value) || 0) })} className={`${campo} !w-16`} /></label>
                                <label className="flex items-center gap-1 text-[11px] text-gray-300 cursor-pointer"><input type="checkbox" disabled={dis} checked={!!v.sin_fallidas} onChange={e => cambiarV({ sin_fallidas: e.target.checked })} className="accent-indigo-500" />sin fallidas</label>
                              </>)}
                          </div>)
  }
  /** El entregable: nombre y texto de ayuda; el formato y la verificación salen de lo que se eligió en la actividad. */
  function renderReq(r: Requerido, i: number) {
    if (!fase || !cat) return null
                        return (
                          <div key={r.clave} className="rounded-lg p-2.5 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px dashed rgba(255,255,255,0.12)' }}>
                            <div className="flex items-center gap-2">
                              <button onClick={() => alternar(r.clave)} className="text-[10px] uppercase tracking-wide text-[#a5b4fc] flex-shrink-0 w-[68px] text-left">Entregable</button>
                              <input value={r.titulo} disabled={dis} onChange={e => cambiarReq(i, { titulo: e.target.value })} placeholder="Título del entregable" className={`${campo} !text-[13px] !font-semibold`} />
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={r.verifica.tipo === 'manual' ? { background: 'rgba(245,158,11,0.15)', color: '#fcd34d' } : { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }}
                                title={r.verifica.tipo === 'manual' ? 'Una persona lo marca y deja el enlace' : 'El sistema lo comprueba solo'}>{r.verifica.tipo === 'manual' ? 'La marca una persona' : 'Automática'}</span>
                            </div>
                            <div className="space-y-2">
                            <div><span className={etiqueta}>Qué hay que hacer</span>
                              <input value={r.ayuda} disabled={dis} onChange={e => cambiarReq(i, { ayuda: e.target.value })} placeholder="Ayuda: qué hay que hacer para cumplirlo" className={campo} /></div>
                            <p className="text-[11px] text-[#7f8a9c]">Se genera a partir de la actividad · Formato: {FORMATO[r.formato] ?? r.formato} · Se comprueba: {VERIF[r.verifica.tipo] ?? r.verifica.tipo}{r.verifica.tipo === 'manual' ? ' (con enlace como evidencia)' : ''}</p>
                            </div>
                          </div>)
  }
  // Una actividad y su entregable viajan juntos: el orden de los entregables sigue el de las actividades.
  const ordenarReqs = (acts: Actividad[], reqs: Requerido[]) => { const pos = (r: Requerido) => { const k = acts.findIndex(a => a.entregable === r.clave); return k < 0 ? 999 : k }; return [...reqs].sort((x, y) => pos(x) - pos(y)) }
  const reqNuevo = (clave: string): Requerido => ({ clave, titulo: '', ayuda: '', formato: 'enlace', verifica: { tipo: 'manual' } })
  function moverAct(i: number, d: -1 | 1) {
    if (!fase) return
    const a = [...fase.actividades]; const j = i + d
    if (j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]
    cambiar({ actividades: a, requeridos: ordenarReqs(a, fase.requeridos) })
  }
  /** Copia la actividad con su entregable (claves nuevas) para ponerla en una fase. */
  function parDe(a: Actividad, reqs: Requerido[]): { act: Actividad; req?: Requerido } {
    const act = copia(a); act.clave = claveDe(a.titulo || 'copia')
    const orig = reqs.find(r => r.clave === a.entregable)
    if (!orig) { act.entregable = undefined; return { act } }
    const req = copia(orig); req.clave = claveDe(orig.titulo || 'copia'); act.entregable = req.clave
    return { act, req }
  }
  function duplicarAct(i: number) {
    if (!fase || fase.actividades.length >= 6 || fase.requeridos.length >= 8) return
    const { act, req } = parDe(fase.actividades[i], fase.requeridos)
    act.titulo = (act.titulo || 'Sin título') + ' (copia)'; if (req) req.titulo = (req.titulo || 'Sin título') + ' (copia)'
    const a = [...fase.actividades]; a.splice(i + 1, 0, act)
    cambiar({ actividades: a, requeridos: ordenarReqs(a, req ? [...fase.requeridos, req] : fase.requeridos) })
  }
  function copiarAct(i: number, destino: string) {
    if (!fase || !plantilla) return
    const d = bor[destino] ?? plantilla.efectiva.find(f => f.clave === destino)
    if (!d) return
    if (d.actividades.length >= 6 || d.requeridos.length >= 8) { setError(`La fase «${d.nombre}» ya tiene el máximo de actividades o de entregables.`); return }
    const { act, req } = parDe(fase.actividades[i], fase.requeridos)
    setError(''); setAviso(`Copiado a «${d.nombre}» con su entregable. Revísalo y guarda.`)
    setBorrador(b => ({ ...b, [codigo]: { ...(b[codigo] ?? {}), [destino]: { ...d, actividades: [...d.actividades, act], requeridos: req ? [...d.requeridos, req] : d.requeridos } } }))
  }
  function quitarAct(i: number) {
    if (!fase) return
    if (!window.confirm('¿Quitar esta actividad y su entregable de la plantilla? Las tareas que ya existen en el Backlog no se borran y las marcas manuales ya hechas dejan de contar.')) return
    const k = fase.actividades[i].entregable
    cambiar({ actividades: fase.actividades.filter((_, j) => j !== i), requeridos: fase.requeridos.filter(r => r.clave !== k) })
  }
  function añadirAct() {
    if (!fase || !cat || fase.actividades.length >= 6 || fase.requeridos.length >= 8) return
    const k = claveDe('entregable')
    setAbiertos(a => [...a, k])
    cambiar({ actividades: [...fase.actividades, { clave: claveDe('actividad'), titulo: '', tipo: 'HUMANA', area: cat.areas?.[0] ?? 'Sales & Presales', backlogType: 'TASK', prioridad: 'MEDIUM', descripcion: '', entregable: k }], requeridos: [...fase.requeridos, reqNuevo(k)] })
  }
  function crearEntregableDe(i: number) {
    if (!fase || fase.requeridos.length >= 8) return
    const k = claveDe('entregable'); setAbiertos(a => [...a, k])
    const acts = fase.actividades.map((x, j) => (j === i ? { ...x, entregable: k } : x))
    cambiar({ actividades: acts, requeridos: ordenarReqs(acts, [...fase.requeridos, reqNuevo(k)]) })
  }

  return (
    <div className="px-hover" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(20px)', padding: 16 }}>
      <div className="w-full max-w-6xl h-full max-h-[92vh] flex flex-col overflow-hidden" style={{ background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 px-7 py-5 flex-shrink-0" style={{ background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.01em' }}>Plantillas de fases</h2>
          <div className="flex gap-1">
            {datos?.plantillas.map(p => (
              <button key={p.codigo} onClick={() => setCodigo(p.codigo)} className="px-2.5 py-1 rounded-lg text-[11px] transition-colors"
                style={codigo === p.codigo ? { background: 'rgba(249,115,22,0.18)', border: '1px solid rgba(249,115,22,0.5)', color: '#fff' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                {p.codigo === 'PROYECTO_COMPLETO' ? 'Comercial' : 'Interna'}{p.modificada ? ' ·editada' : ''}</button>))}
          </div>
          {!editable && datos && <span className="flex items-center gap-1 text-[11px] text-amber-300"><Lock size={11} /> Solo lectura: editar requiere ser administrador</span>}
          <span className="flex-1" />
          <button onClick={cerrar} title="Cerrar" aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
        </div>

        {!datos && !error && <div className="flex-1 flex items-center justify-center text-[#7f8a9c]"><Loader2 size={18} className="animate-spin" /></div>}
        {error && !datos && <p className="p-5 text-[12px] text-red-300">{error}</p>}

        {datos && plantilla && (
          <div className="flex-1 min-h-0 flex">
            <div className="w-56 flex-shrink-0 border-r border-white/10 overflow-y-auto p-2 space-y-0.5">
              {plantilla.efectiva.map(f => (
                <button key={f.clave} onClick={() => setFaseSel(f.clave)} className="w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] flex items-center gap-2 transition-colors"
                  style={faseSel === f.clave ? { background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#fff' } : { border: '1px solid transparent', color: '#cbd5e1' }}>
                  <span className="text-[10px] opacity-60 w-4">{f.numero}</span><span className="flex-1 truncate">{f.nombre}</span>
                  {sucias.includes(f.clave) && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Cambios sin guardar" />}
                </button>))}
              <div className="pt-3 mt-2 border-t border-white/10 space-y-1">
                <button onClick={() => void abrirHistorial()} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-gray-300 hover:bg-white/5"><History size={12} /> Historial</button>
                {editable && <button disabled={dis || !plantilla.modificada} onClick={() => void restaurar({ base: true }, 'Se vuelve a los valores de fábrica de TODA la plantilla y se actualizan los proyectos en marcha. ¿Continuar?')}
                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-gray-300 hover:bg-white/5 disabled:opacity-40"><RotateCcw size={12} /> Restaurar de fábrica</button>}
              </div>
            </div>

            <div className="flex-1 min-w-0 overflow-y-auto p-5 space-y-5">
              {verHist && (
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className={etiqueta}>Historial de cambios</p>
                  {!hist && <Loader2 size={13} className="animate-spin text-[#7f8a9c]" />}
                  {hist && hist.length === 0 && <p className="text-[11px] text-[#7f8a9c]">Todavía no hay cambios guardados.</p>}
                  {(hist ?? []).map(h => (
                    <div key={h.id} className="flex items-center gap-2 text-[11px] text-gray-300">
                      <span className="text-[#7f8a9c] w-8">v{h.version}</span><span className="flex-1 truncate">{h.nota ?? `${h.fasesEditadas} fase(s) con ajustes`} · {h.usuario ?? '—'} · {hace(h.en)}</span>
                      {editable && <button disabled={dis} onClick={() => void restaurar({ historialId: h.id }, `Se restaura la versión ${h.version} y se actualizan los proyectos en marcha. ¿Continuar?`)} className="text-indigo-300 hover:text-indigo-200 disabled:opacity-40">Restaurar</button>}
                    </div>))}
                </div>)}

              {fase && cat && (
                <>
                  <div>
                    <h3 className="text-[15px] font-bold text-gray-100">{fase.numero}. {fase.nombre} <span className="text-[11px] font-normal text-[#7f8a9c]">· {fase.bloque === 'PREVENTA' ? 'Preventa' : fase.bloque === 'EJECUCION' ? 'Ejecución' : fase.bloque}</span></h3>
                    <p className="text-[11px] text-[#7f8a9c] mt-0.5">Los cambios se aplican a los proyectos nuevos y a los que ya están en esta fase o la tendrán después.</p>
                  </div>

                  <div className="grid md:grid-cols-[1fr_260px] gap-4">
                    <div><label className={etiqueta}>Objetivo de la fase</label><textarea value={fase.objetivo} disabled={dis} onChange={e => cambiar({ objetivo: e.target.value })} rows={2} className={campo} /></div>
                    <div><label className={etiqueta}>Aprueba la fase</label>
                      <select value={fase.aprobador} disabled={dis} onChange={e => cambiar({ aprobador: e.target.value })} className={campo}>{cat.aprobadores.map(a => <option key={a} value={a}>{APROBADOR[a] ?? a}</option>)}</select></div>
                  </div>

                  <div className="grid gap-5">
                    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div>
                        <label className={etiqueta}>Criterios de aprobación (los marca una persona)</label>
                        <ListaTextos valores={fase.criterios} deshabilitado={dis} onCambio={criterios => cambiar({ criterios })} vacio="Debe haber al menos un criterio." />
                      </div>
                      <details className="border-t border-white/5 pt-3">
                        <summary className="text-[10px] uppercase tracking-wide text-[#7f8a9c] cursor-pointer select-none">Qué produce la fase · referencia ({fase.entregables.length})</summary>
                        <div className="mt-2"><ListaTextos valores={fase.entregables} deshabilitado={dis} onCambio={entregables => cambiar({ entregables })} vacio="Sin entregables de referencia." /></div>
                      </details>
                    </div>
                  </div>

                  <div>
                    <label className={etiqueta}>Actividades de la fase y su entregable ({fase.actividades.length}/6)</label>
                    <p className="text-[11px] text-[#7f8a9c] mb-2 leading-snug">Cada actividad produce un entregable, que es lo que se exige para cerrar la fase. Se convierte en una tarea del Backlog cuando el proyecto entra en esta fase: las de agente las ejecuta el Motor y las de persona las hace el equipo. Un cambio aquí vale para las fases que todavía no han empezado; para las tareas ya creadas, marca la opción de abajo al guardar.</p>
                    <div className="space-y-2.5">
                      {fase.actividades.map((a, i) => (
                        <div key={a.clave} className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: 'rgba(249,115,22,0.2)', color: '#fed7aa' }}>{i + 1}</span>
                            <input value={a.titulo} disabled={dis} onChange={e => cambiarAct(i, { titulo: e.target.value })} placeholder="Título de la actividad" className={`${campo} !text-[13px] !font-semibold`} />
                            <select value={a.tipo} disabled={dis} onChange={e => cambiarAct(i, { tipo: e.target.value })} title="Quién la hace" className={`${campo} !w-auto`}><option value="AGENTE">Agente (IA)</option><option value="HUMANA">Persona</option></select>
                            {!dis && <Acciones i={i} total={fase.actividades.length} max={6} minimo={1} fases={plantilla.efectiva.filter(f => f.clave !== fase.clave)}
                              onSubir={() => moverAct(i, -1)} onBajar={() => moverAct(i, 1)} onDuplicar={() => duplicarAct(i)} onCopiar={d => copiarAct(i, d)} onQuitar={() => quitarAct(i)} />}
                          </div>
                          <textarea value={a.descripcion} disabled={dis} onChange={e => cambiarAct(i, { descripcion: e.target.value })} rows={2} placeholder="Qué hay que hacer y cómo se sabe que está hecho" className={campo} />
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-1 text-[11px] text-gray-400">Área <select value={a.area} disabled={dis} onChange={e => cambiarAct(i, { area: e.target.value })} className={`${campo} !w-auto`}>{[...new Set([a.area, ...(cat.areas ?? [])])].map(x => <option key={x} value={x}>{x}</option>)}</select></label>
                            <label className="flex items-center gap-1 text-[11px] text-gray-400">Tipo de tarea <select value={a.backlogType} disabled={dis} onChange={e => cambiarAct(i, { backlogType: e.target.value })} className={`${campo} !w-auto`}>{(cat.tiposTarea ?? []).map(x => <option key={x} value={x}>{TIPO_TAREA[x] ?? x}</option>)}</select></label>
                            <label className="flex items-center gap-1 text-[11px] text-gray-400">Prioridad <select value={a.prioridad} disabled={dis} onChange={e => cambiarAct(i, { prioridad: e.target.value })} className={`${campo} !w-auto`}>{(cat.prioridades ?? []).map(x => <option key={x} value={x}>{PRIORIDAD[x] ?? x}</option>)}</select></label>
                          </div>
                          {(() => { const ri = fase.requeridos.findIndex(r => r.clave === a.entregable); return ri >= 0 ? <>{ctrlReq(fase.requeridos[ri], ri)}{renderReq(fase.requeridos[ri], ri)}</> : (!dis && <button onClick={() => crearEntregableDe(i)} className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200"><Plus size={11} /> Definir el entregable que produce</button>) })()}
                        </div>))}
                      {fase.requeridos.map((r, i) => (fase.actividades.some(a => a.entregable === r.clave) ? null : (
                        <div key={r.clave} className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)' }}>
                          <p className="text-[11px] text-amber-300">Entregable sin actividad: cada entregable debe salir de una actividad. Quítalo o crea la actividad que lo produce.</p>
                          {ctrlReq(r, i)}
                          {renderReq(r, i)}
                          {!dis && <button onClick={() => cambiar({ requeridos: fase.requeridos.filter((_, j) => j !== i) })} className="text-[11px] text-red-300 hover:text-red-200">Quitar este entregable</button>}
                        </div>)))}
                      {!dis && fase.actividades.length < 6 && fase.requeridos.length < 8 && <button onClick={añadirAct} className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200"><Plus size={11} /> Añadir actividad</button>}
                    </div>
                  </div>

                  <div>
                    <label className={etiqueta}>Roles de sesión de la fase ({fase.sesiones.length}/4)</label>
                    <div className="space-y-2.5">
                      {fase.sesiones.map((r, i) => (
                        <div key={r.clave} className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: 'rgba(99,102,241,0.25)', color: '#c7d2fe' }}>{i + 1}</span>
                            <input value={r.titulo} disabled={dis} onChange={e => cambiarRol(i, { titulo: e.target.value })} placeholder="Nombre del rol" className={`${campo} !text-[13px] !font-semibold`} />
                            <select value={r.tipo} disabled={dis} onChange={e => cambiarRol(i, { tipo: e.target.value })} title="Cómo conversa la IA" className={`${campo} !w-auto`}>{cat.tiposSesion.map(t => <option key={t} value={t}>{ETIQUETA_TIPO[t as TipoSesion] ?? t}</option>)}</select>
                            {!dis && <Acciones i={i} total={fase.sesiones.length} max={4} minimo={1} fases={plantilla.efectiva.filter(f => f.clave !== fase.clave)}
                              onSubir={() => mover('sesiones', i, -1)} onBajar={() => mover('sesiones', i, 1)} onDuplicar={() => duplicar('sesiones', i)} onCopiar={d => copiarA('sesiones', i, d)}
                              onQuitar={() => { if (window.confirm('¿Quitar este rol? Las sesiones que ya lo usan dejan de mostrar su lista de cierre.')) cambiar({ sesiones: fase.sesiones.filter((_, j) => j !== i) }) }} />}
                          </div>
                          <input value={r.objetivo} disabled={dis} onChange={e => cambiarRol(i, { objetivo: e.target.value })} placeholder="Objetivo de la sesión" className={campo} />
                          <input value={r.resultado} disabled={dis} onChange={e => cambiarRol(i, { resultado: e.target.value })} placeholder="Resultado esperado" className={campo} />
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] text-[#7f8a9c] uppercase tracking-wide mr-1">Suele tocar</span>
                            {cat.artefactos.map(a => {
                              const on = r.artefactos.includes(a)
                              return <button key={a} disabled={dis} onClick={() => cambiarRol(i, { artefactos: on ? r.artefactos.filter(x => x !== a) : [...r.artefactos, a] })} className="text-[10px] px-1.5 py-0.5 rounded-md"
                                style={on ? { background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.5)', color: '#fed7aa' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#7f8a9c' }}>{TITULO_DE_TAB[a as TabKey] ?? a}</button>
                            })}
                          </div>
                          <div><span className="text-[10px] text-[#7f8a9c] uppercase tracking-wide">Lista de cierre</span><div className="mt-1"><ListaTextos valores={r.cierre} deshabilitado={dis} max={8} onCambio={cierre => cambiarRol(i, { cierre })} vacio="Debe haber al menos un punto." /></div></div>
                        </div>))}
                      {!dis && fase.sesiones.length < 4 && <button onClick={() => cambiar({ sesiones: [...fase.sesiones, { clave: claveDe('rol'), titulo: '', tipo: 'LIBRE', objetivo: '', artefactos: [], resultado: '', cierre: [''] }] })} className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200"><Plus size={11} /> Añadir rol</button>}
                    </div>
                  </div>

                  {editable && (
                    <div className="pt-1">
                      <button disabled={guardando || !plantilla.base.some(b => b.clave === fase.clave)} onClick={() => void restaurar({ fase: fase.clave }, `Esta fase vuelve a sus valores de fábrica y se actualizan los proyectos en marcha. ¿Continuar?`)}
                        className="flex items-center gap-1 text-[11px] text-[#7f8a9c] hover:text-gray-200 disabled:opacity-40"><RotateCcw size={11} /> Restaurar esta fase a los valores de fábrica</button>
                    </div>)}
                </>)}
            </div>
          </div>)}

        {datos && editable && (
          <div className="flex items-center gap-3 px-7 py-4 border-t border-white/10 flex-shrink-0">
            <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota del cambio (opcional)" maxLength={300} className={`${campo} max-w-sm`} />
            <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer flex-shrink-0" title="Cambia también las tareas del Backlog ya creadas a partir de estas actividades, pero SOLO las que siguen en cola y nadie ha editado. Las que están en curso, hechas o editadas no se tocan."><input type="checkbox" checked={actualizarTareas} onChange={e => setActualizarTareas(e.target.checked)} className="accent-orange-500" /> Actualizar también las tareas ya creadas (en cola y sin tocar)</label>
            <span className="flex-1 text-[11px]">{error ? <span className="text-red-300">{error}</span> : aviso ? <span className="text-emerald-300">{aviso}</span> : sucias.length > 0 ? <span className="text-amber-300">{sucias.length} fase(s) con cambios sin guardar</span> : ''}</span>
            <button disabled={sucias.length === 0 || guardando} onClick={() => setBorrador(b => ({ ...b, [codigo]: {} }))} className="text-[11px] px-3 py-1.5 rounded-lg text-gray-300 border border-white/10 disabled:opacity-40">Descartar</button>
            <button disabled={sucias.length === 0 || guardando} onClick={() => void guardar()} className="flex items-center gap-1.5 text-[12px] px-4 py-1.5 rounded-lg text-white font-semibold disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
              {guardando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar y aplicar</button>
          </div>)}
      </div>
    </div>
  )
}
