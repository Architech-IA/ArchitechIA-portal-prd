'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Sliders, LayoutGrid, FileText, Calendar, Code2,
  Loader2, FolderGit2, ExternalLink, Upload, Eye, Code, Wand2, List, BarChart3,
  Trash2, Save, Plus, ListPlus, AlertTriangle, Flag, ClipboardList, Play,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, Printer,
  Sparkles, X, Minimize2, Languages, CheckCircle2, Lightbulb,
} from 'lucide-react'
import ArchitectureCanvas, { type ArchNode, type ArchConnection } from '@/components/ArchitectureCanvas'
import PlanVisualView from '@/components/PlanVisualView'
import CronogramaTimeline from '@/components/CronogramaTimeline'
import { extractStepsFromPlan } from '@/lib/planUtils'
import { useSetPageTitle } from '@/lib/pageTitleContext'

const ESTADOS = ['ACTIVO', 'EN_DESARROLLO', 'PENDIENTE', 'PAUSADO', 'FINALIZADO']
const ESTADOS_FASE = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA']

interface LeadOption {
  id: string
  companyName: string
  contactName: string
  solucion: { id: string } | null
}

interface FaseCronograma {
  id: string
  fase: string
  fechaInicio: string
  fechaFin: string
  estado: string
  backlogItemId?: string
  resultado?: string
  fechaEjecucion?: string
  horaEjecucion?: string
  horaFin?: string
}

const ESTADO_A_BACKLOG: Record<string, string> = {
  PENDIENTE: 'BACKLOG',
  EN_CURSO: 'IN_PROGRESS',
  COMPLETADA: 'DONE',
}

interface Riesgo {
  id: string
  titulo: string
  descripcion: string | null
  severidad: string
  probabilidad: string
  mitigacion: string | null
  estado: string
  responsable: string | null
}
const SEVERIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA']
const PROBABILIDADES = ['BAJA', 'MEDIA', 'ALTA']
const ESTADOS_RIESGO = ['ABIERTO', 'MITIGADO', 'CERRADO']
const SEVERIDAD_COLOR: Record<string, string> = {
  BAJA: 'text-gray-400 border-gray-700', MEDIA: 'text-yellow-400 border-yellow-700/50',
  ALTA: 'text-orange-400 border-orange-700/50', CRITICA: 'text-red-400 border-red-700/50',
}

interface Hito {
  id: string
  titulo: string
  descripcion: string | null
  fechaComprometida: string | null
  fechaReal: string | null
  estado: string
}
const ESTADOS_HITO = ['PENDIENTE', 'CUMPLIDO', 'ATRASADO']
const ESTADO_HITO_COLOR: Record<string, string> = {
  PENDIENTE: 'text-gray-400 border-gray-700', CUMPLIDO: 'text-green-400 border-green-700/50',
  ATRASADO: 'text-red-400 border-red-700/50',
}

// Widget compacto de tareas del backlog para esta Solucion, en el tab PRD —
// no reemplaza el board completo de Backlog (eso vive en Oficina), solo
// muestra el estado de las tareas ya generadas y permite dispararlas sin
// cambiar de tab.
interface TareaBacklog {
  id: string
  taskCode: string | null
  title: string
  status: string
  prdRequisitoId: string | null
}
const ESTADO_TAREA_COLOR: Record<string, string> = {
  BACKLOG: 'text-gray-400 border-gray-700', IN_PROGRESS: 'text-orange-400 border-orange-700/50',
  DONE: 'text-green-400 border-green-700/50', FAILED: 'text-red-400 border-red-700/50',
  BLOCKED: 'text-yellow-400 border-yellow-700/50',
}

// PRD como documento robusto y desglosado (no una seccion de 4 parrafos):
// listas reales por seccion en vez de texto libre, prioridad/estado por
// requisito, requisitos no funcionales aparte de los funcionales, metricas
// como KPIs medibles, y un ciclo de vida propio (Borrador/En revision/
// Aprobado) que condiciona si se puede generar backlog desde este PRD.
type PrioridadRequisito = 'MUST' | 'SHOULD' | 'COULD' | 'WONT'
type EstadoRequisito = 'PROPUESTO' | 'APROBADO' | 'IMPLEMENTADO' | 'VERIFICADO'
type EstadoDocumentoPrd = 'BORRADOR' | 'EN_REVISION' | 'APROBADO'

interface Requisito {
  id: string
  tipo: 'historia' | 'caso_uso'
  texto: string
  criterioAceptacion: string
  prioridad: PrioridadRequisito
  estado: EstadoRequisito
  // Presente una vez que "Generar backlog desde PRD" crea la tarea real
  // asociada — evita duplicar la misma tarea si se aprieta el boton de nuevo.
  backlogItemId?: string
}
interface ItemTexto { id: string; texto: string }
interface Persona { id: string; rol: string; necesidad: string }
interface RequisitoNoFuncional { id: string; categoria: string; texto: string }
interface Metrica { id: string; nombre: string; meta: string; comoSeMide: string }

// Secciones que son simplemente listas de texto — mismo shape (ItemTexto[]),
// mismos handlers genericos (addSimpleItem/updateSimpleItem/removeSimpleItem)
// en vez de duplicar CRUD por cada una.
const SIMPLE_LIST_KEYS = ['objetivosEspecificos', 'dentroDeAlcance', 'fueraDeAlcance', 'supuestos', 'riesgos', 'dependencias', 'preguntasAbiertas'] as const
type SimpleListKey = typeof SIMPLE_LIST_KEYS[number]

interface PrdData {
  estadoDocumento: EstadoDocumentoPrd
  resumenEjecutivo: string
  problema: string
  objetivoGeneral: string
  objetivosEspecificos: ItemTexto[]
  dentroDeAlcance: ItemTexto[]
  fueraDeAlcance: ItemTexto[]
  personas: Persona[]
  requisitos: Requisito[]
  requisitosNoFuncionales: RequisitoNoFuncional[]
  metricas: Metrica[]
  riesgos: ItemTexto[]
  dependencias: ItemTexto[]
  supuestos: ItemTexto[]
  preguntasAbiertas: ItemTexto[]
}
const emptyPrd: PrdData = {
  estadoDocumento: 'BORRADOR',
  resumenEjecutivo: '', problema: '', objetivoGeneral: '',
  objetivosEspecificos: [], dentroDeAlcance: [], fueraDeAlcance: [],
  personas: [], requisitos: [], requisitosNoFuncionales: [], metricas: [],
  riesgos: [], dependencias: [], supuestos: [], preguntasAbiertas: [],
}

// Migra un PRD guardado con el shape viejo (campos de texto libre: objetivo,
// fueraDeAlcance, metricas, riesgos, personas, supuestos como strings) al
// shape nuevo desglosado — sin esto, las Soluciones que ya tenian un PRD
// real guardado (ej. La Promotora Seguros, generado con IA antes de este
// cambio) perderian ese contenido al abrir la pagina.
// El JSON que devuelve el generador de IA nunca trae "id" (no tiene forma
// de saber que nuestro estado de React lo necesita como key) — asignarlo
// aca, una sola vez, evita el bug real que se vio en produccion: items sin
// id terminaban con key={undefined} en los .map(), y React tira "Each
// child in a list should have a unique key prop" para CADA lista poblada
// por la IA (objetivos, alcance, requisitos no funcionales, metricas,
// riesgos, dependencias, supuestos, preguntas, personas).
function migrarPrd(raw: Record<string, unknown>): PrdData {
  const asItemTexto = (v: unknown): ItemTexto[] => {
    if (Array.isArray(v)) {
      return v
        .filter((x): x is { id?: string; texto?: string } => !!x && typeof x === 'object' && 'texto' in x)
        .map(x => ({ id: x.id ?? makeId(), texto: x.texto ?? '' }))
    }
    if (typeof v === 'string' && v.trim()) return [{ id: makeId(), texto: v }]
    return []
  }
  const objetivoViejo = typeof raw.objetivo === 'string' ? raw.objetivo : ''
  const metricasViejas = typeof raw.metricas === 'string' && raw.metricas.trim()
    ? [{ id: makeId(), nombre: 'Meta general', meta: raw.metricas as string, comoSeMide: '' }]
    : []
  const personasViejas = typeof raw.personas === 'string' && raw.personas.trim()
    ? [{ id: makeId(), rol: 'General', necesidad: raw.personas as string }]
    : []
  return {
    estadoDocumento: (raw.estadoDocumento as EstadoDocumentoPrd) ?? 'BORRADOR',
    resumenEjecutivo: escapeIfPlain(typeof raw.resumenEjecutivo === 'string' ? raw.resumenEjecutivo : ''),
    problema: escapeIfPlain(typeof raw.problema === 'string' ? raw.problema : ''),
    objetivoGeneral: escapeIfPlain(typeof raw.objetivoGeneral === 'string' ? raw.objetivoGeneral : objetivoViejo),
    objetivosEspecificos: asItemTexto(raw.objetivosEspecificos),
    dentroDeAlcance: asItemTexto(raw.dentroDeAlcance),
    fueraDeAlcance: asItemTexto(raw.fueraDeAlcance),
    personas: Array.isArray(raw.personas)
      ? (raw.personas as Partial<Persona>[]).map(p => ({ id: p.id ?? makeId(), rol: p.rol ?? '', necesidad: p.necesidad ?? '' }))
      : personasViejas,
    requisitos: Array.isArray(raw.requisitos)
      ? (raw.requisitos as Partial<Requisito>[]).map(r => ({
          id: r.id ?? makeId(),
          tipo: r.tipo === 'caso_uso' ? 'caso_uso' : 'historia',
          texto: escapeIfPlain(r.texto ?? ''),
          criterioAceptacion: escapeIfPlain(r.criterioAceptacion ?? ''),
          prioridad: r.prioridad ?? 'SHOULD',
          estado: r.estado ?? 'PROPUESTO',
          backlogItemId: r.backlogItemId,
        }))
      : [],
    requisitosNoFuncionales: Array.isArray(raw.requisitosNoFuncionales)
      ? (raw.requisitosNoFuncionales as Partial<RequisitoNoFuncional>[]).map(r => ({ id: r.id ?? makeId(), categoria: r.categoria ?? 'otro', texto: r.texto ?? '' }))
      : [],
    metricas: Array.isArray(raw.metricas)
      ? (raw.metricas as Partial<Metrica>[]).map(m => ({ id: m.id ?? makeId(), nombre: m.nombre ?? '', meta: m.meta ?? '', comoSeMide: m.comoSeMide ?? '' }))
      : metricasViejas,
    riesgos: asItemTexto(raw.riesgos),
    dependencias: asItemTexto(raw.dependencias),
    supuestos: asItemTexto(raw.supuestos),
    preguntasAbiertas: asItemTexto(raw.preguntasAbiertas),
  }
}

