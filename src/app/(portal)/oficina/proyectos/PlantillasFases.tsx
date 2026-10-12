'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, X, Plus, Trash2, RotateCcw, History, Save, Lock, ChevronUp, ChevronDown, Copy } from 'lucide-react'
import { ETIQUETA_TIPO, type TipoSesion } from '@/lib/proyectos/tipos'
import { TITULO_DE_TAB } from '../../solutions/pilots/[id]/ArbolArtefactos'
import type { TabKey } from '../../solutions/pilots/[id]/espacio'
import { api, post, put, hace } from './api'
import { FORMATO } from './formatos'

// Editor de las plantillas de fases: objetivo, aprobador y criterios de la puerta, entregables obligatorios (con su verificación) y roles de sesión.
// Lo que se guarda se aplica de inmediato a los proyectos nuevos y a los que ya están en marcha.

interface Verifica { rol?: string; tipo: string; clave?: string; aprobado?: boolean; min_requisitos?: number | null; min?: number; hechas_min?: number; sin_fallidas?: boolean; estados?: string[] }
interface Requerido { clave: string; titulo: string; ayuda: string; formato: string; verifica: Verifica }
interface Rol { clave: string; titulo: string; tipo: string; objetivo: string; artefactos: string[]; resultado: string; cierre: string[] }
interface FaseEd { clave: string; numero: number; bloque: string; nombre: string; leadStatus: string | null; tipoPuerta: string; objetivo: string; aprobador: string; criterios: string[]; entregables: string[]; requeridos: Requerido[]; sesiones: Rol[] }
interface Plantilla { codigo: string; nombre: string; modificada: boolean; version: number; actualizadoPor: string | null; actualizadoEn: string | null; efectiva: FaseEd[]; base: FaseEd[] }
interface Catalogo { rolesFicha: string[]; formatosManuales: string[]; aprobadores: string[]; tiposVerificacion: string[]; tiposSesion: string[]; artefactos: string[]; estadosPropuesta: string[]; documentos: string[] }
interface Datos { puedeEditar: boolean; catalogo: Catalogo; plantillas: Plantilla[] }
interface Hist { id: string; version: number; nota: string | null; usuario: string | null; en: string; fasesEditadas: number }

