'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, ChevronDown, ChevronRight } from 'lucide-react'
import TabbedNotes from '@/components/TabbedNotes'
import { sanitizarHtml } from '../../solutions/pilots/[id]/sanitizar'
import { api, put, hace } from './api'

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
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)

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
              <TabbedNotes key={`${clave}-${nota?.actualizadoEn ?? 'nueva'}`} value={contenido} onChange={setTexto} acciones={<>
                {texto !== null && <span className="text-[10px] text-amber-300 whitespace-nowrap">Sin guardar</span>}
                <button onClick={() => void guardar()} disabled={guardando || texto === null} title={nota?.actualizadoEn && texto === null ? `Guardado ${hace(nota.actualizadoEn)}${nota.actualizadoPor ? ` por ${nota.actualizadoPor}` : ''}` : 'Guardar las notas de esta fase'} className="flex items-center gap-1.5 disabled:opacity-40" style={{ padding: '4px 12px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 11 }}>
                  {guardando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar</button></>} />
            </div>
          </>)}

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
