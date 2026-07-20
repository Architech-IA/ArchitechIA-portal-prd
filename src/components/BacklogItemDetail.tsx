'use client'

import { useState, useEffect } from 'react'
import { X, ArrowRight, CheckCircle2, Clock, Loader2, Flag, Pencil, Trash2, FileText, Upload, CalendarClock } from 'lucide-react'

interface BacklogItem {
  id: string
  title: string
  description: string | null
  type: string
  priority: string
  status: string
  points: number | null
  solucionId: string | null
  solucion: { id: string; nombre: string; tipo: string } | null
  assigneeId: string | null
  assigneeName: string | null
  createdAt: string
  updatedAt: string
  resultado: string | null
  fechaEjecucion: string | null
}

interface Log {
  id: string
  itemId: string
  fromStatus: string | null
  toStatus: string
  note: string | null
  userName: string | null
  createdAt: string
}

interface Props {
  item: BacklogItem
  onClose: () => void
  onStatusChange: (item: BacklogItem, newStatus: string) => void
  currentUserName: string
  onEdit: () => void
  onDelete: () => void
}

const STATUSES = [
  { key: 'BACKLOG',     label: 'Backlog',      color: 'bg-gray-500/20 text-gray-400 border-gray-500/30'      },
  { key: 'IN_PROGRESS', label: 'En Progreso',  color: 'bg-blue-500/20 text-blue-400 border-blue-500/30'      },
  { key: 'BLOCKED',     label: 'Bloqueado',    color: 'bg-red-500/20 text-red-400 border-red-500/30'          },
  { key: 'DONE',        label: 'Done',         color: 'bg-green-500/20 text-green-400 border-green-500/30'    },
]

const NEXT_STATUS: Record<string, string> = {
  BACKLOG:     'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  BLOCKED:     'IN_PROGRESS',
  DONE:        'DONE',
}

const TYPE_LABELS: Record<string, string> = {
  FEATURE: 'Feature', BUG: 'Bug', TASK: 'Tarea', IMPROVEMENT: 'Mejora',
  TECH_DEBT: 'Deuda técnica', DESARROLLO: 'Desarrollo',
  COTIZACION: 'Cotización', DOCUMENTACION: 'Documentación', INVESTIGACION: 'Investigación',
}

const PRIORITY_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  CRITICAL: { label: 'Crítica', color: 'text-red-400',    dot: 'bg-red-500'    },
  HIGH:     { label: 'Alta',    color: 'text-orange-400', dot: 'bg-orange-500' },
  MEDIUM:   { label: 'Media',   color: 'text-yellow-400', dot: 'bg-yellow-500' },
  LOW:      { label: 'Baja',    color: 'text-gray-400',   dot: 'bg-gray-500'   },
}

const SOLUCION_TIPO_LABELS: Record<string, string> = {
  PROJECT: 'Proyecto', DEMO: 'Demo', PARTNERSHIP: 'Partnership', PRODUCT: 'Producto', INTERN: 'Intern',
}

const inputCls = 'w-full rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none transition-all'