// Que secciones del PRD tienen sentido segun el tipo de Solucion — no todas
// aplican igual a un PoC de venta (DEMO) que a un proyecto real con cliente.
function prdSeccionesOpcionales(tipo: string) {
  return {
    requisitosNoFuncionales: tipo === 'PROJECT' || tipo === 'PARTNERSHIP',
    metricas: tipo === 'PROJECT' || tipo === 'PARTNERSHIP',
    riesgosYDependencias: tipo === 'PROJECT' || tipo === 'PARTNERSHIP',
    personasYSupuestosYPreguntas: tipo !== 'DEMO',
  }
}

interface FormState {
  nombre: string
  descripcion: string
  // BUG REAL encontrado generalizando esta pagina: handleSave hardcodeaba
  // tipo: 'DEMO' en cada guardado — cualquier Solucion PROJECT/PARTNERSHIP/
  // INTERN que se editara y guardara acá quedaba reclasificada en silencio
  // como DEMO (desaparecia de su listado real y aparecia en Pilots). Ahora
  // se preserva el tipo original cargado, nunca se asume.
  tipo: string
  estado: string
  valorEstimado: string
  leadId: string
  repositorio: string
  planTrabajo: string
}

const emptyForm: FormState = {
  nombre: '', descripcion: '', tipo: 'PROJECT', estado: 'ACTIVO', valorEstimado: '0', leadId: '', repositorio: '', planTrabajo: '',
}

type TabKey = 'general' | 'arquitectura' | 'plan' | 'prd' | 'cronograma' | 'riesgos' | 'cumplimiento' | 'codigo'

const TABS: { key: TabKey; label: string; icon: typeof Sliders }[] = [
  { key: 'general', label: 'General', icon: Sliders },
  { key: 'arquitectura', label: 'Arquitectura', icon: LayoutGrid },
  { key: 'plan', label: 'Plan de Trabajo', icon: FileText },
  { key: 'prd', label: 'PRD', icon: ClipboardList },
  { key: 'cronograma', label: 'Cronograma', icon: Calendar },
  { key: 'riesgos', label: 'Riesgos', icon: AlertTriangle },
  { key: 'cumplimiento', label: 'Cumplimiento', icon: Flag },
  { key: 'codigo', label: 'Código fuente', icon: Code2 },
]

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

// Textarea que crece con el contenido en vez de scrollear adentro de una
// caja chica — asi el PRD se lee como un documento real (Word/Docs), no
// como un formulario con `rows` fijo. Definido a nivel de modulo (no
// adentro del render del tab PRD): un componente redefinido en cada render
// hace que React lo desmonte y remonte en cada tecla, perdiendo el foco.
function AutoTextarea({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={className}
      // Los navegadores le ponen overflow:auto a cualquier textarea por
      // defecto — sin esto, un redondeo de 1px entre scrollHeight y el
      // height que le asignamos alcanza para que aparezca una barra de
      // scroll finita aunque el contenido entero ya se vea. Como este
      // textarea SIEMPRE crece con el contenido, nunca necesita scroll
      // interno propio.
      style={{ overflow: 'hidden' }}
    />
  )
}

// Texto plano (recien generado por la IA, o migrado del shape viejo de
// PrdData) que ahora se guarda como HTML editable con formato (bold/
// italic/alineacion). Si ya parece HTML (el usuario ya lo edito con el
// editor rico), se deja tal cual. Si es texto plano, se escapan entidades
// y los saltos de linea se convierten en <br> para que se vea igual que
// antes en el textarea plano.
function escapeIfPlain(s: string): string {
  if (!s) return s
  if (/<[a-z][\s\S]*>/i.test(s)) return s
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
}

// Campo de texto enriquecido (bold/italic/underline/alineacion/tamaño) via
// contentEditable + document.execCommand. Es una API deprecada en el spec
// pero sigue soportada en todos los navegadores evergreen para este set
// acotado de comandos — se prefiere sobre sumar una libreria de editor
// completa (Tiptap) solo para este toolbar chico. Definido a nivel de
// modulo por la misma razon que AutoTextarea: si se redefine en cada
// render, React lo remonta en cada tecla y se pierde el foco/cursor.
function RichTextField({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const lastPushed = useRef(value)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Solo sincroniza si el cambio vino de afuera (ej. "Generar con IA") —
    // nunca mientras el usuario esta escribiendo, o el cursor saltaria al
    // principio del campo en cada tecla.
    if (value !== lastPushed.current && el.innerHTML !== value) {
      el.innerHTML = value
    }
    lastPushed.current = value
  }, [value])
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={() => {
        const html = ref.current?.innerHTML ?? ''
        lastPushed.current = html
        onChange(html)
      }}
      data-placeholder={placeholder}
      className={`${className} empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400`}
    />
  )
}

// document.execCommand actua sobre la seleccion activa del documento, sin
// importar cual RichTextField la contiene — por eso un solo toolbar
// compartido alcanza, no hace falta uno por campo.
function execCmd(cmd: string, value?: string) {
  document.execCommand(cmd, false, value)
}
function stepFontSize(delta: number) {
  const current = Number(document.queryCommandValue('fontSize')) || 3
  execCmd('fontSize', String(Math.min(7, Math.max(1, current + delta))))
}

function RichToolbar() {
  const btnCls = "w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
  // onMouseDown + preventDefault (no onClick): un click normal le saca el
  // foco/seleccion al contentEditable ANTES de que el handler corra,
  // dejando a execCommand sin nada sobre que actuar.
  const on = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn() }
  return (
    <div className="flex items-center gap-0.5 bg-gray-900 border border-gray-700 rounded-lg p-1 print:hidden">
      <button type="button" title="Negrita" onMouseDown={on(() => execCmd('bold'))} className={btnCls}><Bold size={13} /></button>
      <button type="button" title="Cursiva" onMouseDown={on(() => execCmd('italic'))} className={btnCls}><Italic size={13} /></button>
      <button type="button" title="Subrayado" onMouseDown={on(() => execCmd('underline'))} className={btnCls}><Underline size={13} /></button>
      <div className="w-px h-4 bg-gray-700 mx-0.5" />
      <button type="button" title="Alinear izquierda" onMouseDown={on(() => execCmd('justifyLeft'))} className={btnCls}><AlignLeft size={13} /></button>
      <button type="button" title="Centrar" onMouseDown={on(() => execCmd('justifyCenter'))} className={btnCls}><AlignCenter size={13} /></button>
      <button type="button" title="Alinear derecha" onMouseDown={on(() => execCmd('justifyRight'))} className={btnCls}><AlignRight size={13} /></button>
      <button type="button" title="Justificar" onMouseDown={on(() => execCmd('justifyFull'))} className={btnCls}><AlignJustify size={13} /></button>
      <div className="w-px h-4 bg-gray-700 mx-0.5" />
      <button type="button" title="Aumentar tamaño" onMouseDown={on(() => stepFontSize(1))} className={btnCls + ' text-[10px] font-bold w-auto px-1.5'}>A+</button>
      <button type="button" title="Disminuir tamaño" onMouseDown={on(() => stepFontSize(-1))} className={btnCls + ' text-[10px] font-bold w-auto px-1.5'}>A-</button>
    </div>
  )
}

// Opciones del panel lateral de IA por sección del PRD — solo visual por
// ahora (pedido explícito del usuario), sin acción real conectada todavía.
const AI_OPCIONES_SECCION = [
  { id: 'mejorar', label: 'Mejorar redacción', desc: 'Reescribe el texto con un tono más claro y profesional.', icon: Wand2 },
  { id: 'expandir', label: 'Expandir / detallar', desc: 'Agrega más profundidad, contexto y ejemplos concretos.', icon: Sparkles },
  { id: 'resumir', label: 'Resumir', desc: 'Condensa el contenido de esta sección a lo esencial.', icon: Minimize2 },
  { id: 'traducir', label: 'Traducir a inglés', desc: 'Genera una versión en inglés de esta sección.', icon: Languages },
  { id: 'revisar', label: 'Revisar y corregir', desc: 'Corrige gramática, ortografía y consistencia.', icon: CheckCircle2 },
  { id: 'sugerir', label: 'Sugerir alternativas', desc: 'Propone otros enfoques u opciones para esta sección.', icon: Lightbulb },
] as const

