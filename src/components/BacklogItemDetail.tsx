'use client'

import { useState, useEffect } from 'react'
import { X, ArrowRight, CheckCircle2, Clock, Loader2, Flag, MessageSquare, Pencil, Trash2 } from 'lucide-react'

interface BacklogItem {
  id: string
  title: string
  description: string | null
  type: string
  priority: string
  status: string
  points: number | null
  projectId: string | null
  project: { id: string; name: string } | null
  assigneeId: string | null
  assigneeName: string | null
  createdAt: string
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
  { key: 'BACKLOG',     label: 'Backlog',      color: 'bg-gray-500/20 text-gray-400 border-gray-500/30'     },
  { key: 'IN_PROGRESS', label: 'En Progreso',  color: 'bg-blue-500/20 text-blue-400 border-blue-500/30'     },
  { key: 'REVIEW',      label: 'Review',       color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'},
  { key: 'BLOCKED',     label: 'Bloqueado',    color: 'bg-red-500/20 text-red-400 border-red-500/30'        },
  { key: 'DONE',        label: 'Done',         color: 'bg-green-500/20 text-green-400 border-green-500/30'  },
]

const NEXT_STATUS: Record<string, string> = {
  BACKLOG:     'IN_PROGRESS',
  IN_PROGRESS: 'REVIEW',
  REVIEW:      'DONE',
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

export default function BacklogItemDetail({ item, onClose, onStatusChange, currentUserName, onEdit, onDelete }: Props) {
  const [logs, setLogs]       = useState<Log[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [note, setNote]       = useState('')
  const [nextStatus, setNextStatus] = useState(NEXT_STATUS[item.status] ?? item.status)
  const [saving, setSaving]   = useState(false)

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
    // Log the transition
    await fetch('/api/backlog/logs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, fromStatus: item.status, toStatus: nextStatus, note: note.trim() || null }),
    })
    // Update item status
    if (nextStatus !== item.status) {
      await onStatusChange(item, nextStatus)
    }
    // Refresh logs
    const updated = await fetch(`/api/backlog/logs?itemId=${item.id}`).then(r => r.json())
    setLogs(Array.isArray(updated) ? updated : [])
    setNote('')
    setSaving(false)
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const statusLabel = (key: string) => STATUSES.find(s => s.key === key)?.label ?? key

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${st?.color}`}>{st?.label}</span>
              <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{TYPE_LABELS[item.type] ?? item.type}</span>
              <span className={`flex items-center gap-1 text-[10px] ${pr?.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${pr?.dot}`} /> {pr?.label}
              </span>
              {item.points && <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">{item.points}pt</span>}
              <div className="w-px h-3 bg-gray-700 mx-1" />
              <button onClick={onEdit} className="text-gray-500 hover:text-white transition-colors" title="Editar"><Pencil size={12} /></button>
              <button onClick={onDelete} className="text-gray-500 hover:text-red-400 transition-colors" title="Eliminar"><Trash2 size={12} /></button>
            </div>
            <h2 className="text-lg font-bold text-white leading-tight">{item.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors flex-shrink-0"><X size={18} /></button>
        </div>

        {/* Body — 2 columns */}
        <div className="flex-1 overflow-hidden flex divide-x divide-gray-800">

          {/* Left: info + traceability */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3">
                {item.assigneeName && (
                  <div className="bg-gray-800/60 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 mb-1">Responsable</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[9px] font-bold text-black">
                        {item.assigneeName.split(' ').map(w => w[0]).slice(0,2).join('')}
                      </div>
                      <span className="text-sm text-white">{item.assigneeName}</span>
                    </div>
                  </div>
                )}
                {item.project && (
                  <div className="bg-gray-800/60 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 mb-1">Proyecto</p>
                    <p className="text-sm text-orange-400">{item.project.name}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {item.description && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Descripción</p>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{item.description}</p>
                </div>
              )}

              {/* Traceability timeline */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Clock size={10} /> Trazabilidad
                </p>
                {loadingLogs ? (
                  <div className="flex items-center gap-2 text-gray-600 text-xs"><Loader2 size={12} className="animate-spin" /> Cargando...</div>
                ) : logs.length === 0 ? (
                  <p className="text-xs text-gray-700">Sin transiciones registradas aún</p>
                ) : (
                  <div className="relative space-y-0">
                    {logs.map((log, i) => (
                      <div key={log.id} className="flex gap-3">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${log.fromStatus ? 'bg-orange-500' : 'bg-gray-600'}`} />
                          {i < logs.length - 1 && <div className="w-0.5 flex-1 bg-gray-800 my-1" />}
                        </div>
                        <div className="pb-4 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {log.fromStatus && (
                              <>
                                <span className="text-[10px] text-gray-500">{statusLabel(log.fromStatus)}</span>
                                <ArrowRight size={10} className="text-gray-600" />
                              </>
                            )}
                            <span className="text-[10px] font-medium text-orange-400">{statusLabel(log.toStatus)}</span>
                            {log.userName && <span className="text-[10px] text-gray-600">· {log.userName}</span>}
                          </div>
                          {log.note && (
                            <p className="text-xs text-gray-400 mt-1 bg-gray-800/50 rounded-lg px-2 py-1.5 leading-relaxed">
                              {log.note}
                            </p>
                          )}
                          <p className="text-[10px] text-gray-700 mt-1">{formatDate(log.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: status action panel */}
          <div className="w-64 flex-shrink-0 flex flex-col px-5 py-5 space-y-4">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Flag size={10} /> Avance de estado
              </p>

              {/* Current status */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-3 ${st?.color}`}>
                <CheckCircle2 size={13} />
                <span className="text-xs font-medium">Actual: {st?.label}</span>
              </div>

              {/* Next status selector */}
              <label className="text-[10px] text-gray-500 mb-1 block">Mover a</label>
              <select
                value={nextStatus}
                onChange={e => setNextStatus(e.target.value)}
                className="w-full text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500 mb-3"
              >
                {STATUSES.filter(s => s.key !== item.status).map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
                <option value={item.status}>— Solo agregar nota —</option>
              </select>

              {/* Note */}
              <label className="text-[10px] text-gray-500 mb-1 flex items-center gap-1 block">
                <MessageSquare size={9} /> Nota de confirmación
              </label>
              <textarea
                rows={4}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Describe qué se hizo, qué falta o por qué se mueve..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none"
              />
            </div>

            <button
              onClick={confirmTransition}
              disabled={saving || (nextStatus === item.status && !note.trim())}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {nextStatus !== item.status ? `Mover a ${statusLabel(nextStatus)}` : 'Registrar nota'}
            </button>

            <div className="pt-3 border-t border-gray-800 space-y-1 text-[10px] text-gray-600">
              <p>Creado: {new Date(item.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
