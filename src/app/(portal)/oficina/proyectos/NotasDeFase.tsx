'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Save, Paperclip, Download, Trash2, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import TabbedNotes from '@/components/TabbedNotes'
import { sanitizarHtml } from '../../solutions/pilots/[id]/sanitizar'
import { api, post, put, del, hace } from './api'

// Notas y archivos de cada fase DENTRO del proyecto (sustituyen a las notas del Lead Hub). Texto enriquecido en pestañas, como siempre.

interface ArchivoNota { id: string; nombre: string; size: number; mimeType: string | null }
interface Nota { contenido: string; actualizadoPor: string | null; actualizadoEn: string | null; archivos: ArchivoNota[] }
const PREVENTA: { clave: string; nombre: string }[] = [
  { clave: 'identificacion', nombre: 'Identificación' }, { clave: 'contacto', nombre: 'Contacto' }, { clave: 'diagnostico', nombre: 'Diagnóstico' },
  { clave: 'demo', nombre: 'Demo / MVP' }, { clave: 'propuesta', nombre: 'Propuesta' }, { clave: 'negociacion', nombre: 'Negociación' },
]
const tabsDe = (raw: string): { id: string; name: string; content: string }[] => {
  if (!raw) return []
  try { const v = JSON.parse(raw); if (v && Array.isArray(v.tabs)) return v.tabs } catch { /* texto plano */ }
  return [{ id: 'g', name: 'General', content: raw }]
}
const sinHtml = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim()
const vacio = (raw: string) => tabsDe(raw).every(t => !sinHtml(t.content || ''))
const Solo = ({ raw }: { raw: string }) => (
  <>{tabsDe(raw).filter(t => sinHtml(t.content || '')).map((t, i, a) => (
    <div key={t.id} className="mb-2">
      {a.length > 1 && <p className="text-[11px] text-indigo-300 mb-0.5">{t.name}</p>}
      <div className="text-[12px] text-gray-300 leading-relaxed [&_h2]:text-[13px] [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: sanitizarHtml(t.content) }} />
    </div>))}</>
)

export default function NotasDeFase({ proyectoId, clave, esPreventa, soloLectura }: { proyectoId: string; clave: string; esPreventa: boolean; soloLectura: boolean }) {
  const [notas, setNotas] = useState<Record<string, Nota> | null>(null)
  const [texto, setTexto] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    try { const r = await api<{ notas: Record<string, Nota> }>(`/api/proyectos/${proyectoId}/notas`); setNotas(r.notas ?? {}) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las notas'); setNotas({}) }
  }, [proyectoId])
  useEffect(() => { void cargar() }, [cargar])

  const nota = notas?.[clave]
  const contenido = texto ?? nota?.contenido ?? ''

  async function guardar() {
    if (texto === null) return
    setGuardando(true); setError('')
    try { await put(`/api/proyectos/${proyectoId}/notas/${clave}`, { contenido: texto }); setTexto(null); await cargar() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setGuardando(false) }
  }
  async function adjuntar(f: File) {
    if (f.size > 5 * 1024 * 1024) { setError('Máximo 5 MB por archivo'); return }
    setSubiendo(true); setError('')
    try {
      const b64 = await new Promise<string>((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = () => mal(new Error('No se pudo leer el archivo')); r.readAsDataURL(f) })
      await post(`/api/proyectos/${proyectoId}/archivos-nota`, { fase: clave, nombre: f.name, mimeType: f.type, base64: b64 })
      await cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo adjuntar') } finally { setSubiendo(false) }
  }
  async function descargar(a: ArchivoNota) {
    try { const r = await api<{ base64: string; mimeType: string }>(`/api/proyectos/${proyectoId}/archivos-nota/${a.id}`); const l = document.createElement('a'); l.href = `data:${r.mimeType || 'application/octet-stream'};base64,${r.base64}`; l.download = a.nombre; l.click() } catch { setError('No se pudo descargar el archivo') }
  }
  async function quitar(a: ArchivoNota) {
    if (!window.confirm(`¿Quitar «${a.nombre}»?`)) return
    try { await del(`/api/proyectos/${proyectoId}/archivos-nota/${a.id}`); await cargar() } catch { setError('No se pudo quitar el archivo') }
  }

  if (!notas) return <div className="flex justify-center py-4 text-[#7f8a9c]"><Loader2 size={14} className="animate-spin" /></div>
  const previas = PREVENTA.filter(f => f.clave !== clave && notas[f.clave] && !vacio(notas[f.clave].contenido))

  return (
    <div className="space-y-3">
      {soloLectura && !nota
        ? <p className="text-[11px] text-[#7f8a9c]">El proyecto todavía no llegó a esta fase: aún no se escriben notas aquí.</p>
        : soloLectura
          ? <div><Solo raw={nota?.contenido ?? ''} /></div>
          : (<>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <TabbedNotes key={`${clave}-${nota?.actualizadoEn ?? 'nueva'}`} value={contenido} onChange={setTexto} />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => void guardar()} disabled={guardando || texto === null} className="flex items-center gap-1.5 disabled:opacity-40" style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 11 }}>
                {guardando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar notas</button>
              {texto !== null && <span className="text-[10px] text-amber-300">Cambios sin guardar</span>}
              {nota?.actualizadoEn && texto === null && <span className="text-[10px] text-[#7f8a9c]">Guardado {hace(nota.actualizadoEn)}{nota.actualizadoPor ? ` por ${nota.actualizadoPor}` : ''}</span>}
            </div>
          </>)}

      <div>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] flex-1">Archivos de la fase</p>
          {!soloLectura && <>
            <input ref={archivo} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void adjuntar(f); e.target.value = '' }} />
            <button onClick={() => archivo.current?.click()} disabled={subiendo} className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200 disabled:opacity-40">{subiendo ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Adjuntar</button>
          </>}
        </div>
        {(nota?.archivos ?? []).length === 0 && <p className="text-[11px] text-[#7f8a9c]">Sin archivos.</p>}
        <div className="space-y-1">
          {(nota?.archivos ?? []).map(a => (
            <div key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/[0.05]">
              <Paperclip size={11} className="text-[#7f8a9c] flex-shrink-0" />
              <button onClick={() => void descargar(a)} className="text-[11px] text-gray-300 truncate flex-1 text-left" title="Descargar">{a.nombre}</button>
              <span className="text-[10px] text-[#7f8a9c]">{Math.max(1, Math.round(a.size / 1024))} KB</span>
              <button onClick={() => void descargar(a)} title="Descargar" className="text-[#7f8a9c] hover:text-gray-200"><Download size={11} /></button>
              {!soloLectura && <button onClick={() => void quitar(a)} title="Quitar" className="text-[#7f8a9c] hover:text-red-400"><Trash2 size={11} /></button>}
            </div>))}
        </div>
      </div>

      {!esPreventa && previas.length > 0 && (
        <div>
          <button onClick={() => setAbierto(o => !o)} className="flex items-center gap-1.5 text-[12px] text-gray-300 hover:text-white">
            {abierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Historial comercial ({previas.length} fase{previas.length === 1 ? '' : 's'} con notas)
          </button>
          {abierto && <div className="mt-2 space-y-3">{previas.map(f => (
            <div key={f.clave}><p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">{f.nombre}</p><Solo raw={notas[f.clave].contenido} /></div>))}</div>}
        </div>)}
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  )
}
