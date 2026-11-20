'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, ChevronDown, ChevronRight, FilePlus2 } from 'lucide-react'
import { api, post, put, hace } from './api'

// Operación (MASD-0026-0007): incidentes y solicitudes de cambio de un proyecto en uso. Un incidente no se cierra con un parche
// suelto: para cerrarlo se enlaza al requisito (REQ-###) que lo recoge y a la versión que lo corrige.

interface Caso {
  id: string; tipo: 'INCIDENTE' | 'SOLICITUD_CAMBIO'; codigo: string; titulo: string; descripcion: string; severidad: string; estado: string
  reqCodigo: string | null; propuestaId: string | null; versionCierre: string | null; facturable: boolean; nota: string | null; reportadoPor: string | null; reportadoEn: string
}
interface Datos { casos: Caso[]; resumen: { incidentes: { abiertos: number; cerrados: number }; solicitudes: { abiertas: number; cerradas: number } } }

const ESTADOS = [['ABIERTO', 'Abierto'], ['EN_ANALISIS', 'En análisis'], ['EN_CORRECCION', 'En corrección'], ['CERRADO', 'Cerrado'], ['RECHAZADO', 'Rechazado']]
const SEV: Record<string, string> = { CRITICA: '#f87171', ALTA: '#fb923c', MEDIA: '#fbbf24', BAJA: '#94a3b8' }
const campo = 'w-full bg-transparent rounded px-2 py-1.5 text-[12px] text-gray-100'
const borde = { border: '1px solid rgba(255,255,255,0.15)' }

