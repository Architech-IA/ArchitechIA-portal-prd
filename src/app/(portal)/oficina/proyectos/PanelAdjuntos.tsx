'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Upload, Trash2, FileText, AlertTriangle } from 'lucide-react'
import { api, del, hace, kb, type Adjunto } from './api'

export default function PanelAdjuntos({ proyectoId, onCambio }: { proyectoId: string; onCambio: () => void }) {
  const [lista, setLista] = useState<Adjunto[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    try { setLista(await api<Adjunto[]>(`/api/proyectos/${proyectoId}/adjuntos`)) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar') } finally { setCargando(false) }
  }, [proyectoId])
  useEffect(() => { setCargando(true); void cargar() }, [cargar])

  async function subir(files: FileList | File[]) {
    setSubiendo(true); setError(null)
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData(); fd.append('file', f)
        await api(`/api/proyectos/${proyectoId}/adjuntos`, { method: 'POST', body: fd })
      }
      await cargar(); onCambio()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo subir') } finally { setSubiendo(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function borrar(a: Adjunto) {
    if (!window.confirm(`¿Quitar «${a.nombre}» del proyecto? La IA dejará de verlo.`)) return
    try { await del(`/api/proyectos/${proyectoId}/adjuntos/${a.id}`); await cargar(); onCambio() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo quitar') }
  }

  return (
    <div className="p-3 space-y-3">
      <p className="text-[11px] text-gray-500">Documentos del proyecto (PDF, Word, PowerPoint, Excel, texto). Se guarda su <b className="text-gray-300">texto</b>, no el archivo, y la IA lo usa en todas las sesiones (cita el nombre). Máx. 6 MB por archivo.</p>
      <div onDragOver={e => { e.preventDefault(); setArrastrando(true) }} onDragLeave={() => setArrastrando(false)}
        onDrop={e => { e.preventDefault(); setArrastrando(false); if (e.dataTransfer.files.length) void subir(e.dataTransfer.files) }}
        onClick={() => fileRef.current?.click()}
        className="rounded-xl py-5 flex flex-col items-center gap-1.5 cursor-pointer text-[11px] text-gray-400 hover:text-gray-200 transition-colors"
        style={{ border: `1px dashed ${arrastrando ? '#818cf8' : 'rgba(255,255,255,0.15)'}`, background: arrastrando ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
        {subiendo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {subiendo ? 'Leyendo el documento…' : 'Arrastra archivos o haz clic para subir'}
        <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.html,.xml" onChange={e => e.target.files && void subir(e.target.files)} />
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {cargando && <div className="flex justify-center py-4 text-gray-500"><Loader2 size={14} className="animate-spin" /></div>}
      {!cargando && lista.length === 0 && <p className="text-[11px] text-gray-600 text-center py-3">Todavía no hay adjuntos.</p>}
      <ul className="space-y-1.5">
        {lista.map(a => (
          <li key={a.id} className="flex items-start gap-2 rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${a.legible ? 'rgba(255,255,255,0.06)' : 'rgba(245,158,11,0.35)'}` }}>
            {a.legible ? <FileText size={14} className="text-indigo-300 flex-shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-200 truncate">{a.nombre}</p>
              <p className="text-[10px] text-gray-600">{kb(a.size)} · {a.legible ? `${a.textoLen.toLocaleString('es-CO')} car. de texto` : 'texto no legible: la IA no lo ve'} · {a.creadoPorNombre} · {hace(a.createdAt)}</p>
            </div>
            <button onClick={() => void borrar(a)} className="text-gray-600 hover:text-red-400 flex-shrink-0 mt-0.5"><Trash2 size={12} /></button>
          </li>))}
      </ul>
    </div>
  )
}