export default function BacklogItemDetail({ item, onClose, onStatusChange, currentUserName, onEdit, onDelete }: Props) {
  const [logs, setLogs]             = useState<Log[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [resultado, setResultado] = useState(item.resultado ?? '')
  const [savingResultado, setSavingResultado] = useState(false)
  const [resultadoDirty, setResultadoDirty] = useState(false)
  const [note, setNote]             = useState('')
  const [nextStatus, setNextStatus] = useState(NEXT_STATUS[item.status] ?? item.status)
  const [saving, setSaving]         = useState(false)

  const st = STATUSES.find(s => s.key === item.status)
  const pr = PRIORITY_LABELS[item.priority]

  useEffect(() => {
    fetch(`/api/backlog/logs?itemId=${item.id}`)
      .then(r => r.json())
      .then(d => { setLogs(Array.isArray(d) ? d : []); setLoadingLogs(false) })
  }, [item.id])

  const confirmTransition = async () => {
    if (nextStatus === item.status && !note.trim()) return
    setSaving(true)
    await fetch('/api/backlog/logs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, fromStatus: item.status, toStatus: nextStatus, note: note.trim() || null }),
    })
    if (nextStatus !== item.status) {
      await onStatusChange(item, nextStatus)
    }
    const updated = await fetch(`/api/backlog/logs?itemId=${item.id}`).then(r => r.json())
    setLogs(Array.isArray(updated) ? updated : [])
    setNote('')
    setSaving(false)
  }

  const confirmTransitionTo = async (toStatus: string) => {
    setSaving(true)
    await fetch('/api/backlog/logs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, fromStatus: item.status, toStatus, note: null }),
    })
    await onStatusChange(item, toStatus)
    const updated = await fetch(`/api/backlog/logs?itemId=${item.id}`).then(r => r.json())
    setLogs(Array.isArray(updated) ? updated : [])
    setSaving(false)
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const statusLabel = (key: string) => STATUSES.find(s => s.key === key)?.label ?? key

  const saveResultado = async () => {
    setSavingResultado(true)
    await fetch(`/api/backlog/${item.id}/resultado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resultado: resultado || null }),
    })
    setSavingResultado(false)
    setResultadoDirty(false)
  }

  const [fechaEjecucion, setFechaEjecucion] = useState<string>(
    item.fechaEjecucion ? new Date(item.fechaEjecucion).toISOString().slice(0, 16) : ''
  )
  const [savingFecha, setSavingFecha] = useState(false)
  const [fechaDirty, setFechaDirty] = useState(false)

  const saveFechaEjecucion = async (val: string) => {
    setSavingFecha(true)
    await fetch(`/api/backlog/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, fechaEjecucion: val || null }),
    })
    setSavingFecha(false)
    setFechaDirty(false)
  }

  const importMarkdown = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.txt'
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        setResultado(ev.target?.result as string ?? '')
        setResultadoDirty(true)
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ maxWidth: '800px', background: 'rgba(10,12,28,0.98)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        {/* Accent bar */}
        <div className="h-0.5 w-full flex-shrink-0" style={{ background: 'linear-gradient(90deg, #f97316, #fb923c44)' }} />

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${st?.color}`}>{st?.label}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>{TYPE_LABELS[item.type] ?? item.type}</span>
              <span className={`flex items-center gap-1 text-[10px] ${pr?.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${pr?.dot}`} /> {pr?.label}
              </span>
              {item.points && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.07)', color: '#d1d5db' }}>{item.points}pt</span>
              )}
              <div className="w-px h-3 mx-1" style={{ background: 'rgba(255,255,255,0.12)' }} />
              <button onClick={onEdit} className="text-gray-600 hover:text-white transition-colors" title="Editar"><Pencil size={12} /></button>
              <button onClick={onDelete} className="text-gray-600 hover:text-red-400 transition-colors" title="Eliminar"><Trash2 size={12} /></button>
              <div className="w-px h-3 mx-1" style={{ background: 'rgba(255,255,255,0.12)' }} />
              <span title="Creado" className="text-[10px] font-mono px-1.5 py-0.5 rounded cursor-default" style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>{new Date(item.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              <span title="Actualizado" className="text-[10px] font-mono px-1.5 py-0.5 rounded cursor-default" style={{ background: 'rgba(249,115,22,0.08)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.15)' }}>{new Date(item.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            </div>
            <h2 className="text-base font-semibold text-white leading-snug">{item.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body — 2 columns */}
        <div className="flex-1 overflow-hidden flex" style={{ borderTop: 'none' }}>

          {/* Left: info + traceability */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Meta cards — solo Responsable + Solución */}
              <div className="flex flex-wrap gap-3">
                {item.assigneeName && (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[9px] font-bold text-black flex-shrink-0">
                      {item.assigneeName.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Responsable</p>
                      <p className="text-sm text-white font-medium">{item.assigneeName}</p>
                    </div>
                  </div>
                )}
                {item.solucion && (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div className="w-1.5 h-7 rounded-full bg-emerald-500/60 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] text-emerald-400 uppercase tracking-wide leading-none mb-0.5">Solución asociada</p>
                      <p className="text-sm text-emerald-400 font-medium">{SOLUCION_TIPO_LABELS[item.solucion.tipo] ?? item.solucion.tipo}: {item.solucion.nombre}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {item.description && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
                    </svg>
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Descripción</p>
                  </div>
                  <div className="px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{item.description}</p>
                  </div>
                </div>
              )}


              {/* Resultado */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <FileText size={11} className="text-gray-500" />
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Resultado</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={importMarkdown}
                      title="Importar archivo .md"
                      className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-orange-400 transition-colors px-2 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <Upload size={9} />
                      <span>Importar .md</span>
                    </button>

                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <textarea
                    value={resultado}
                    onChange={e => { setResultado(e.target.value); setResultadoDirty(true) }}
                    placeholder="Documentá el resultado, qué se logró, evidencias, notas de cierre… (acepta Markdown)"
                    rows={6}
                    className="w-full text-sm text-gray-300 placeholder-gray-700 focus:outline-none resize-y"
                    style={{ background: 'transparent', padding: '12px 16px', lineHeight: '1.6', minHeight: '120px', fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}
                  />
                </div>
              </div>
              {/* Fecha de ejecución */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <CalendarClock size={11} className="text-gray-500" />
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Fecha de ejecución</p>
                </div>
                <div className="px-4 py-3 flex gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <input
                    type="datetime-local"
                    value={fechaEjecucion}
                    onChange={e => { setFechaEjecucion(e.target.value); setFechaDirty(true) }}
                    className="flex-1 rounded-lg text-[11px] text-white focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', padding: '7px 10px', colorScheme: 'dark' }}
                  />
                  {fechaDirty && (
                    <button
                      onClick={() => saveFechaEjecucion(fechaEjecucion)}
                      disabled={savingFecha}
                      className="px-3 rounded-lg text-[10px] font-semibold text-white flex-shrink-0 transition-colors disabled:opacity-50"
                      style={{ background: '#ea580c' }}
                    >
                      {savingFecha ? <Loader2 size={10} className="animate-spin" /> : '✓'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: status action panel */}
          <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 pt-5 pb-3 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Flag size={10} className="text-gray-600" />
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Avance de estado</p>
              </div>

              {/* Current status */}
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border mb-3 ${st?.color}`}>
                <CheckCircle2 size={13} />
                <span className="text-xs font-medium">Actual: {st?.label}</span>
              </div>

              {/* Quick status buttons */}
              <div className="flex flex-col gap-1.5">
                {STATUSES.filter(s => s.key !== item.status).map(s => (
                  <button
                    key={s.key}
                    onClick={() => { setNextStatus(s.key); confirmTransitionTo(s.key) }}
                    disabled={saving}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}
                  >
                    <span>Mover a {s.label}</span>
                    <ArrowRight size={10} />
                  </button>
                ))}
              </div>
            </div>


            {/* Trazabilidad in right panel */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={10} className="text-gray-600" />
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Trazabilidad</p>
              </div>
              {loadingLogs ? (
                <div className="flex items-center gap-2 text-gray-600 text-xs"><Loader2 size={12} className="animate-spin" /> Cargando...</div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 gap-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px" }}>
                  <Clock size={14} className="text-gray-700" />
                  <p className="text-[10px] text-gray-600">Sin transiciones registradas aún</p>
                </div>
              ) : (
                <div className="space-y-0 max-h-48 overflow-y-auto">
                  {logs.map((log, i) => (
                    <div key={log.id} className="flex gap-2">
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${log.fromStatus ? 'bg-orange-500' : 'bg-gray-700'}`} />
                        {i < logs.length - 1 && <div className="w-px flex-1 my-1" style={{ background: 'rgba(255,255,255,0.07)' }} />}
                      </div>
                      <div className="pb-3 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.fromStatus && (<><span className="text-[9px] text-gray-500">{statusLabel(log.fromStatus)}</span><ArrowRight size={8} className="text-gray-600" /></>)}
                          <span className="text-[9px] font-semibold text-orange-400">{statusLabel(log.toStatus)}</span>
                          {log.userName && <span className="text-[9px] text-gray-500">· {log.userName}</span>}
                        </div>
                        {log.note && <p className="text-[10px] text-gray-400 mt-1 leading-relaxed px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>{log.note}</p>}
                        <p className="text-[9px] text-gray-700 mt-0.5">{formatDate(log.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>


            </div>

            {/* Sticky save button */}
            <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={saveResultado}
                disabled={savingResultado || !resultadoDirty}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:cursor-not-allowed"
                style={{ background: resultadoDirty ? '#ea580c' : 'rgba(255,255,255,0.05)', color: resultadoDirty ? 'white' : '#6b7280', border: resultadoDirty ? 'none' : '1px solid rgba(255,255,255,0.08)' }}
              >
                {savingResultado ? <Loader2 size={14} className="animate-spin" /> : null}
                {resultadoDirty ? 'Guardar resultado' : 'Sin cambios pendientes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
