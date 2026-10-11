'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, MessageSquare, History, UserCheck, RotateCcw, X, Check, Save } from 'lucide-react'
import { apiJson, fechaCorta } from './hubApi'
import { COLOR_ESTADO, ETIQUETA_ESTADO, type ArtefactoMeta } from './espacio'

interface Comentario { id: string; autorNombre: string; texto: string; resuelto: boolean; createdAt: string }
interface Version { version: number; motivo: string | null; usuarioNombre: string | null; chars: number; createdAt: string }

/** Cabecera común de todo artefacto: nombre, estado, comentarios, historial y aprobación. Funciona igual para un PRD, un lienzo o un cronograma. */
export default function CabeceraArtefacto({ solucionId, clave, titulo, Icono, meta, esAdmin, sucio, otrosCambios, guardando, onGuardar, onCambio, onRestaurar }: {
  solucionId: string
  clave: string | null
  titulo: string
  Icono: React.ComponentType<{ size?: number; className?: string }>
  meta: ArtefactoMeta | undefined
  esAdmin: boolean
  sucio: boolean
  /** Hay cambios sin guardar en otra pieza: guardar los guarda todos. */
  otrosCambios?: boolean
  guardando: boolean
  onGuardar: () => void
  /** Algo cambió en el servidor (estado, comentarios): hay que volver a leer. */
  onCambio: (clave: string) => void
  onRestaurar: (clave: string, contenido: string) => void
}) {
  const [panel, setPanel] = useState<'comentarios' | 'versiones' | null>(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function cambiarEstado(estado: string) {
    if (!clave) return
    setError(''); setOcupado(true)
    try { await apiJson(`/api/soluciones/${solucionId}/artefactos/${clave}/estado`, { method: 'PUT', body: JSON.stringify({ estado }) }); onCambio(clave) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado') }
    finally { setOcupado(false) }
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Icono size={16} className="text-orange-400" />
        <h2 className="text-[15px] font-semibold text-gray-100 mr-1">{titulo}</h2>
        {meta && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${COLOR_ESTADO[meta.estado]}`}
            title={meta.aprobacion?.porNombre ? `Aprobado por ${meta.aprobacion.porNombre}${meta.aprobacion.en ? ` el ${fechaCorta(meta.aprobacion.en)}` : ''}` : meta.reabierto ? 'Volvió a revisión porque se editó después de aprobarse' : undefined}>
            {ETIQUETA_ESTADO[meta.estado]}
          </span>
        )}
        {meta?.estado === 'APROBADO' && meta.aprobacion?.porNombre && <span className="text-[11px] text-gray-500">por {meta.aprobacion.porNombre}{meta.aprobacion.en ? ` · ${fechaCorta(meta.aprobacion.en)}` : ''}</span>}
        {meta?.estado === 'EN_REVISION' && meta.reabierto && <span className="text-[11px] text-amber-400/80">volvió a revisión tras una edición</span>}
        <span className="flex-1" />
        {sucio && <span className="text-[11px] text-orange-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />Sin guardar</span>}
        {clave && (
          <>
            <button type="button" onClick={() => setPanel(p => (p === 'comentarios' ? null : 'comentarios'))} title="Comentarios de este artefacto"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-700 text-gray-300 hover:bg-white/5 text-xs">
              <MessageSquare size={12} /> {meta?.comentarios ? meta.comentarios : ''}
            </button>
            <button type="button" onClick={() => setPanel(p => (p === 'versiones' ? null : 'versiones'))} title="Historial de versiones"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-700 text-gray-300 hover:bg-white/5 text-xs">
              <History size={12} /> {meta?.versiones ? `v${meta.versiones + 1}` : 'v1'}
            </button>
            {meta?.estado !== 'EN_REVISION' && meta?.estado !== 'APROBADO' && (
              <button type="button" onClick={() => void cambiarEstado('EN_REVISION')} disabled={ocupado || sucio} title={sucio ? 'Guarda primero' : 'Pedir revisión'}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-700 text-gray-300 hover:bg-white/5 text-xs disabled:opacity-40">Pedir revisión</button>
            )}
            {meta?.estado === 'APROBADO' ? (
              esAdmin && <button type="button" onClick={() => void cambiarEstado('EN_REVISION')} disabled={ocupado} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-700 text-gray-300 hover:bg-white/5 text-xs disabled:opacity-40"><RotateCcw size={12} /> Reabrir</button>
            ) : (
              <button type="button" onClick={() => void cambiarEstado('APROBADO')} disabled={ocupado || sucio || !esAdmin}
                title={!esAdmin ? 'Solo un administrador aprueba' : sucio ? 'Guarda primero' : 'Aprobar'}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/20 text-xs disabled:opacity-40">
                {ocupado ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />} Aprobar
              </button>
            )}
          </>
        )}
        <button type="button" onClick={onGuardar} disabled={guardando || (!sucio && !otrosCambios)}
          title={!sucio && otrosCambios ? 'Hay cambios sin guardar en otras piezas: se guardan todos' : undefined}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-400 text-white text-xs font-semibold">
          {guardando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      {clave && panel === 'comentarios' && <Comentarios solucionId={solucionId} clave={clave} onCambio={() => onCambio(clave)} onCerrar={() => setPanel(null)} />}
      {clave && panel === 'versiones' && <Versiones solucionId={solucionId} clave={clave} onRestaurar={c => { onRestaurar(clave, c); setPanel(null) }} onCerrar={() => setPanel(null)} />}
    </div>
  )
}

function Comentarios({ solucionId, clave, onCambio, onCerrar }: { solucionId: string; clave: string; onCambio: () => void; onCerrar: () => void }) {
  const [lista, setLista] = useState<Comentario[] | null>(null)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const url = `/api/soluciones/${solucionId}/artefactos/${clave}/comentarios`
  const cargar = useCallback(() => { apiJson<Comentario[]>(url).then(l => setLista(Array.isArray(l) ? l : [])).catch(e => setError(e instanceof Error ? e.message : 'Error')) }, [url])
  useEffect(() => { cargar() }, [cargar])

  async function enviar() {
    if (!texto.trim()) return
    setEnviando(true); setError('')
    try { await apiJson(url, { method: 'POST', body: JSON.stringify({ texto }) }); setTexto(''); cargar(); onCambio() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo comentar') }
    finally { setEnviando(false) }
  }
  async function resolver(c: Comentario) {
    try { await apiJson(`/api/comentarios-artefacto/${c.id}`, { method: 'PUT', body: JSON.stringify({ resuelto: !c.resuelto }) }); cargar(); onCambio() }
    catch (e) { setError(e instanceof Error ? e.message : 'Error') }
  }
  return (
    <div className="mt-2 rounded-xl border border-gray-700 bg-gray-950/70 p-3 space-y-2">
      <div className="flex items-center justify-between"><p className="text-xs font-semibold text-gray-300">Comentarios</p><button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-gray-500 hover:text-gray-300"><X size={13} /></button></div>
      {!lista && !error && <Loader2 size={14} className="animate-spin text-gray-500" />}
      {lista && lista.length === 0 && <p className="text-xs text-gray-500">Todavía no hay comentarios.</p>}
      <ul className="space-y-1.5 max-h-52 overflow-y-auto">
        {(lista ?? []).map(c => (
          <li key={c.id} className={`rounded-lg px-2.5 py-1.5 text-xs ${c.resuelto ? 'bg-gray-900/40 text-gray-500' : 'bg-gray-900 text-gray-200'}`}>
            <div className="flex items-center gap-2"><b className="font-medium">{c.autorNombre}</b><span className="text-gray-500">{fechaCorta(c.createdAt)}</span>
              <button type="button" onClick={() => void resolver(c)} className="ml-auto inline-flex items-center gap-1 text-gray-400 hover:text-emerald-300"><Check size={11} /> {c.resuelto ? 'Reabrir' : 'Resolver'}</button></div>
            <p className={`mt-0.5 whitespace-pre-line ${c.resuelto ? 'line-through' : ''}`}>{c.texto}</p>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void enviar() }} placeholder="Escribe un comentario"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-500" />
        <button type="button" onClick={() => void enviar()} disabled={enviando || !texto.trim()} className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-40">Comentar</button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

function Versiones({ solucionId, clave, onRestaurar, onCerrar }: { solucionId: string; clave: string; onRestaurar: (contenido: string) => void; onCerrar: () => void }) {
  const [lista, setLista] = useState<Version[] | null>(null)
  const [error, setError] = useState('')
  const [trayendo, setTrayendo] = useState<number | null>(null)
  useEffect(() => { apiJson<Version[]>(`/api/soluciones/${solucionId}/artefactos/${clave}/versiones`).then(l => setLista(Array.isArray(l) ? l : [])).catch(e => setError(e instanceof Error ? e.message : 'Error')) }, [solucionId, clave])
  async function traer(v: Version) {
    if (!window.confirm(`Traer la versión ${v.version} al editor? Reemplaza lo que ves; no se guarda hasta que pulses «Guardar» (y lo actual queda en el historial).`)) return
    setTrayendo(v.version)
    try { const d = await apiJson<{ contenido: string }>(`/api/soluciones/${solucionId}/artefactos/${clave}/versiones/${v.version}`); onRestaurar(d.contenido) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo traer la versión') }
    finally { setTrayendo(null) }
  }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onCerrar}>
      <div className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl p-5 bg-[#0e0a1c] border border-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2"><History size={15} /> Historial</h3><button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-gray-500 hover:text-gray-200"><X size={16} /></button></div>
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        {!lista && !error && <div className="flex justify-center py-6"><Loader2 className="text-cyan-500 animate-spin" size={20} /></div>}
        {lista && lista.length === 0 && <p className="text-xs text-gray-500 py-4">Todavía no hay versiones anteriores: aparecen cuando se guarda una edición.</p>}
        <ul className="divide-y divide-white/5">
          {(lista ?? []).map(v => (
            <li key={v.version} className="flex items-center gap-3 py-2 text-xs">
              <span className="w-8 text-gray-500">v{v.version}</span>
              <span className="flex-1 min-w-0"><span className="block text-gray-300 truncate">{v.motivo ?? 'Versión guardada'}</span><span className="text-gray-500">{fechaCorta(v.createdAt)}{v.usuarioNombre ? ` · ${v.usuarioNombre}` : ''} · {Math.max(1, Math.round(v.chars / 1000))} mil caracteres</span></span>
              <button type="button" onClick={() => void traer(v)} disabled={trayendo !== null} className="px-2.5 py-1 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:bg-white/5 disabled:opacity-50">{trayendo === v.version ? '…' : 'Traer al editor'}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