export default function PanelOperacion({ proyectoId }: { proyectoId: string }) {
  const [d, setD] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [form, setForm] = useState({ tipo: 'INCIDENTE', titulo: '', descripcion: '', severidad: 'MEDIA', facturable: false })
  const [enviando, setEnviando] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [edit, setEdit] = useState<{ reqCodigo: string; versionCierre: string; nota: string }>({ reqCodigo: '', versionCierre: '', nota: '' })
  const [trabajando, setTrabajando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try { setD(await api<Datos>(`/api/proyectos/${proyectoId}/operacion`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer la operación') }
  }, [proyectoId])
  useEffect(() => { void cargar() }, [cargar])

  async function crear() {
    setEnviando(true); setError(null)
    try { await post(`/api/proyectos/${proyectoId}/operacion`, form); setForm({ tipo: 'INCIDENTE', titulo: '', descripcion: '', severidad: 'MEDIA', facturable: false }); setNuevo(false); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') }
    finally { setEnviando(false) }
  }

  async function cambiar(c: Caso, cambios: Record<string, unknown>) {
    setTrabajando(c.id); setError(null)
    try { await put(`/api/proyectos/${proyectoId}/operacion/${c.id}`, cambios); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar') }
    finally { setTrabajando(null) }
  }

  async function proponer(c: Caso) {
    setTrabajando(c.id); setError(null)
    try { await post(`/api/proyectos/${proyectoId}/operacion/${c.id}/proponer-requisito`); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo proponer') }
    finally { setTrabajando(null) }
  }

  function abrir(c: Caso) {
    if (abierto === c.id) { setAbierto(null); return }
    setAbierto(c.id); setEdit({ reqCodigo: c.reqCodigo ?? '', versionCierre: c.versionCierre ?? '', nota: c.nota ?? '' })
  }

  if (!d && !error) return <div className="p-6 flex justify-center text-[#7f8a9c]"><Loader2 className="animate-spin" size={18} /></div>
  return (
    <div className="p-3 space-y-3">
      {error && <p role="alert" className="text-[11px] text-red-300 rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>{error}</p>}
      {d && (
        <p className="text-[11px] text-[#9aa6b8]">
          Incidentes: <b className="text-gray-200">{d.resumen.incidentes.abiertos}</b> abiertos · {d.resumen.incidentes.cerrados} cerrados. Solicitudes de cambio: <b className="text-gray-200">{d.resumen.solicitudes.abiertas}</b> abiertas · {d.resumen.solicitudes.cerradas} cerradas.
        </p>)}

      {!nuevo
        ? <button onClick={() => setNuevo(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-indigo-100 hover:bg-white/10" style={{ border: '1px solid rgba(99,102,241,0.45)' }}><Plus size={12} />Registrar un caso</button>
        : (
          <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-gray-300">Tipo
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className={campo + ' mt-1'} style={borde}>
                  <option value="INCIDENTE" style={{ color: '#111' }}>Incidente</option><option value="SOLICITUD_CAMBIO" style={{ color: '#111' }}>Solicitud de cambio</option></select></label>
              <label className="text-[11px] text-gray-300">Severidad
                <select value={form.severidad} onChange={e => setForm({ ...form, severidad: e.target.value })} className={campo + ' mt-1'} style={borde}>
                  {['CRITICA', 'ALTA', 'MEDIA', 'BAJA'].map(s => <option key={s} value={s} style={{ color: '#111' }}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</select></label>
            </div>
            <label className="block text-[11px] text-gray-300">Título
              <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="El recordatorio llegó una hora tarde" className={campo + ' mt-1'} style={borde} /></label>
            <label className="block text-[11px] text-gray-300">Qué pasó o qué se pide
              <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={4} className={campo + ' mt-1 resize-y'} style={borde} /></label>
            <label className="flex items-center gap-2 text-[11px] text-gray-300"><input type="checkbox" checked={form.facturable} onChange={e => setForm({ ...form, facturable: e.target.checked })} />Es facturable (sale del alcance acordado)</label>
            <div className="flex gap-2">
              <button onClick={() => void crear()} disabled={enviando || !form.titulo.trim()} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-indigo-100 disabled:opacity-50" style={{ background: 'rgba(99,102,241,0.3)' }}>{enviando && <Loader2 size={12} className="animate-spin" />}Guardar</button>
              <button onClick={() => setNuevo(false)} className="px-2.5 py-1.5 rounded text-[11px] text-[#9aa6b8] hover:bg-white/5">Cancelar</button>
            </div>
          </div>)}

      {d && d.casos.length === 0 && !nuevo && <p className="text-[11px] text-[#7f8a9c] text-center py-4">Aún no hay incidentes ni solicitudes de cambio.</p>}

      <ul className="space-y-1.5">
        {(d?.casos ?? []).map(c => {
          const ab = abierto === c.id
          const cerrado = c.estado === 'CERRADO' || c.estado === 'RECHAZADO'
          return (
            <li key={c.id} className="rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', opacity: cerrado ? 0.7 : 1 }}>
              <button onClick={() => abrir(c)} aria-expanded={ab} className="w-full flex items-start gap-2 px-2.5 py-2 text-left">
                {ab ? <ChevronDown size={13} className="mt-0.5 text-[#7f8a9c] flex-shrink-0" /> : <ChevronRight size={13} className="mt-0.5 text-[#7f8a9c] flex-shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-gray-100 leading-snug"><span className="font-mono text-[10.5px] text-indigo-300">{c.codigo}</span> · {c.titulo}</span>
                  <span className="flex flex-wrap gap-x-2 text-[10.5px] text-[#9aa6b8]">
                    <span style={{ color: SEV[c.severidad] }}>● {c.severidad.charAt(0) + c.severidad.slice(1).toLowerCase()}</span>
                    <span>{ESTADOS.find(e => e[0] === c.estado)?.[1] ?? c.estado}</span>
                    {c.facturable && <span className="text-sky-300">facturable</span>}
                    {c.reqCodigo && <span>→ {c.reqCodigo}</span>}
                    <span>{hace(c.reportadoEn)}</span>
                  </span>
                </span>
              </button>
              {ab && (
                <div className="px-3 pb-3 space-y-2 text-[11px] text-[#9aa6b8]">
                  {c.descripcion && <p className="text-gray-300 whitespace-pre-wrap">{c.descripcion}</p>}
                  <label className="block">Estado
                    <select value={c.estado} disabled={trabajando === c.id} onChange={e => void cambiar(c, { estado: e.target.value, ...(e.target.value === 'CERRADO' || e.target.value === 'RECHAZADO' ? { reqCodigo: edit.reqCodigo || undefined, versionCierre: edit.versionCierre || undefined, nota: edit.nota || undefined } : {}) })}
                      className={campo + ' mt-1'} style={borde}>{ESTADOS.map(([k, v]) => <option key={k} value={k} style={{ color: '#111' }}>{v}</option>)}</select></label>
                  <div className="grid grid-cols-2 gap-2">
                    <label>Requisito (REQ-001)<input value={edit.reqCodigo} onChange={e => setEdit({ ...edit, reqCodigo: e.target.value })} placeholder="REQ-014" className={campo + ' mt-1'} style={borde} /></label>
                    <label>Versión que lo corrige<input value={edit.versionCierre} onChange={e => setEdit({ ...edit, versionCierre: e.target.value })} placeholder="1.1" className={campo + ' mt-1'} style={borde} /></label>
                  </div>
                  <label className="block">Nota (motivo si se rechaza)<input value={edit.nota} onChange={e => setEdit({ ...edit, nota: e.target.value })} className={campo + ' mt-1'} style={borde} /></label>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => void cambiar(c, { reqCodigo: edit.reqCodigo || undefined, versionCierre: edit.versionCierre || undefined, nota: edit.nota || undefined })} disabled={trabajando === c.id} className="px-2 py-1 rounded text-[10.5px] text-indigo-100 disabled:opacity-50" style={{ border: '1px solid rgba(99,102,241,0.45)' }}>Guardar datos</button>
                    {!c.propuestaId
                      ? <button onClick={() => void proponer(c)} disabled={trabajando === c.id} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] text-emerald-200 disabled:opacity-50" style={{ border: '1px solid rgba(52,211,153,0.4)' }}><FilePlus2 size={11} />Proponer como requisito del PRD</button>
                      : <span className="text-[10.5px] text-emerald-300">✓ Propuesta de requisito creada (Artefactos › Propuestas)</span>}
                  </div>
                </div>)}
            </li>)
        })}
      </ul>
    </div>
  )
}