const APROBADOR: Record<string, string> = { COMERCIAL: 'Responsable comercial', LIDER_PREVENTA: 'Líder de preventa', LIDER_TECNICO: 'Líder técnico', DIRECCION: 'Dirección', LIDER_PROYECTO: 'Líder de proyecto', CLIENTE: 'El cliente', DUENO: 'Dueño de la iniciativa' }
const VERIF: Record<string, string> = {
  nota_lead: 'Notas de la etapa en el Lead Hub', reunion_lead: 'Reunión registrada en el lead', documento: 'Documento (PRD, diseño o plan)', arquitectura: 'Diagrama de arquitectura',
  propuesta: 'Propuesta del lead', tareas: 'Tareas del backlog', despliegue: 'URL de despliegue registrada', manual: 'Lo marca una persona, con evidencia',
  ficha_cliente: 'Ficha del cliente completa', ficha_contacto: 'Persona identificada en la ficha del cliente',
}
const DOC: Record<string, string> = { prd: 'PRD', diseno: 'Diseño técnico', plan: 'Plan de ejecución' }
const ESTADO_PROP: Record<string, string> = { DRAFT: 'Borrador', SENT: 'Enviada', UNDER_REVIEW: 'En revisión', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada' }
const ROL_FICHA: Record<string, string> = { DECISOR: 'Quién decide la compra', REPRESENTANTE_LEGAL: 'Representante legal', FIRMANTE: 'Quién firma la aceptación y el cierre' }
const AUTO_FORMATO: Record<string, string> = { ficha_cliente: 'ficha', ficha_contacto: 'ficha', nota_lead: 'nota', reunion_lead: 'registro', documento: 'portal', arquitectura: 'diagrama', propuesta: 'propuesta', tareas: 'backlog', despliegue: 'url' }
const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const claveDe = (t: string) => (t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'nuevo') + '_' + Math.random().toString(36).slice(2, 5)
const campo = 'w-full rounded-md px-2 py-1.5 text-[12px] text-gray-200 bg-black/30 border border-white/10 outline-none focus:border-indigo-500/50 disabled:opacity-60'
const etiqueta = 'block text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1'

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

export default function PlantillasFases({ onCerrar, onCambio }: { onCerrar: () => void; onCambio: () => void }) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [codigo, setCodigo] = useState('PROYECTO_COMPLETO')
  const [faseSel, setFaseSel] = useState<string>('')
  const [borrador, setBorrador] = useState<Record<string, Record<string, FaseEd>>>({})
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [hist, setHist] = useState<Hist[] | null>(null)
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
  const cambiarRol = (i: number, r: Partial<Rol>) => cambiar({ sesiones: (fase?.sesiones ?? []).map((x, j) => (j === i ? { ...x, ...r } : x)) })

  // Reordenar, duplicar y copiar entre fases (entregables y roles)
  type Lista = 'requeridos' | 'sesiones'
  const MAX: Record<Lista, number> = { requeridos: 8, sesiones: 4 }
  function mover(k: Lista, i: number, d: -1 | 1) {
    if (!fase) return
    const a = [...fase[k]] as unknown[]; const j = i + d
    if (j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]
    cambiar({ [k]: a } as Partial<FaseEd>)
  }
  function duplicar(k: Lista, i: number) {
    if (!fase || fase[k].length >= MAX[k]) return
    const a = [...fase[k]] as (Requerido | Rol)[]
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
    const o = copia((fase[k] as (Requerido | Rol)[])[i]); o.clave = claveDe(o.titulo || 'copia')
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
      for (const k of sucias) { const f = bor[k]; fases[k] = { objetivo: f.objetivo, aprobador: f.aprobador, criterios: f.criterios, entregables: f.entregables, requeridos: f.requeridos, sesiones: f.sesiones } }
      const r = await put<{ proyectosActualizados: number }>(`/api/fases/plantillas/${codigo}`, { fases, nota: nota.trim() || undefined })
      setBorrador(b => ({ ...b, [codigo]: {} })); setNota(''); setHist(null)
      setAviso(`Guardado. ${r.proyectosActualizados} proyecto(s) en marcha actualizado(s).`)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-6xl h-full max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" style={{ background: '#0e0e20', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 flex-shrink-0">
          <h2 className="text-[14px] font-bold text-gray-100">Plantillas de fases</h2>
          <div className="flex gap-1">
            {datos?.plantillas.map(p => (
              <button key={p.codigo} onClick={() => setCodigo(p.codigo)} className="px-2.5 py-1 rounded-lg text-[11px] transition-colors"
                style={codigo === p.codigo ? { background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.5)', color: '#fff' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                {p.codigo === 'PROYECTO_COMPLETO' ? 'Comercial' : 'Interna'}{p.modificada ? ' ·editada' : ''}</button>))}
          </div>
          {!editable && datos && <span className="flex items-center gap-1 text-[11px] text-amber-300"><Lock size={11} /> Solo lectura: editar requiere ser administrador</span>}
          <span className="flex-1" />
          <button onClick={cerrar} title="Cerrar" className="text-[#7f8a9c] hover:text-gray-200"><X size={16} /></button>
        </div>

        {!datos && !error && <div className="flex-1 flex items-center justify-center text-[#7f8a9c]"><Loader2 size={18} className="animate-spin" /></div>}
        {error && !datos && <p className="p-5 text-[12px] text-red-300">{error}</p>}

        {datos && plantilla && (
          <div className="flex-1 min-h-0 flex">
            <div className="w-56 flex-shrink-0 border-r border-white/10 overflow-y-auto p-2 space-y-0.5">
              {plantilla.efectiva.map(f => (
                <button key={f.clave} onClick={() => setFaseSel(f.clave)} className="w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] flex items-center gap-2 transition-colors"
                  style={faseSel === f.clave ? { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.45)', color: '#fff' } : { border: '1px solid transparent', color: '#cbd5e1' }}>
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

                  <div><label className={etiqueta}>Objetivo de la fase</label><textarea value={fase.objetivo} disabled={dis} onChange={e => cambiar({ objetivo: e.target.value })} rows={2} className={campo} /></div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className={etiqueta}>Aprueba la puerta</label>
                      <select value={fase.aprobador} disabled={dis} onChange={e => cambiar({ aprobador: e.target.value })} className={campo}>{cat.aprobadores.map(a => <option key={a} value={a}>{APROBADOR[a] ?? a}</option>)}</select>
                      <label className={`${etiqueta} mt-3`}>Criterios de la puerta (los marca una persona)</label>
                      <ListaTextos valores={fase.criterios} deshabilitado={dis} onCambio={criterios => cambiar({ criterios })} vacio="Debe haber al menos un criterio." />
                    </div>
                    <div>
                      <label className={etiqueta}>Qué produce la fase (referencia)</label>
                      <ListaTextos valores={fase.entregables} deshabilitado={dis} onCambio={entregables => cambiar({ entregables })} vacio="Sin entregables de referencia." />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <label className={`${etiqueta} !mb-0 flex-1`}>Entregables obligatorios para cerrar la fase ({fase.requeridos.length}/8)</label>
                      {!dis && <select value="" onChange={e => { if (e.target.value) copiarDesde(e.target.value) }} title="Reemplaza los entregables de esta fase por los de otra" className={`${campo} !w-auto !py-1 !text-[11px]`}>
                        <option value="">Copiar los de otra fase…</option>{plantilla.efectiva.filter(f => f.clave !== fase.clave).map(f => <option key={f.clave} value={f.clave}>{f.numero}. {f.nombre}</option>)}</select>}
                    </div>
                    <div className="space-y-2.5">
                      {fase.requeridos.map((r, i) => {
                        const v = r.verifica
                        const tipos = cat.tiposVerificacion.filter(t => (t !== 'nota_lead' && t !== 'reunion_lead') || conLead).filter(t => (t !== 'propuesta' && t !== 'ficha_cliente' && t !== 'ficha_contacto') || comercial)
                        const cambiarV = (p: Partial<Verifica>) => cambiarReq(i, { verifica: { ...v, ...p } })
                        const nuevoTipo = (t: string) => cambiarReq(i, { formato: t === 'manual' ? 'enlace' : AUTO_FORMATO[t] ?? 'enlace', verifica: t === 'documento' ? { tipo: t, clave: 'prd' } : t === 'arquitectura' ? { tipo: t, min: 1 } : t === 'propuesta' ? { tipo: t, estados: ['SENT'] } : t === 'tareas' ? { tipo: t, min: 1, hechas_min: 0, sin_fallidas: false } : t === 'ficha_contacto' ? { tipo: t, rol: 'FIRMANTE' } : { tipo: t } })
                        return (
                          <div key={r.clave} className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: 'rgba(99,102,241,0.25)', color: '#c7d2fe' }}>{i + 1}</span>
                              <input value={r.titulo} disabled={dis} onChange={e => cambiarReq(i, { titulo: e.target.value })} placeholder="Título del entregable" className={`${campo} !text-[13px] !font-semibold`} />
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={r.verifica.tipo === 'manual' ? { background: 'rgba(245,158,11,0.15)', color: '#fcd34d' } : { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }}
                                title={r.verifica.tipo === 'manual' ? 'Una persona lo marca y deja el enlace' : 'El sistema lo comprueba solo'}>{r.verifica.tipo === 'manual' ? 'La marca una persona' : 'Automática'}</span>
                              {!dis && <Acciones i={i} total={fase.requeridos.length} max={8} minimo={1} fases={plantilla.efectiva.filter(f => f.clave !== fase.clave)}
                                onSubir={() => mover('requeridos', i, -1)} onBajar={() => mover('requeridos', i, 1)} onDuplicar={() => duplicar('requeridos', i)} onCopiar={d => copiarA('requeridos', i, d)}
                                onQuitar={() => { if (window.confirm('¿Quitar este entregable? Las marcas manuales ya hechas dejan de contar.')) cambiar({ requeridos: fase.requeridos.filter((_, j) => j !== i) }) }} />}
                            </div>
                            <div><span className={etiqueta}>Qué hay que hacer</span>
                              <input value={r.ayuda} disabled={dis} onChange={e => cambiarReq(i, { ayuda: e.target.value })} placeholder="Ayuda: qué hay que hacer para cumplirlo" className={campo} /></div>
                            <span className={etiqueta}>Cómo se verifica</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <select value={v.tipo} disabled={dis} onChange={e => nuevoTipo(e.target.value)} className={`${campo} !w-auto`}>{tipos.map(t => <option key={t} value={t}>{VERIF[t] ?? t}</option>)}</select>
                              {v.tipo === 'manual'
                                ? <select value={r.formato} disabled={dis} onChange={e => cambiarReq(i, { formato: e.target.value })} title="Formato en el que se espera el entregable" className={`${campo} !w-auto`}>{cat.formatosManuales.map(f => <option key={f} value={f}>Formato: {FORMATO[f] ?? f}</option>)}</select>
                                : <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }} title="Lo fija la verificación">Formato: {FORMATO[AUTO_FORMATO[v.tipo]] ?? AUTO_FORMATO[v.tipo]}</span>}
                              {v.tipo === 'documento' && (<>
                                <select value={v.clave ?? 'prd'} disabled={dis} onChange={e => cambiarV({ clave: e.target.value })} className={`${campo} !w-auto`}>{cat.documentos.map(d => <option key={d} value={d}>{DOC[d] ?? d}</option>)}</select>
                                <select value={v.aprobado ? 'aprobado' : v.min_requisitos ? 'req' : 'contenido'} disabled={dis} onChange={e => cambiarV({ aprobado: e.target.value === 'aprobado' ? true : undefined, min_requisitos: e.target.value === 'req' ? 1 : null })} className={`${campo} !w-auto`}>
                                  <option value="contenido">Con contenido</option><option value="aprobado">Aprobado</option><option value="req">Con requisitos</option></select>
                                {!!v.min_requisitos && <label className="flex items-center gap-1 text-[11px] text-gray-400">mínimo <input type="number" min={1} max={50} value={v.min_requisitos} disabled={dis} onChange={e => cambiarV({ min_requisitos: Number(e.target.value) || 1 })} className={`${campo} !w-16`} /></label>}
                              </>)}
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
                            </div>
                          </div>)
                      })}
                      {!dis && fase.requeridos.length < 8 && <button onClick={() => cambiar({ requeridos: [...fase.requeridos, { clave: claveDe('entregable'), titulo: '', ayuda: '', formato: 'enlace', verifica: { tipo: 'manual' } }] })} className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200"><Plus size={11} /> Añadir entregable</button>}
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
          <div className="flex items-center gap-3 px-5 py-3 border-t border-white/10 flex-shrink-0">
            <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota del cambio (opcional)" maxLength={300} className={`${campo} max-w-md`} />
            <span className="flex-1 text-[11px]">{error ? <span className="text-red-300">{error}</span> : aviso ? <span className="text-emerald-300">{aviso}</span> : sucias.length > 0 ? <span className="text-amber-300">{sucias.length} fase(s) con cambios sin guardar</span> : ''}</span>
            <button disabled={sucias.length === 0 || guardando} onClick={() => setBorrador(b => ({ ...b, [codigo]: {} }))} className="text-[11px] px-3 py-1.5 rounded-lg text-gray-300 border border-white/10 disabled:opacity-40">Descartar</button>
            <button disabled={sucias.length === 0 || guardando} onClick={() => void guardar()} className="flex items-center gap-1.5 text-[12px] px-4 py-1.5 rounded-lg text-white font-semibold disabled:opacity-40" style={{ background: 'rgba(99,102,241,0.85)' }}>
              {guardando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar y aplicar</button>
          </div>)}
      </div>
    </div>
  )
}
