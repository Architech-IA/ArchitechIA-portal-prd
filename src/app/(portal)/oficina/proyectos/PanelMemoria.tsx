'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Save, Check, X, History, Sparkles, AlertTriangle } from 'lucide-react'
import { api, put, post, ErrorApi, fechaHora } from './api'

interface Memoria { contenido: string; version: number; actualizadoPor: string | null; updatedAt: string | null }
interface VersionRes { version: number; origen: string; autor: string | null; nota: string | null; createdAt: string }
interface Propuesta { id: string; contenidoPropuesto: string; resumenCambios: string; baseVersion: number; createdAt: string }

const PLANTILLA = '# Memoria del proyecto\n\n## Decisiones\n\n## Acuerdos con el cliente\n\n## Restricciones\n\n## Glosario\n\n## Pendientes y preguntas abiertas\n'

// Líneas nuevas de la propuesta respecto a la memoria vigente (para revisarla de un vistazo)
function diff(actual: string, propuesta: string) {
  const a = new Set(actual.split('\n').map(l => l.trim()).filter(Boolean))
  return propuesta.split('\n').map(l => ({ l, nueva: !!l.trim() && !a.has(l.trim()) }))
}

export default function PanelMemoria({ proyectoId, onCambio }: { proyectoId: string; onCambio: () => void }) {
  const [mem, setMem] = useState<Memoria | null>(null)
  const [versiones, setVersiones] = useState<VersionRes[]>([])
  const [propuestas, setPropuestas] = useState<Propuesta[]>([])
  const [texto, setTexto] = useState('')
  const [nota, setNota] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [verVersiones, setVerVersiones] = useState(false)
  const [editada, setEditada] = useState<Record<string, string>>({})
  const [resolviendo, setResolviendo] = useState<string | null>(null)

  const cargar = useCallback(async (mantenerBorrador = false) => {
    setCargando(true); setError(null)
    try {
      const r = await api<{ memoria: Memoria; versiones: VersionRes[]; propuestas: Propuesta[] }>(`/api/proyectos/${proyectoId}/memoria`)
      setMem(r.memoria); setVersiones(r.versiones); setPropuestas(r.propuestas)
      if (!mantenerBorrador) setTexto(r.memoria.contenido)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la memoria') } finally { setCargando(false) }
  }, [proyectoId])
  useEffect(() => { void cargar() }, [cargar])

  const sucio = mem ? texto !== mem.contenido : false

  async function guardar() {
    if (!mem || guardando) return
    setGuardando(true); setError(null); setOk(null)
    try {
      const r = await put<{ version: number }>(`/api/proyectos/${proyectoId}/memoria`, { contenido: texto, nota, baseVersion: mem.version })
      setOk(`Guardada como versión ${r.version}`); setNota(''); await cargar(); onCambio()
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 409) setError('Otra persona guardó una versión nueva mientras editabas. Recarga para ver la vigente (tu borrador se conserva en el cuadro).')
      else setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally { setGuardando(false) }
  }

  async function verVersion(v: number) {
    try {
      const r = await api<{ contenido: string }>(`/api/proyectos/${proyectoId}/memoria?version=${v}`)
      if (sucio && !window.confirm('Tienes cambios sin guardar. ¿Cargar la versión antigua como borrador?')) return
      setTexto(r.contenido); setOk(`Versión ${v} cargada como borrador: guarda para restaurarla como una versión nueva.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la versión') }
  }

  async function resolver(p: Propuesta, accion: 'aprobar' | 'rechazar', forzar = false) {
    setResolviendo(p.id); setError(null); setOk(null)
    try {
      await post(`/api/proyectos/${proyectoId}/memoria/propuestas/${p.id}`, { accion, contenido: editada[p.id], forzar })
      setOk(accion === 'aprobar' ? 'Propuesta aprobada: la memoria tiene una versión nueva.' : 'Propuesta rechazada.')
      await cargar(); onCambio()
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 409 && (e.data as { requiereConfirmar?: boolean }).requiereConfirmar) {
        if (window.confirm('La memoria cambió después de generar esta propuesta. ¿Reemplazar igualmente por el texto de la propuesta? (la versión actual queda en el historial)')) return resolver(p, accion, true)
      } else setError(e instanceof Error ? e.message : 'No se pudo resolver')
    } finally { setResolviendo(null) }
  }

  const lineas = useMemo(() => propuestas.map(p => ({ id: p.id, d: diff(mem?.contenido ?? '', editada[p.id] ?? p.contenidoPropuesto) })), [propuestas, mem, editada])

  if (cargando && !mem) return <div className="flex justify-center py-10 text-gray-500"><Loader2 size={16} className="animate-spin" /></div>
  return (
    <div className="p-3 space-y-3">
      <p className="text-[11px] text-gray-500">Documento corto y curado (decisiones, acuerdos, restricciones, glosario). <b className="text-gray-300">La IA lo lee en todas las sesiones</b> del proyecto. Al cerrar una sesión propone cambios que tú apruebas.</p>

      {propuestas.map(p => (
        <div key={p.id} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-200"><Sparkles size={12} /> Propuesta de la IA · {fechaHora(p.createdAt)}</div>
          {p.resumenCambios && <p className="text-[11px] text-gray-300">{p.resumenCambios}</p>}
          {(mem?.version ?? 0) !== p.baseVersion && <p className="text-[10px] text-amber-400 flex items-center gap-1"><AlertTriangle size={11} /> Se calculó sobre la versión {p.baseVersion}; la vigente es la {mem?.version}.</p>}
          {editada[p.id] === undefined ? (
            <div className="max-h-56 overflow-y-auto rounded-lg px-2 py-1.5 font-mono text-[10px] leading-relaxed" style={{ background: 'rgba(0,0,0,0.3)' }}>
              {lineas.find(x => x.id === p.id)!.d.map((x, i) => <div key={i} className={x.nueva ? 'text-emerald-300 bg-emerald-500/10' : 'text-gray-500'}>{x.l || ' '}</div>)}
            </div>
          ) : (
            <textarea value={editada[p.id]} onChange={e => setEditada(prev => ({ ...prev, [p.id]: e.target.value }))} rows={10}
              className="w-full rounded-lg px-2 py-1.5 font-mono text-[10px] text-gray-200 outline-none resize-y border border-white/10 focus:border-indigo-500/50" style={{ background: 'rgba(0,0,0,0.3)' }} />
          )}
          <p className="text-[9px] text-gray-600">En verde: líneas nuevas respecto a la memoria vigente.</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditada(prev => { const n = { ...prev }; if (n[p.id] === undefined) n[p.id] = p.contenidoPropuesto; else delete n[p.id]; return n })} className="text-[10px] text-gray-400 hover:text-gray-200 underline underline-offset-2">{editada[p.id] === undefined ? 'Editar antes de aprobar' : 'Ver cambios'}</button>
            <span className="flex-1" />
            <button onClick={() => void resolver(p, 'rechazar')} disabled={resolviendo === p.id} className="px-2.5 py-1 rounded-lg text-[10px] text-gray-300 border border-white/10 hover:bg-white/5 flex items-center gap-1"><X size={11} /> Rechazar</button>
            <button onClick={() => void resolver(p, 'aprobar')} disabled={resolviendo === p.id} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white flex items-center gap-1" style={{ background: 'rgba(16,185,129,0.75)' }}>
              {resolviendo === p.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Aprobar
            </button>
          </div>
        </div>
      ))}

      <div>
        <div className="flex items-center justify-between mb-1 text-[10px] text-gray-500">
          <span>{mem && mem.version > 0 ? `Versión ${mem.version} · ${mem.actualizadoPor ?? ''}${mem.updatedAt ? ' · ' + fechaHora(mem.updatedAt) : ''}` : 'Aún no hay memoria'}</span>
          {mem && mem.version === 0 && texto === '' && <button onClick={() => setTexto(PLANTILLA)} className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2">Usar plantilla</button>}
        </div>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={14} spellCheck={false} placeholder="# Memoria del proyecto…"
          className="w-full rounded-xl px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-200 outline-none resize-y border border-white/10 focus:border-indigo-500/50 placeholder-gray-700" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="flex items-center gap-2 mt-1.5">
          <input value={nota} onChange={e => setNota(e.target.value)} maxLength={200} placeholder="Nota del cambio (opcional)"
            className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-300 outline-none border border-white/10 focus:border-indigo-500/50 placeholder-gray-600" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <button onClick={() => void guardar()} disabled={!sucio || guardando} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-40 flex items-center gap-1.5" style={{ background: 'rgba(99,102,241,0.85)' }}>
            {guardando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
          </button>
        </div>
        <p className="text-[9px] text-gray-600 mt-1">{texto.length.toLocaleString('es-CO')} / 30.000 caracteres</p>
      </div>

      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {ok && <p className="text-[11px] text-emerald-400">{ok}</p>}

      <div>
        <button onClick={() => setVerVersiones(v => !v)} className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-200"><History size={12} /> Historial de versiones ({versiones.length})</button>
        {verVersiones && (
          <ul className="mt-1.5 space-y-1">
            {versiones.map(v => (
              <li key={v.version}>
                <button onClick={() => void verVersion(v.version)} className="w-full text-left rounded-lg px-2.5 py-1.5 hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-2 text-[11px] text-gray-300"><span className="font-semibold">v{v.version}</span>
                    <span className="text-[9px] px-1.5 rounded-full" style={{ background: v.origen === 'IA' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)', color: v.origen === 'IA' ? '#a5b4fc' : '#9ca3af' }}>{v.origen}</span>
                    <span className="flex-1 truncate text-gray-500">{v.autor}</span></div>
                  <p className="text-[10px] text-gray-600 truncate">{fechaHora(v.createdAt)}{v.nota ? ' · ' + v.nota : ''}</p>
                </button>
              </li>))}
          </ul>)}
      </div>
    </div>
  )
}