export default function SolucionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params.id)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('general')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [archNodes, setArchNodes] = useState<ArchNode[]>([])
  const [archConnections, setArchConnections] = useState<ArchConnection[]>([])
  const [fases, setFases] = useState<FaseCronograma[]>([])
  const [prd, setPrd] = useState<PrdData>(emptyPrd)
  // Snapshot del PRD ya guardado, para el indicador de "cambios sin
  // guardar" dentro del propio documento (el guardado real sigue siendo
  // el boton grande de toda la pagina, este solo avisa si hace falta usarlo).
  const prdSavedSnapshot = useRef<string>(JSON.stringify(emptyPrd))
  const [prdDirty, setPrdDirty] = useState(false)
  useEffect(() => {
    setPrdDirty(JSON.stringify(prd) !== prdSavedSnapshot.current)
  }, [prd])
  // Panel lateral de IA por sección del PRD (estilo blade de Azure/AWS) —
  // por ahora solo visual, las opciones no ejecutan nada todavía.
  const [aiPanel, setAiPanel] = useState<{ n: number; titulo: string } | null>(null)
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [cargandoBacklogMasivo, setCargandoBacklogMasivo] = useState(false)

  const [arquitecturaHtml, setArquitecturaHtml] = useState<string | null>(null)
  const [archView, setArchView] = useState<'canvas' | 'html'>('canvas')

  const [draggiingPlan, setDraggingPlan] = useState(false)
  const [planFileError, setPlanFileError] = useState('')
  const [planView, setPlanView] = useState<'markdown' | 'visual'>('visual')
  const [cronogramaView, setCronogramaView] = useState<'lista' | 'linea'>('linea')
  const planFileInputRef = useRef<HTMLInputElement>(null)
  const htmlFileInputRef = useRef<HTMLInputElement>(null)

  // Riesgos y Cumplimiento son tablas propias (Riesgo/Hito), no un blob JSON
  // dentro de Solucion como el Cronograma — se persisten al toque (crear/
  // editar/borrar pega directo a su API), no dependen del boton Guardar
  // grande de esta pagina.
  const [riesgos, setRiesgos] = useState<Riesgo[]>([])
  const [loadingRiesgos, setLoadingRiesgos] = useState(true)
  const [hitos, setHitos] = useState<Hito[]>([])
  const [loadingHitos, setLoadingHitos] = useState(true)
  const [generandoPrd, setGenerandoPrd] = useState(false)
  const [prdGenError, setPrdGenError] = useState('')
  const [generandoBacklogPrd, setGenerandoBacklogPrd] = useState(false)
  const [backlogPrdError, setBacklogPrdError] = useState('')
  const [tareasBacklog, setTareasBacklog] = useState<TareaBacklog[]>([])
  const [loadingTareasBacklog, setLoadingTareasBacklog] = useState(true)
  const [dispatchingTareaId, setDispatchingTareaId] = useState<string | null>(null)
  const [dispatchTareaError, setDispatchTareaError] = useState('')

  useSetPageTitle(form.nombre || null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/soluciones/${id}`)
        if (res.status === 404) { if (!cancelled) { setNotFound(true); setLoading(false) }; return }
        const s = await res.json()
        if (cancelled) return
        setForm({
          nombre: s.nombre,
          descripcion: s.descripcion || '',
          tipo: s.tipo,
          estado: s.estado,
          valorEstimado: String(s.valorEstimado ?? 0),
          leadId: s.leadId || '',
          repositorio: s.repositorio || '',
          planTrabajo: s.planTrabajo || '',
        })
        setCurrentLeadId(s.leadId || null)
        setArquitecturaHtml(s.arquitecturaHtml || null)
        try {
          const parsedArch = s.arquitectura ? JSON.parse(s.arquitectura) : null
          if (Array.isArray(parsedArch)) {
            setArchNodes(parsedArch)
            setArchConnections([])
          } else if (parsedArch && typeof parsedArch === 'object') {
            setArchNodes(Array.isArray(parsedArch.nodes) ? parsedArch.nodes : [])
            setArchConnections(Array.isArray(parsedArch.connections) ? parsedArch.connections : [])
          } else {
            setArchNodes([])
            setArchConnections([])
          }
        } catch { setArchNodes([]); setArchConnections([]) }
        try { setFases(s.cronograma ? JSON.parse(s.cronograma) : []) } catch { setFases([]) }
        try {
          const parsedPrd = s.prd ? JSON.parse(s.prd) : null
          const cargado = parsedPrd && typeof parsedPrd === 'object' ? migrarPrd(parsedPrd) : emptyPrd
          setPrd(cargado)
          prdSavedSnapshot.current = JSON.stringify(cargado)
        } catch { setPrd(emptyPrd); prdSavedSnapshot.current = JSON.stringify(emptyPrd) }
      } catch {
        setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    async function loadLeads() {
      try {
        const res = await fetch('/api/leads')
        const data = await res.json()
        if (!cancelled) setLeads(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setLeads([])
      } finally {
        if (!cancelled) setLoadingLeads(false)
      }
    }
    async function loadRiesgos() {
      try {
        const res = await fetch(`/api/riesgos?solucionId=${id}`)
        const data = await res.json()
        if (!cancelled) setRiesgos(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setRiesgos([])
      } finally {
        if (!cancelled) setLoadingRiesgos(false)
      }
    }
    async function loadHitos() {
      try {
        const res = await fetch(`/api/hitos?solucionId=${id}`)
        const data = await res.json()
        if (!cancelled) setHitos(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setHitos([])
      } finally {
        if (!cancelled) setLoadingHitos(false)
      }
    }
    async function loadTareasBacklog() {
      try {
        const res = await fetch('/api/backlog')
        const data = await res.json()
        // Solo tareas que nacieron de ESTE PRD (prdRequisitoId real) — no
        // todo el historial de la Solucion. El widget muestra "que genero
        // este documento", no "toda la actividad de este proyecto" (eso ya
        // esta en Oficina > Backlog); mostrar tareas viejas sin relacion al
        // PRD actual confundia mas de lo que ayudaba.
        if (!cancelled) setTareasBacklog(Array.isArray(data) ? data.filter((t: { solucionId?: string; prdRequisitoId?: string | null }) => t.solucionId === id && !!t.prdRequisitoId) : [])
      } catch {
        if (!cancelled) setTareasBacklog([])
      } finally {
        if (!cancelled) setLoadingTareasBacklog(false)
      }
    }
    load()
    loadLeads()
    loadRiesgos()
    loadHitos()
    loadTareasBacklog()
    return () => { cancelled = true }
  }, [id])

  async function dispatchTarea(taskId: string) {
    setDispatchingTareaId(taskId)
    setDispatchTareaError('')
    try {
      const res = await fetch('/api/executor/dispatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'No se pudo disparar la tarea.')
      }
      setTareasBacklog(prev => prev.map(t => t.id === taskId ? { ...t, status: 'IN_PROGRESS' } : t))
    } catch (err: unknown) {
      setDispatchTareaError(err instanceof Error ? err.message : 'Error inesperado al disparar la tarea.')
    } finally {
      setDispatchingTareaId(null)
    }
  }

  function importPlanFile(file: File | undefined) {
    if (!file) return
    const okExt = /\.(md|markdown|txt)$/i.test(file.name)
    if (!okExt) { setPlanFileError('Solo se aceptan archivos .md, .markdown o .txt.'); return }
    setPlanFileError('')
    const reader = new FileReader()
    reader.onload = () => setForm(f => ({ ...f, planTrabajo: String(reader.result || '') }))
    reader.onerror = () => setPlanFileError('No se pudo leer el archivo.')
    reader.readAsText(file)
  }

  function importHtmlFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setArquitecturaHtml(String(reader.result || ''))
    reader.readAsText(file)
  }

  function addFase() {
    setFases(prev => [...prev, { id: makeId(), fase: '', fechaInicio: '', fechaFin: '', estado: 'PENDIENTE' }])
  }
  function updateFase(fid: string, patch: Partial<FaseCronograma>) {
    setFases(prev => prev.map(f => f.id === fid ? { ...f, ...patch } : f))
  }
  function removeFase(fid: string) {
    setFases(prev => prev.filter(f => f.id !== fid))
  }

  function updatePrdField<K extends keyof PrdData>(key: K, value: PrdData[K]) {
    setPrd(prev => ({ ...prev, [key]: value }))
  }

  // Handlers genericos para las 7 secciones que son listas de texto simples
  // (objetivosEspecificos, dentroDeAlcance, fueraDeAlcance, supuestos,
  // riesgos, dependencias, preguntasAbiertas) — mismo shape, mismo CRUD.
  function addSimpleItem(key: SimpleListKey) {
    setPrd(prev => ({ ...prev, [key]: [...prev[key], { id: makeId(), texto: '' }] }))
  }
  function updateSimpleItem(key: SimpleListKey, itemId: string, texto: string) {
    setPrd(prev => ({ ...prev, [key]: prev[key].map(it => it.id === itemId ? { ...it, texto } : it) }))
  }
  function removeSimpleItem(key: SimpleListKey, itemId: string) {
    setPrd(prev => ({ ...prev, [key]: prev[key].filter(it => it.id !== itemId) }))
  }

  function addRequisito() {
    setPrd(prev => ({ ...prev, requisitos: [...prev.requisitos, { id: makeId(), tipo: 'historia', texto: '', criterioAceptacion: '', prioridad: 'SHOULD', estado: 'PROPUESTO' }] }))
  }
  function updateRequisito(rid: string, patch: Partial<Requisito>) {
    setPrd(prev => ({ ...prev, requisitos: prev.requisitos.map(r => r.id === rid ? { ...r, ...patch } : r) }))
  }
  function removeRequisito(rid: string) {
    setPrd(prev => ({ ...prev, requisitos: prev.requisitos.filter(r => r.id !== rid) }))
  }

  function addPersona() {
    setPrd(prev => ({ ...prev, personas: [...prev.personas, { id: makeId(), rol: '', necesidad: '' }] }))
  }
  function updatePersona(pid: string, patch: Partial<Persona>) {
    setPrd(prev => ({ ...prev, personas: prev.personas.map(p => p.id === pid ? { ...p, ...patch } : p) }))
  }
  function removePersona(pid: string) {
    setPrd(prev => ({ ...prev, personas: prev.personas.filter(p => p.id !== pid) }))
  }

  function addRnF() {
    setPrd(prev => ({ ...prev, requisitosNoFuncionales: [...prev.requisitosNoFuncionales, { id: makeId(), categoria: 'performance', texto: '' }] }))
  }
  function updateRnF(rid: string, patch: Partial<RequisitoNoFuncional>) {
    setPrd(prev => ({ ...prev, requisitosNoFuncionales: prev.requisitosNoFuncionales.map(r => r.id === rid ? { ...r, ...patch } : r) }))
  }
  function removeRnF(rid: string) {
    setPrd(prev => ({ ...prev, requisitosNoFuncionales: prev.requisitosNoFuncionales.filter(r => r.id !== rid) }))
  }

  function addMetrica() {
    setPrd(prev => ({ ...prev, metricas: [...prev.metricas, { id: makeId(), nombre: '', meta: '', comoSeMide: '' }] }))
  }
  function updateMetrica(mid: string, patch: Partial<Metrica>) {
    setPrd(prev => ({ ...prev, metricas: prev.metricas.map(m => m.id === mid ? { ...m, ...patch } : m) }))
  }
  function removeMetrica(mid: string) {
    setPrd(prev => ({ ...prev, metricas: prev.metricas.filter(m => m.id !== mid) }))
  }

  // Genera un borrador con IA a partir de nombre/descripcion/tipo/planTrabajo
  // ya guardados en la Solucion. Solo completa las secciones vacias —
  // nunca pisa lo que el usuario ya escribio a mano.
  async function generarPrdConIA() {
    // Guardia contra doble-disparo (doble click antes de que el boton se
    // deshabilite): dos llamadas concurrentes usan el mismo x-opencode-session
    // (fijo por Solucion, no por request) del lado del servidor, y una de
    // las dos puede volver con error mientras la otra si genero contenido —
    // exactamente el caso real reportado (contenido visible + error visible
    // al mismo tiempo).
    if (generandoPrd) return
    setGenerandoPrd(true)
    setPrdGenError('')
    try {
      const res = await fetch(`/api/soluciones/${id}/prd-generate`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo generar el borrador.')
      const draft = migrarPrd((data.prd ?? {}) as Record<string, unknown>)
      setPrd(prev => ({
        estadoDocumento: prev.estadoDocumento,
        resumenEjecutivo: prev.resumenEjecutivo.trim() ? prev.resumenEjecutivo : draft.resumenEjecutivo,
        problema: prev.problema.trim() ? prev.problema : draft.problema,
        objetivoGeneral: prev.objetivoGeneral.trim() ? prev.objetivoGeneral : draft.objetivoGeneral,
        objetivosEspecificos: prev.objetivosEspecificos.length > 0 ? prev.objetivosEspecificos : draft.objetivosEspecificos,
        dentroDeAlcance: prev.dentroDeAlcance.length > 0 ? prev.dentroDeAlcance : draft.dentroDeAlcance,
        fueraDeAlcance: prev.fueraDeAlcance.length > 0 ? prev.fueraDeAlcance : draft.fueraDeAlcance,
        personas: prev.personas.length > 0 ? prev.personas : draft.personas,
        requisitos: prev.requisitos.length > 0 ? prev.requisitos : draft.requisitos,
        requisitosNoFuncionales: prev.requisitosNoFuncionales.length > 0 ? prev.requisitosNoFuncionales : draft.requisitosNoFuncionales,
        metricas: prev.metricas.length > 0 ? prev.metricas : draft.metricas,
        riesgos: prev.riesgos.length > 0 ? prev.riesgos : draft.riesgos,
        dependencias: prev.dependencias.length > 0 ? prev.dependencias : draft.dependencias,
        supuestos: prev.supuestos.length > 0 ? prev.supuestos : draft.supuestos,
        preguntasAbiertas: prev.preguntasAbiertas.length > 0 ? prev.preguntasAbiertas : draft.preguntasAbiertas,
      }))
    } catch (err: unknown) {
      setPrdGenError(err instanceof Error ? err.message : 'Error inesperado al generar el borrador.')
    } finally {
      setGenerandoPrd(false)
    }
  }

  // Crea un BacklogItem real por cada requisito que todavia no tenga uno
  // (evita duplicados via backlogItemId). El link se guarda en prdRequisitoId
  // para que dispatchTask() pueda despues inyectar el criterio de aceptacion
  // real al agente, y el verificador lo use para decidir DONE/FAILED
  // (MASD-0003-0007 / MASD-0004-0004). Igual que "cargar en backlog" del
  // Cronograma: el link queda en memoria hasta que se aprieta "Guardar cambios".
  const PRIORIDAD_A_BACKLOG: Record<PrioridadRequisito, string> = {
    MUST: 'HIGH', SHOULD: 'MEDIUM', COULD: 'LOW', WONT: 'LOW',
  }

  // Solo se puede generar backlog desde un PRD ya Aprobado — evita crear
  // tareas reales de un documento a medio escribir que despues cambia.
  async function generarBacklogDesdePRD() {
    if (prd.estadoDocumento !== 'APROBADO') {
      setBacklogPrdError('El PRD debe estar en estado "Aprobado" antes de generar backlog.')
      return
    }
    setGenerandoBacklogPrd(true)
    setBacklogPrdError('')
    try {
      const pendientes = prd.requisitos.filter(r => !r.backlogItemId)
      for (const r of pendientes) {
        const res = await fetch('/api/backlog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: r.texto.slice(0, 120) || 'Requisito sin título',
            description: `${r.tipo === 'historia' ? 'Historia de usuario' : 'Caso de uso'}: ${r.texto}\n\nCriterio de aceptación: ${r.criterioAceptacion}`,
            type: 'TASK',
            priority: PRIORIDAD_A_BACKLOG[r.prioridad] ?? 'MEDIUM',
            solucionId: id,
            prdRequisitoId: r.id,
          }),
        })
        if (!res.ok) throw new Error('No se pudo crear la tarea para un requisito.')
        const created = await res.json()
        updateRequisito(r.id, { backlogItemId: created.id })
      }
    } catch (err: unknown) {
      setBacklogPrdError(err instanceof Error ? err.message : 'Error inesperado generando el backlog.')
    } finally {
      setGenerandoBacklogPrd(false)
    }
  }

  async function addRiesgo() {
    const res = await fetch('/api/riesgos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solucionId: id, titulo: 'Nuevo riesgo' }),
    })
    if (res.ok) { const nuevo = await res.json(); setRiesgos(prev => [...prev, nuevo]) }
  }
  async function updateRiesgo(rid: string, patch: Partial<Riesgo>) {
    setRiesgos(prev => prev.map(r => r.id === rid ? { ...r, ...patch } : r))
    await fetch(`/api/riesgos/${rid}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
  }
  async function removeRiesgo(rid: string) {
    if (!window.confirm('¿Eliminar este riesgo?')) return
    setRiesgos(prev => prev.filter(r => r.id !== rid))
    await fetch(`/api/riesgos/${rid}`, { method: 'DELETE' })
  }

  async function addHito() {
    const res = await fetch('/api/hitos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solucionId: id, titulo: 'Nuevo hito' }),
    })
    if (res.ok) { const nuevo = await res.json(); setHitos(prev => [...prev, nuevo]) }
  }
  async function updateHito(hid: string, patch: Partial<Hito>) {
    setHitos(prev => prev.map(h => h.id === hid ? { ...h, ...patch } : h))
    await fetch(`/api/hitos/${hid}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
  }
  async function removeHito(hid: string) {
    if (!window.confirm('¿Eliminar este hito?')) return
    setHitos(prev => prev.filter(h => h.id !== hid))
    await fetch(`/api/hitos/${hid}`, { method: 'DELETE' })
  }
  function generarCronogramaDesdePlan() {
    const steps = extractStepsFromPlan(form.planTrabajo)
    if (steps.length === 0) {
      setError('No se encontraron pasos numerados en el Plan de Trabajo.')
      return
    }
    if (fases.length > 0 && !window.confirm(`Esto va a reemplazar las ${fases.length} fase(s) actuales por ${steps.length} fase(s) extraída(s) del plan. ¿Continuar?`)) return
    setError('')
    setFases(steps.map(s => ({ id: makeId(), fase: s, fechaInicio: '', fechaFin: '', estado: 'PENDIENTE' })))
  }

  async function cargarTodasAlBacklog() {
    const pendientes = fases.filter(f => !f.backlogItemId)
    if (pendientes.length === 0) return
    if (!window.confirm(`Esto va a crear ${pendientes.length} tarea(s) nueva(s) en el Backlog (las que ya están cargadas se omiten). ¿Continuar?`)) return
    setCargandoBacklogMasivo(true)
    setError('')
    try {
      for (const f of pendientes) {
        const res = await fetch('/api/backlog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: f.fase || 'Sin nombre',
            solutionId: id,
            type: 'TASK',
            priority: 'MEDIUM',
            status: ESTADO_A_BACKLOG[f.estado] || 'BACKLOG',
          }),
        })
        if (!res.ok) continue
        const created = await res.json()
        updateFase(f.id, { backlogItemId: created.id })
      }
    } catch {
      setError('Hubo un error cargando algunas fases al backlog.')
    } finally {
      setCargandoBacklogMasivo(false)
    }
  }

  function handleLeadChange(leadId: string) {
    setForm(f => ({ ...f, leadId }))
  }

  async function handleSave() {
    if (!form.leadId) { setError('Selecciona un lead asociado.'); setActiveTab('general'); return }
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); setActiveTab('general'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/soluciones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          tipo: form.tipo,
          estado: form.estado,
          valorEstimado: parseFloat(form.valorEstimado) || 0,
          leadId: form.leadId,
          repositorio: form.repositorio.trim() || null,
          arquitectura: JSON.stringify({ nodes: archNodes, connections: archConnections }),
          arquitecturaHtml: arquitecturaHtml || null,
          planTrabajo: form.planTrabajo.trim() || null,
          cronograma: JSON.stringify(fases),
          prd: JSON.stringify(prd),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Error al guardar.')
      }
      setCurrentLeadId(form.leadId)
      setSavedAt(Date.now())
      prdSavedSnapshot.current = JSON.stringify(prd)
      setPrdDirty(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta Solución? Esta acción no se puede deshacer.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/soluciones/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.push('/soluciones/pilotos')
    } catch {
      setError('No se pudo eliminar la Solución.')
      setDeleting(false)
    }
  }

  const availableLeads = leads.filter(l => !l.solucion || l.id === currentLeadId || l.id === form.leadId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="text-cyan-500 animate-spin" size={28} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="p-4 md:p-8">
        <div className="card p-8 text-center">
          <p className="text-white font-semibold">Solución no encontrada</p>
          <p className="text-gray-500 text-sm mt-1">Puede que haya sido eliminada.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Tabs — mismo tamaño/estilo que la barra de tabs del Hub de Lead
          (leads/[id]/hub/page.tsx) para que ambos hubs se vean consistentes */}
      <div style={{ display: 'flex', gap: '2px', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: 'rgba(8,8,26,0.7)', overflowX: 'auto' }}>
        {TABS.map(t => {
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-md border-0 border-b-2 transition-all duration-150 flex-shrink-0 ${
                active
                  ? 'border-b-orange-500 bg-orange-500/[0.07] text-orange-400'
                  : 'border-b-transparent bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="p-4 space-y-4">
        {/* Mismo tratamiento "premium" de liquid glass que TabbedNotes.tsx
            (Hub de Lead) — antes esta pagina usaba la clase .card estandar
            del portal (blur 20px, sin gradiente ni brillo especular). */}
        <div className="relative overflow-hidden p-4 space-y-5" style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.11)',
          borderRadius: 'var(--radius, 12px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.13), inset 0 -1px 0 rgba(0,0,0,0.18), 0 24px 56px rgba(0,0,0,0.45)',
        }}>
          {/* Specular highlight strip */}
          <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18) 40%, rgba(255,255,255,0.08) 60%, transparent)' }} />

          {/* Tab: General */}
          {activeTab === 'general' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Lead asociado <span className="text-cyan-400">*</span>
                  </label>
                  {loadingLeads ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm py-3">
                      <Loader2 size={14} className="animate-spin" /> Cargando leads…
                    </div>
                  ) : (
                    <select
                      value={form.leadId}
                      onChange={e => handleLeadChange(e.target.value)}
                      disabled={saving}
                      required
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60 appearance-none cursor-pointer"
                    >
                      <option value="" disabled>Selecciona un lead…</option>
                      {availableLeads.map(l => (
                        <option key={l.id} value={l.id}>{l.companyName} – {l.contactName}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Nombre <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    disabled={saving}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Estado</label>
                  <select
                    value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    disabled={saving}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60 appearance-none cursor-pointer"
                  >
                    {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Valor estimado ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.valorEstimado}
                    onChange={e => setForm(f => ({ ...f, valorEstimado: e.target.value }))}
                    disabled={saving}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <FolderGit2 size={14} className="text-gray-500" />
                    Repositorio <span className="text-gray-600 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="url"
                    value={form.repositorio}
                    onChange={e => setForm(f => ({ ...f, repositorio: e.target.value }))}
                    placeholder="https://github.com/Architech-IA/..."
                    disabled={saving}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Descripción <span className="text-gray-600 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={form.descripcion}
                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    rows={5}
                    disabled={saving}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="border border-red-900/40 bg-red-950/10 rounded-xl p-4 mt-6">
                <p className="text-red-400 text-sm font-semibold mb-1">Eliminar esta Solución</p>
                <p className="text-gray-500 text-xs mb-3">Esta acción no se puede deshacer – se borra junto con su arquitectura, plan, cronograma y código asociado.</p>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Eliminar Solución
                </button>
              </div>
            </>
          )}

          {/* Tab: Arquitectura */}
          {activeTab === 'arquitectura' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-0.5 bg-gray-800 border border-gray-700 rounded-lg p-0.5">
                  <button type="button" onClick={() => setArchView('canvas')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${archView === 'canvas' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>
                    <LayoutGrid size={12} /> Canvas
                  </button>
                  <button type="button" onClick={() => setArchView('html')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${archView === 'html' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>
                    <Code size={12} /> HTML
                  </button>
                </div>
                {archView === 'html' && (
                  <button type="button" onClick={() => htmlFileInputRef.current?.click()} disabled={saving}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50">
                    <Upload size={12} /> Importar HTML
                  </button>
                )}
                <input ref={htmlFileInputRef} type="file" accept=".html" className="hidden"
                  onChange={e => { importHtmlFile(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              {archView === 'canvas' ? (
                <ArchitectureCanvas
                  nodes={archNodes}
                  connections={archConnections}
                  onChange={(n, c) => { setArchNodes(n); setArchConnections(c) }}
                />
              ) : arquitecturaHtml ? (
                <iframe
                  srcDoc={arquitecturaHtml}
                  className="w-full rounded-xl border border-gray-700"
                  style={{ height: '680px' }}
                  title="Diagrama de arquitectura"
                  sandbox="allow-scripts"
                />
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-gray-700 cursor-pointer hover:border-cyan-500/40 transition-colors"
                  onClick={() => htmlFileInputRef.current?.click()}
                >
                  <Upload size={24} className="text-gray-600 mb-3" />
                  <p className="text-gray-400 text-sm font-medium">Importar diagrama HTML</p>
                  <p className="text-gray-600 text-xs mt-1">Hacé clic para seleccionar un archivo .html</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Plan de Trabajo */}
          {activeTab === 'plan' && (
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                  <FileText size={14} className="text-gray-500" />
                  Plan de trabajo
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 bg-gray-800 rounded-lg p-0.5">
                    <button type="button" onClick={() => setPlanView('visual')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${planView === 'visual' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                      <Eye size={12} /> Vista visual
                    </button>
                    <button type="button" onClick={() => setPlanView('markdown')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${planView === 'markdown' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                      <Code size={12} /> Markdown
                    </button>
                  </div>
                  <button type="button" onClick={() => planFileInputRef.current?.click()} disabled={saving}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50">
                    <Upload size={12} /> Subir archivo
                  </button>
                  <input ref={planFileInputRef} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="hidden"
                    onChange={e => { importPlanFile(e.target.files?.[0]); e.target.value = '' }} />
                </div>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDraggingPlan(true) }}
                onDragLeave={() => setDraggingPlan(false)}
                onDrop={e => { e.preventDefault(); setDraggingPlan(false); importPlanFile(e.dataTransfer.files?.[0]) }}
                className="rounded-xl border-2 border-dashed transition-colors mb-3 px-4 py-3 flex items-center gap-2.5"
                style={{ borderColor: draggiingPlan ? 'rgba(6,182,212,0.6)' : 'rgba(255,255,255,0.08)', background: draggiingPlan ? 'rgba(6,182,212,0.06)' : 'transparent' }}
              >
                <Upload size={14} className="text-gray-500 flex-shrink-0" />
                <p className="text-gray-500 text-xs">Arrastrá acá un archivo <span className="text-gray-400">.md / .markdown / .txt</span> para importarlo, o usá el botón de arriba.</p>
              </div>
              {planFileError && <p className="text-red-400 text-xs mb-2">{planFileError}</p>}

              {planView === 'visual' ? (
                <PlanVisualView markdown={form.planTrabajo} />
              ) : (
                <>
                  <textarea
                    value={form.planTrabajo}
                    onChange={e => setForm(f => ({ ...f, planTrabajo: e.target.value }))}
                    placeholder={'# Plan de trabajo\n\n# Contexto\n...\n\n# Pasos de ejecución\n1. ...'}
                    rows={24}
                    disabled={saving}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                  />
                  <p className="text-gray-600 text-xs mt-1.5">Los títulos <code className="bg-gray-800 px-1 rounded">#</code> y <code className="bg-gray-800 px-1 rounded">##</code> se usan para armar la Vista visual.</p>
                </>
              )}
            </div>
          )}

          {/* Tab: PRD — Documento de Requisitos de Producto. Robusto y
              desglosado: cada seccion es una lista real de items (no un
              parrafo suelto), los requisitos tienen prioridad MoSCoW y
              estado propio, y el documento en si tiene un ciclo de vida
              (Borrador/En revision/Aprobado) que condiciona si se puede
              generar backlog desde el. Las secciones condicionales varian
              segun el tipo de Solucion (un DEMO no necesita el mismo nivel
              de detalle que un PROJECT real con cliente). */}
          {activeTab === 'prd' && (() => {
            const opc = prdSeccionesOpcionales(form.tipo)

            const ESTADO_DOC_COLOR: Record<EstadoDocumentoPrd, string> = {
              BORRADOR: 'text-gray-400 border-gray-700 bg-gray-900',
              EN_REVISION: 'text-yellow-400 border-yellow-700/50 bg-yellow-900/10',
              APROBADO: 'text-green-400 border-green-700/50 bg-green-900/10',
            }
            const PRIORIDAD_LABEL: Record<PrioridadRequisito, string> = { MUST: 'Must', SHOULD: 'Should', COULD: 'Could', WONT: "Won't" }
            const ESTADO_REQ_COLOR: Record<EstadoRequisito, string> = {
              PROPUESTO: 'bg-gray-100 text-gray-600', APROBADO: 'bg-cyan-100 text-cyan-700',
              IMPLEMENTADO: 'bg-orange-100 text-orange-700', VERIFICADO: 'bg-green-100 text-green-700',
            }

            // Look "hoja de documento" (Word/Docs/LaTeX): pagina clara con
            // titulos numerados, en vez de la pila de cajitas grises del
            // formulario original. Los campos narrativos se ven como texto
            // corrido (sin borde, sin fondo) y solo se resaltan al enfocar;
            // las listas se ven como listas reales (numeradas o con vineta),
            // no como filas con recuadro. La barra de herramientas (estado,
            // generar IA, tareas del backlog) se queda en el tema oscuro del
            // portal, afuera de la "hoja" — no es parte del documento en si.
            const narrativeCls = "w-full bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-gray-300 text-gray-800 text-[14px] leading-relaxed resize-none focus:outline-none placeholder-gray-400 py-0.5 transition-colors"
            const tableInputCls = "w-full bg-transparent border-0 text-gray-800 text-[13px] focus:outline-none placeholder-gray-400 px-2 py-1.5"

            // Numeracion de secciones precalculada (sin contador mutable en
            // el cuerpo del render): un `let` que se incrementaba dentro de
            // <Titulo> se duplicaba en dev porque React vuelve a invocar el
            // render de cada elemento JSX una vez mas (Strict Mode) — eso
            // hacia que la numeracion saltara de 2 en 2 (2, 4, 6...). Con el
            // orden calculado una sola vez, afuera del render de cada
            // titulo, el resultado es siempre el mismo sin importar cuantas
            // veces React invoque el componente.
            const seccionesVisibles: string[] = [
              'resumen', 'problema', 'objetivoGeneral', 'objetivosEspecificos', 'dentroDeAlcance', 'fueraDeAlcance',
              ...(opc.personasYSupuestosYPreguntas ? ['personas'] : []),
              'requisitos',
              ...(opc.requisitosNoFuncionales ? ['rnf'] : []),
              ...(opc.metricas ? ['metricas'] : []),
              ...(opc.riesgosYDependencias ? ['riesgos', 'dependencias'] : []),
              ...(opc.personasYSupuestosYPreguntas ? ['supuestos', 'preguntasAbiertas'] : []),
            ]
            const numeroDe = (key: string) => seccionesVisibles.indexOf(key) + 1

            function Titulo({ n, children }: { n: number; children: React.ReactNode }) {
              return (
                <div className="flex items-center gap-2 mt-8 first:mt-0 mb-2 pb-1.5 border-b border-gray-200 group/titulo">
                  <h2 id={`prd-seccion-${n}`} className="text-[17px] font-bold text-gray-900 scroll-mt-6 flex-1 min-w-0">
                    {n}. {children}
                  </h2>
                  <button type="button"
                    onClick={() => setAiPanel({ n, titulo: typeof children === 'string' ? children : `Sección ${n}` })}
                    title="Asistente de IA para esta sección"
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-cyan-600/60 border border-cyan-200 hover:text-white hover:bg-cyan-600 hover:border-cyan-600 transition-colors print:hidden opacity-0 group-hover/titulo:opacity-100 focus:opacity-100">
                    <Sparkles size={12} />
                  </button>
                </div>
              )
            }
            const totalSecciones = seccionesVisibles.length
            function irASeccion(n: number) {
              document.getElementById(`prd-seccion-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }

            // Renderiza una de las 7 secciones "lista de texto simple" como
            // una lista real (vineta + texto corrido), no filas con recuadro.
            function renderSimpleList(key: SimpleListKey, label: string, placeholder: string) {
              return (
                <div className="mb-6">
                  <Titulo n={numeroDe(key)}>{label}</Titulo>
                  <div>
                    {prd[key].length === 0 && <p className="text-gray-400 text-xs italic py-1">Sin ítems todavía.</p>}
                    {prd[key].map(item => (
                      <div key={item.id} className="flex items-start gap-2 group py-0.5">
                        <span className="text-gray-400 text-sm mt-0.5 select-none">•</span>
                        <input type="text" value={item.texto} onChange={e => updateSimpleItem(key, item.id, e.target.value)}
                          placeholder={placeholder} className={narrativeCls + ' flex-1'} />
                        <button type="button" onClick={() => removeSimpleItem(key, item.id)}
                          className="w-6 h-6 flex-shrink-0 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => addSimpleItem(key)}
                    className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-600 transition-colors">
                    <Plus size={12} /> Agregar ítem
                  </button>
                </div>
              )
            }

            return (
              <div className="space-y-4">
                {/* Barra de herramientas — tema oscuro del portal, no forma parte de "la hoja". print:hidden para que no salga al imprimir/exportar. */}
                <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Estado del documento:</label>
                      <select value={prd.estadoDocumento} onChange={e => updatePrdField('estadoDocumento', e.target.value as EstadoDocumentoPrd)}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${ESTADO_DOC_COLOR[prd.estadoDocumento]}`}>
                        <option value="BORRADOR">Borrador</option>
                        <option value="EN_REVISION">En revisión</option>
                        <option value="APROBADO">Aprobado</option>
                      </select>
                    </div>
                    {/* Indicador de cambios sin guardar en ESTE documento — el
                        guardado real sigue siendo el boton grande de toda la
                        pagina, esto solo avisa si hace falta usarlo. */}
                    <span className={`text-[11px] flex items-center gap-1 ${prdDirty ? 'text-orange-400' : 'text-gray-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${prdDirty ? 'bg-orange-400' : 'bg-gray-600'}`} />
                      {prdDirty ? 'Cambios sin guardar' : 'Guardado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RichToolbar />
                    <button type="button" onClick={() => window.print()}
                      title="Imprimir / Exportar a PDF"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-medium transition-colors">
                      <Printer size={12} /> Imprimir / PDF
                    </button>
                    <button type="button" onClick={generarPrdConIA} disabled={generandoPrd}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-900/40 hover:bg-cyan-800/50 border border-cyan-700/40 text-cyan-300 text-xs font-medium transition-colors disabled:opacity-50">
                      {generandoPrd ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                      {generandoPrd ? 'Generando...' : 'Generar con IA'}
                    </button>
                  </div>
                </div>
                {prdGenError && <p className="text-red-400 text-xs print:hidden">{prdGenError}</p>}

                {/* Widget compacto de tareas del backlog: no reemplaza el
                    board completo (eso vive en Oficina > Config > Backlog),
                    solo muestra el estado de las tareas ya generadas desde
                    este PRD y permite dispararlas sin cambiar de tab. */}
                {tareasBacklog.length > 0 && (
                  <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 print:hidden">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                        <ListPlus size={12} className="text-gray-600" /> Tareas del backlog ({tareasBacklog.length})
                      </label>
                      {loadingTareasBacklog && <Loader2 size={12} className="animate-spin text-gray-600" />}
                    </div>
                    {dispatchTareaError && <p className="text-red-400 text-xs mb-2">{dispatchTareaError}</p>}
                    {/* max-h + scroll interno: sin esto, una Solucion con
                        muchas tareas (ej. 17+) empujaba todo el resto del
                        documento PRD fuera de la vista — parecia que el PRD
                        habia desaparecido cuando en realidad solo estaba
                        muy abajo del scroll. */}
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {tareasBacklog.map(t => {
                        const puedeDisparar = t.status === 'BACKLOG' || t.status === 'FAILED'
                        return (
                          <div key={t.id} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${ESTADO_TAREA_COLOR[t.status] ?? 'text-gray-400 border-gray-700'}`}>
                              {t.status}
                            </span>
                            <span className="text-xs text-gray-300 flex-1 truncate" title={t.title}>
                              {t.taskCode ? `${t.taskCode} — ` : ''}{t.title}
                            </span>
                            {t.prdRequisitoId && (
                              <span className="text-[9px] text-cyan-400/70 flex-shrink-0">PRD</span>
                            )}
                            <button type="button" onClick={() => dispatchTarea(t.id)} disabled={!puedeDisparar || dispatchingTareaId === t.id}
                              title={puedeDisparar ? 'Disparar tarea' : 'Solo se puede disparar desde BACKLOG o FAILED'}
                              className="w-6 h-6 flex-shrink-0 rounded-md bg-gray-800 hover:bg-cyan-900/40 text-gray-500 hover:text-cyan-300 flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-gray-800 disabled:hover:text-gray-500">
                              {dispatchingTareaId === t.id ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* La hoja del documento — papel claro, tipografia de
                    documento, dentro del panel oscuro del portal. Al
                    imprimir: sin sombra ni ancho maximo, ocupa toda la
                    pagina como un documento real. */}
                <div className="bg-white rounded-sm shadow-2xl mx-auto max-w-[840px] print:shadow-none print:rounded-none print:mx-0 print:max-w-none"
                  style={{ fontFamily: 'var(--font-archivo)' }}>
                  <div className="px-10 sm:px-16 py-12">
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">{form.nombre || 'Sin nombre'} — PRD</h1>
                    <p className="text-gray-400 text-xs mb-8">Documento de Requisitos de Producto</p>

                    <div className="mb-6">
                      <Titulo n={numeroDe('resumen')}>Resumen ejecutivo</Titulo>
                      <RichTextField value={prd.resumenEjecutivo} onChange={v => updatePrdField('resumenEjecutivo', v)}
                        placeholder="2-3 líneas: lo primero que debería leer cualquiera sobre esta Solución." className={narrativeCls} />
                    </div>

                    <div className="mb-6">
                      <Titulo n={numeroDe('problema')}>Problema / contexto</Titulo>
                      <RichTextField value={prd.problema} onChange={v => updatePrdField('problema', v)}
                        placeholder="¿Qué necesidad o dolor motiva esta Solución? Justificá con evidencia si es posible, no solo intuición." className={narrativeCls} />
                    </div>

                    <div className="mb-6">
                      <Titulo n={numeroDe('objetivoGeneral')}>Objetivo general</Titulo>
                      <RichTextField value={prd.objetivoGeneral} onChange={v => updatePrdField('objetivoGeneral', v)}
                        placeholder="¿Qué se va a lograr, en una frase?" className={narrativeCls} />
                    </div>

                {renderSimpleList('objetivosEspecificos', 'Objetivos específicos', 'Un objetivo concreto y medible')}
                {renderSimpleList('dentroDeAlcance', 'Dentro de alcance', 'Qué SÍ entra en esta versión')}
                {renderSimpleList('fueraDeAlcance', 'Fuera de alcance', 'Qué explícitamente NO entra, para evitar negociaciones tardías')}

                {opc.personasYSupuestosYPreguntas && (
                  <div className="mb-6">
                    <Titulo n={numeroDe('personas')}>Usuarios / personas</Titulo>
                    {prd.personas.length === 0 && <p className="text-gray-400 text-xs italic py-1">Sin personas registradas todavía.</p>}
                    {prd.personas.length > 0 && (
                      <table className="w-full border-collapse mb-1">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                            <th className="font-semibold pb-1 pr-2 w-40">Rol</th>
                            <th className="font-semibold pb-1">Necesidad principal</th>
                            <th className="w-6"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {prd.personas.map(p => (
                            <tr key={p.id} className="border-t border-gray-100 group">
                              <td className="align-top"><AutoTextarea value={p.rol} onChange={v => updatePersona(p.id, { rol: v })}
                                placeholder="Ej: Ejecutivo de ventas" className={tableInputCls + ' font-medium'} /></td>
                              <td className="align-top"><AutoTextarea value={p.necesidad} onChange={v => updatePersona(p.id, { necesidad: v })}
                                placeholder="Necesidad principal" className={tableInputCls} /></td>
                              <td className="align-top">
                                <button type="button" onClick={() => removePersona(p.id)}
                                  className="w-6 h-6 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <button type="button" onClick={addPersona}
                      className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-600 transition-colors">
                      <Plus size={12} /> Agregar persona
                    </button>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Titulo n={numeroDe('requisitos')}>Requisitos funcionales (historias de usuario / casos de uso)</Titulo>
                  </div>
                  {prd.requisitos.length > 0 && (
                    <div className="flex justify-end -mt-1 mb-2">
                      <button type="button" onClick={generarBacklogDesdePRD} disabled={generandoBacklogPrd || prd.estadoDocumento !== 'APROBADO'}
                        title={prd.estadoDocumento !== 'APROBADO' ? 'El documento debe estar Aprobado para generar backlog' : undefined}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-700 text-xs font-medium transition-colors disabled:opacity-40">
                        {generandoBacklogPrd ? <Loader2 size={12} className="animate-spin" /> : <ListPlus size={12} />}
                        {generandoBacklogPrd ? 'Generando...' : 'Generar backlog desde PRD'}
                      </button>
                    </div>
                  )}
                  {backlogPrdError && <p className="text-red-500 text-xs mb-2">{backlogPrdError}</p>}
                  <div className="divide-y divide-gray-100">
                    {prd.requisitos.length === 0 && (
                      <p className="text-gray-400 text-sm text-center py-4 italic">Sin requisitos registrados todavía.</p>
                    )}
                    {prd.requisitos.map((r, i) => (
                      <div key={r.id} className="py-3 group">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-gray-400 text-xs font-mono">R{i + 1}</span>
                          <select value={r.tipo} onChange={e => updateRequisito(r.id, { tipo: e.target.value as Requisito['tipo'] })}
                            title="Tipo de requisito"
                            className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-700 text-[11px] focus:outline-none focus:border-cyan-400 transition-colors appearance-none cursor-pointer">
                            <option value="historia">Historia de usuario</option>
                            <option value="caso_uso">Caso de uso</option>
                          </select>
                          <select value={r.prioridad} onChange={e => updateRequisito(r.id, { prioridad: e.target.value as PrioridadRequisito })}
                            title="Prioridad (MoSCoW)"
                            className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-700 text-[11px] focus:outline-none focus:border-cyan-400 transition-colors appearance-none cursor-pointer">
                            {(Object.keys(PRIORIDAD_LABEL) as PrioridadRequisito[]).map(p => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
                          </select>
                          <select value={r.estado} onChange={e => updateRequisito(r.id, { estado: e.target.value as EstadoRequisito })}
                            title="Estado del requisito"
                            className={`border-0 rounded-full px-2 py-1 text-[11px] font-medium focus:outline-none appearance-none cursor-pointer ${ESTADO_REQ_COLOR[r.estado]}`}>
                            <option value="PROPUESTO">Propuesto</option>
                            <option value="APROBADO">Aprobado</option>
                            <option value="IMPLEMENTADO">Implementado</option>
                            <option value="VERIFICADO">Verificado</option>
                          </select>
                          {r.backlogItemId && (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                              En backlog
                            </span>
                          )}
                          <button type="button" onClick={() => removeRequisito(r.id)}
                            className="w-6 h-6 flex-shrink-0 ml-auto rounded text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <RichTextField value={r.texto} onChange={v => updateRequisito(r.id, { texto: v })}
                          placeholder={r.tipo === 'historia' ? 'Como [rol], quiero [acción], para [beneficio]' : 'Actor, precondiciones, flujo principal...'}
                          className={narrativeCls} />
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-1.5 mb-0.5">Criterio de aceptación</p>
                        <RichTextField value={r.criterioAceptacion} onChange={v => updateRequisito(r.id, { criterioAceptacion: v })}
                          placeholder="¿Cuándo se considera terminado este requisito?"
                          className={narrativeCls} />
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addRequisito}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:text-cyan-600 hover:border-cyan-300 text-sm transition-colors">
                    <Plus size={14} /> Agregar requisito
                  </button>
                </div>

                {opc.requisitosNoFuncionales && (
                  <div className="mb-6">
                    <Titulo n={numeroDe('rnf')}>Requisitos no funcionales</Titulo>
                    {prd.requisitosNoFuncionales.length === 0 && <p className="text-gray-400 text-xs italic py-1">Sin requisitos no funcionales todavía.</p>}
                    {prd.requisitosNoFuncionales.length > 0 && (
                      <table className="w-full border-collapse mb-1">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                            <th className="font-semibold pb-1 pr-2 w-36">Categoría</th>
                            <th className="font-semibold pb-1">Requisito</th>
                            <th className="w-6"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {prd.requisitosNoFuncionales.map(r => (
                            <tr key={r.id} className="border-t border-gray-100 group">
                              <td className="align-top">
                                <select value={r.categoria} onChange={e => updateRnF(r.id, { categoria: e.target.value })}
                                  className="bg-transparent border-0 text-gray-700 text-[12px] focus:outline-none appearance-none cursor-pointer py-1.5">
                                  <option value="performance">Performance</option>
                                  <option value="seguridad">Seguridad</option>
                                  <option value="compatibilidad">Compatibilidad</option>
                                  <option value="escalabilidad">Escalabilidad</option>
                                  <option value="otro">Otro</option>
                                </select>
                              </td>
                              <td className="align-top"><AutoTextarea value={r.texto} onChange={v => updateRnF(r.id, { texto: v })}
                                placeholder="Ej: tiempo de respuesta < 2s bajo carga normal" className={tableInputCls} /></td>
                              <td className="align-top">
                                <button type="button" onClick={() => removeRnF(r.id)}
                                  className="w-6 h-6 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <button type="button" onClick={addRnF}
                      className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-600 transition-colors">
                      <Plus size={12} /> Agregar requisito no funcional
                    </button>
                  </div>
                )}

                {opc.metricas && (
                  <div className="mb-6">
                    <Titulo n={numeroDe('metricas')}>Métricas de éxito (KPIs)</Titulo>
                    {prd.metricas.length === 0 && <p className="text-gray-400 text-xs italic py-1">Sin métricas registradas todavía.</p>}
                    {prd.metricas.length > 0 && (
                      <table className="w-full border-collapse mb-1">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                            <th className="font-semibold pb-1 pr-2">KPI</th>
                            <th className="font-semibold pb-1 pr-2">Meta</th>
                            <th className="font-semibold pb-1">Cómo se mide</th>
                            <th className="w-6"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {prd.metricas.map(m => (
                            <tr key={m.id} className="border-t border-gray-100 group">
                              <td className="align-top"><AutoTextarea value={m.nombre} onChange={v => updateMetrica(m.id, { nombre: v })}
                                placeholder="KPI" className={tableInputCls + ' font-medium'} /></td>
                              <td className="align-top"><AutoTextarea value={m.meta} onChange={v => updateMetrica(m.id, { meta: v })}
                                placeholder="Meta" className={tableInputCls} /></td>
                              <td className="align-top"><AutoTextarea value={m.comoSeMide} onChange={v => updateMetrica(m.id, { comoSeMide: v })}
                                placeholder="Cómo se mide" className={tableInputCls} /></td>
                              <td className="align-top">
                                <button type="button" onClick={() => removeMetrica(m.id)}
                                  className="w-6 h-6 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <button type="button" onClick={addMetrica}
                      className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-600 transition-colors">
                      <Plus size={12} /> Agregar métrica
                    </button>
                  </div>
                )}

                {opc.riesgosYDependencias && (
                  <>
                    {renderSimpleList('riesgos', 'Riesgos', 'Un riesgo — el detalle formal (mitigación, severidad) va en la pestaña Riesgos')}
                    {renderSimpleList('dependencias', 'Dependencias técnicas / de otros equipos', 'Qué bloquea o es bloqueado por esto')}
                  </>
                )}

                {opc.personasYSupuestosYPreguntas && (
                  <>
                    {renderSimpleList('supuestos', 'Supuestos', 'Qué se asume cierto pero no está validado')}
                    {renderSimpleList('preguntasAbiertas', 'Preguntas abiertas', 'Una duda sin resolver que no bloquea el arranque')}
                  </>
                )}
                  </div>
                </div>

                {/* Indice lateral flotante — con el documento ya bastante
                    largo (10-12 requisitos + todas las secciones), poder
                    saltar directo a una seccion vale la pena. Solo en
                    pantallas anchas, y nunca al imprimir. */}
                <div className="hidden xl:flex flex-col gap-1 fixed right-6 top-40 print:hidden z-10">
                  {Array.from({ length: totalSecciones }, (_, i) => i + 1).map(n => (
                    <button key={n} type="button" onClick={() => irASeccion(n)} title={`Ir a la sección ${n}`}
                      className="w-6 h-6 rounded-full bg-gray-900/80 border border-gray-700 text-gray-400 hover:bg-cyan-900/60 hover:text-cyan-300 hover:border-cyan-600 text-[10px] font-semibold flex items-center justify-center transition-colors">
                      {n}
                    </button>
                  ))}
                </div>

                {/* Panel lateral de IA por seccion, estilo "blade" de
                    Azure/AWS: fondo oscurecido + panel que entra desde la
                    derecha. Se mantiene siempre montado (no condicional) para
                    que la transicion de entrada/salida se vea, alternando
                    solo las clases de opacidad/traslacion segun aiPanel. Por
                    ahora es solo visual — las opciones no ejecutan nada, se
                    conectaran a futuro con el motor de IA. */}
                <div onClick={() => setAiPanel(null)}
                  className={`fixed inset-0 bg-black/20 z-40 print:hidden transition-opacity duration-200 ${aiPanel ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} />
                <div className={`fixed top-0 right-0 h-full w-full sm:w-[380px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col print:hidden transition-transform duration-300 ease-out ${aiPanel ? 'translate-x-0' : 'translate-x-full'}`}>
                  <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-cyan-50 to-white">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-cyan-600 font-semibold">Asistente IA · Sección {aiPanel?.n ?? ''}</p>
                      <h3 className="text-sm font-bold text-gray-900 truncate">{aiPanel?.titulo}</h3>
                    </div>
                    <button type="button" onClick={() => setAiPanel(null)}
                      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                    <p className="text-xs text-gray-400 mb-2">Elegí qué querés que la IA haga con esta sección.</p>
                    {AI_OPCIONES_SECCION.map(op => (
                      <button key={op.id} type="button"
                        className="w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-xl border border-gray-100 hover:border-cyan-200 hover:bg-cyan-50/50 transition-colors">
                        <span className="w-8 h-8 flex-shrink-0 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
                          <op.icon size={15} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-gray-800">{op.label}</span>
                          <span className="block text-[11px] text-gray-400 mt-0.5">{op.desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="px-5 py-3 border-t border-gray-100">
                    <p className="text-[10px] text-gray-300 text-center">Próximamente conectado con el motor de IA</p>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Tab: Cronograma */}
          {activeTab === 'cronograma' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-0.5 bg-gray-800 border border-gray-700 rounded-lg p-0.5">
                  <button type="button" onClick={() => setCronogramaView('lista')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${cronogramaView === 'lista' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>
                    <List size={12} /> Lista
                  </button>
                  <button type="button" onClick={() => setCronogramaView('linea')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${cronogramaView === 'linea' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>
                    <BarChart3 size={12} /> Línea de tiempo
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={cargarTodasAlBacklog} disabled={cargandoBacklogMasivo || fases.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-medium transition-colors disabled:opacity-50">
                    {cargandoBacklogMasivo ? <Loader2 size={12} className="animate-spin" /> : <ListPlus size={12} />}
                    {cargandoBacklogMasivo ? 'Cargando…' : 'Agregar todas al backlog'}
                  </button>
                  <button type="button" onClick={generarCronogramaDesdePlan} disabled={saving}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-medium transition-colors disabled:opacity-50">
                    <Wand2 size={12} /> Generar desde el Plan
                  </button>
                </div>
              </div>

              {cronogramaView === 'linea' ? (
                <CronogramaTimeline fases={fases} onUpdate={updateFase} onRemove={removeFase} solucionId={id} planMarkdown={form.planTrabajo} />
              ) : (
                <>
                  {fases.length === 0 && (
                    <p className="text-gray-600 text-sm text-center py-4">Sin fases todavía. Agregá la primera abajo, o generálas desde el Plan de Trabajo.</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fases.map(f => (
                      <div key={f.id} className="bg-gray-950 border border-gray-700 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="text" value={f.fase} onChange={e => updateFase(f.id, { fase: e.target.value })}
                            placeholder="Nombre de la fase" disabled={saving}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60" />
                          <button type="button" onClick={() => removeFase(f.id)} disabled={saving}
                            className="w-8 h-8 flex-shrink-0 rounded-lg bg-gray-900 hover:bg-red-900/30 text-gray-500 hover:text-red-400 flex items-center justify-center transition-colors disabled:opacity-50">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          <input type="date" value={f.fechaInicio} onChange={e => updateFase(f.id, { fechaInicio: e.target.value })} disabled={saving}
                            title="Fecha inicio"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60" />
                          <input type="date" value={f.fechaFin} onChange={e => updateFase(f.id, { fechaFin: e.target.value })} disabled={saving}
                            title="Fecha fin"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60" />
                          <input type="time" value={f.horaEjecucion ?? ''} onChange={e => updateFase(f.id, { horaEjecucion: e.target.value })} disabled={saving}
                            title="Hora de inicio"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60" />
                          <input type="time" value={f.horaFin ?? ''} onChange={e => updateFase(f.id, { horaFin: e.target.value })} disabled={saving}
                            title="Hora de fin"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60" />
                          <select value={f.estado} onChange={e => updateFase(f.id, { estado: e.target.value })} disabled={saving}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60 appearance-none cursor-pointer">
                            {ESTADOS_FASE.map(es => <option key={es} value={es}>{es}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addFase} disabled={saving}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 text-sm transition-colors disabled:opacity-50">
                    <Plus size={14} /> Agregar fase
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tab: Riesgos */}
          {activeTab === 'riesgos' && (
            <div className="space-y-3">
              {loadingRiesgos ? (
                <div className="flex justify-center py-8"><Loader2 className="text-cyan-500 animate-spin" size={22} /></div>
              ) : (
                <>
                  {riesgos.length === 0 && (
                    <p className="text-gray-600 text-sm text-center py-4">Sin riesgos registrados todavía.</p>
                  )}
                  <div className="space-y-3">
                    {riesgos.map(r => (
                      <div key={r.id} className={`bg-gray-950 border rounded-xl p-3 space-y-2 ${SEVERIDAD_COLOR[r.severidad] ?? 'border-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <input type="text" value={r.titulo} onChange={e => updateRiesgo(r.id, { titulo: e.target.value })}
                            placeholder="Título del riesgo"
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm font-medium focus:outline-none focus:border-cyan-500 transition-colors" />
                          <button type="button" onClick={() => removeRiesgo(r.id)}
                            className="w-8 h-8 flex-shrink-0 rounded-lg bg-gray-900 hover:bg-red-900/30 text-gray-500 hover:text-red-400 flex items-center justify-center transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <textarea value={r.descripcion ?? ''} onChange={e => updateRiesgo(r.id, { descripcion: e.target.value })}
                          placeholder="Descripción del riesgo" rows={2}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 placeholder-gray-600 text-xs focus:outline-none focus:border-cyan-500 transition-colors resize-vertical" />
                        <div className="grid grid-cols-4 gap-2">
                          <select value={r.severidad} onChange={e => updateRiesgo(r.id, { severidad: e.target.value })} title="Severidad"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors appearance-none cursor-pointer">
                            {SEVERIDADES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <select value={r.probabilidad} onChange={e => updateRiesgo(r.id, { probabilidad: e.target.value })} title="Probabilidad"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors appearance-none cursor-pointer">
                            {PROBABILIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <select value={r.estado} onChange={e => updateRiesgo(r.id, { estado: e.target.value })} title="Estado"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors appearance-none cursor-pointer">
                            {ESTADOS_RIESGO.map(e2 => <option key={e2} value={e2}>{e2}</option>)}
                          </select>
                          <input type="text" value={r.responsable ?? ''} onChange={e => updateRiesgo(r.id, { responsable: e.target.value })}
                            placeholder="Responsable"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-cyan-500 transition-colors" />
                        </div>
                        <input type="text" value={r.mitigacion ?? ''} onChange={e => updateRiesgo(r.id, { mitigacion: e.target.value })}
                          placeholder="Mitigación propuesta"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 placeholder-gray-600 text-xs focus:outline-none focus:border-cyan-500 transition-colors" />
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addRiesgo}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 text-sm transition-colors">
                    <Plus size={14} /> Agregar riesgo
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tab: Cumplimiento */}
          {activeTab === 'cumplimiento' && (
            <div className="space-y-3">
              {loadingHitos ? (
                <div className="flex justify-center py-8"><Loader2 className="text-cyan-500 animate-spin" size={22} /></div>
              ) : (
                <>
                  {hitos.length === 0 && (
                    <p className="text-gray-600 text-sm text-center py-4">Sin hitos registrados todavía.</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {hitos.map(h => (
                      <div key={h.id} className={`bg-gray-950 border rounded-xl p-3 space-y-2 ${ESTADO_HITO_COLOR[h.estado] ?? 'border-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <input type="text" value={h.titulo} onChange={e => updateHito(h.id, { titulo: e.target.value })}
                            placeholder="Título del hito / entregable"
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm font-medium focus:outline-none focus:border-cyan-500 transition-colors" />
                          <button type="button" onClick={() => removeHito(h.id)}
                            className="w-8 h-8 flex-shrink-0 rounded-lg bg-gray-900 hover:bg-red-900/30 text-gray-500 hover:text-red-400 flex items-center justify-center transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <input type="text" value={h.descripcion ?? ''} onChange={e => updateHito(h.id, { descripcion: e.target.value })}
                          placeholder="Descripción (opcional)"
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 placeholder-gray-600 text-xs focus:outline-none focus:border-cyan-500 transition-colors" />
                        <div className="grid grid-cols-3 gap-2">
                          <input type="date" value={h.fechaComprometida ? h.fechaComprometida.slice(0, 10) : ''}
                            onChange={e => updateHito(h.id, { fechaComprometida: e.target.value || null })} title="Fecha comprometida"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors" />
                          <input type="date" value={h.fechaReal ? h.fechaReal.slice(0, 10) : ''}
                            onChange={e => updateHito(h.id, { fechaReal: e.target.value || null })} title="Fecha real de entrega"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors" />
                          <select value={h.estado} onChange={e => updateHito(h.id, { estado: e.target.value })} title="Estado"
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors appearance-none cursor-pointer">
                            {ESTADOS_HITO.map(es => <option key={es} value={es}>{es}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addHito}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 text-sm transition-colors">
                    <Plus size={14} /> Agregar hito
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tab: Código fuente */}
          {activeTab === 'codigo' && (
            <div className="space-y-3">
              {form.repositorio ? (
                <a href={form.repositorio} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-gray-950 border border-gray-700 hover:border-cyan-500/40 rounded-xl px-4 py-3.5 transition-colors group max-w-md">
                  <div className="w-9 h-9 rounded-lg bg-cyan-600/15 flex items-center justify-center flex-shrink-0">
                    <FolderGit2 size={16} className="text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{form.repositorio}</p>
                    <p className="text-gray-500 text-xs">Abrir repositorio</p>
                  </div>
                  <ExternalLink size={14} className="text-gray-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                </a>
              ) : (
                <div className="text-center py-8">
                  <FolderGit2 size={28} className="text-gray-700 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Todavía no registraste un repositorio.</p>
                  <button type="button" onClick={() => setActiveTab('general')} className="text-cyan-400 hover:text-cyan-300 text-xs mt-1.5 transition-colors">
                    Agregarlo en la pestaña General →
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-800/50 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Guardar cambios */}
        <div className="flex items-center justify-end gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          {savedAt && !saving && (
            <p className="text-emerald-400 text-xs">Guardado {new Date(savedAt).toLocaleTimeString('es-CO')}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white text-sm font-semibold transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

