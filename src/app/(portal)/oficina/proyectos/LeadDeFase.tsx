'use client'

import { useEffect, useState } from 'react'
import { Loader2, ChevronDown, ChevronRight, ExternalLink, Phone, Mail, Users, MessageCircle, Plus } from 'lucide-react'
import { api, post } from './api'

// Lo que el módulo de leads guarda de este lead y que se usa desde el proyecto: las interacciones con el cliente y la propuesta.
// (Las notas y los archivos viven en el proyecto; la página del Lead Hub ya no existe.)
type Tipo = 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP'
interface Interaccion { id: string; type: Tipo; description: string; date: string; user: { name: string } }
interface Propuesta { id: string; title: string; amount: number; status: string; documents?: { id: string; name: string; url: string; archived: boolean }[] }
const ICONO_INT = { CALL: Phone, EMAIL: Mail, MEETING: Users, WHATSAPP: MessageCircle } as const
const ETIQUETA_INT: Record<Tipo, string> = { CALL: 'Llamada', EMAIL: 'Email', MEETING: 'Reunión', WHATSAPP: 'WhatsApp' }
const dinero = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO')
const fechaCorta = (v: string) => new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
const hoy = () => new Date().toISOString().slice(0, 10)
const campo: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#f1f5f9', padding: '8px 12px', fontSize: 11, outline: 'none' }
const boton: React.CSSProperties = { padding: '8px 16px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 11 }

export default function LeadDeFase({ leadId, clave }: { leadId: string; clave: string }) {
  const [ints, setInts] = useState<Interaccion[] | null>(null)
  const [prop, setProp] = useState<Propuesta | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [tipo, setTipo] = useState<Tipo>('CALL')
  const [fecha, setFecha] = useState(hoy())
  const [desc, setDesc] = useState('')
  const [titulo, setTitulo] = useState('')
  const [monto, setMonto] = useState('')

  useEffect(() => {
    let vivo = true
    Promise.all([api<Interaccion[]>(`/api/leads/${leadId}/interactions`).catch(() => []), api<Propuesta | null>(`/api/leads/${leadId}/proposal`).catch(() => null)])
      .then(([i, p]) => { if (vivo) { setInts(Array.isArray(i) ? i : []); setProp(p && p.id ? p : null) } })
    return () => { vivo = false }
  }, [leadId])

  async function agregar() {
    if (!desc.trim()) return
    setGuardando(true); setError('')
    try { const n = await post<Interaccion>(`/api/leads/${leadId}/interactions`, { type: tipo, description: desc.trim(), date: fecha }); setInts(p => [n, ...(p ?? [])]); setDesc(''); setAbierto(true) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar la interacción') } finally { setGuardando(false) }
  }
  async function crearPropuesta() {
    if (!titulo.trim()) return
    setGuardando(true); setError('')
    try { const p = await post<Propuesta>(`/api/leads/${leadId}/proposal`, { title: titulo.trim(), description: '', amount: Number(monto.replace(/[^\d]/g, '')) || 0 }); setProp(p) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la propuesta') } finally { setGuardando(false) }
  }

  if (!ints) return <div className="flex justify-center py-3 text-[#7f8a9c]"><Loader2 size={14} className="animate-spin" /></div>
  const conPropuesta = clave === 'propuesta' || clave === 'negociacion'
  return (
    <div className="space-y-4">
      {conPropuesta && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Propuesta</p>
          {prop
            ? (<div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-gray-200">{prop.title} <span className="text-[10px] text-[#7f8a9c]">· {prop.status} · {dinero(prop.amount)}</span></p>
                {(prop.documents ?? []).filter(d => !d.archived).map(d => <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="block text-[11px] text-indigo-300 hover:text-indigo-200 truncate">{d.name}</a>)}
              </div>
              <a href={`/proposals/${prop.id}`} className="flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200 flex-shrink-0"><ExternalLink size={10} /> Gestionar documentos y estado</a>
            </div>)
            : (<div className="flex items-center gap-2 flex-wrap">
              <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título de la propuesta" style={{ ...campo, flex: 1, minWidth: 160 }} />
              <input value={monto} onChange={e => setMonto(e.target.value)} placeholder="Monto (COP)" style={{ ...campo, width: 130 }} />
              <button onClick={() => void crearPropuesta()} disabled={guardando || !titulo.trim()} style={boton} className="disabled:opacity-50">Crear propuesta</button>
            </div>)}
        </div>)}

      <div>
        <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Registrar una interacción con el cliente</p>
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {(Object.keys(ICONO_INT) as Tipo[]).map(t => { const I = ICONO_INT[t]; const on = tipo === t; return (
            <button key={t} onClick={() => setTipo(t)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full"
              style={on ? { background: 'rgba(249,115,22,0.18)', border: '1px solid rgba(249,115,22,0.5)', color: '#fed7aa' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}><I size={11} />{ETIQUETA_INT[t]}</button>) })}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...campo, colorScheme: 'dark' }} />
          <input value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void agregar() }} placeholder="Descripción de la interacción…" style={{ ...campo, flex: 1 }} />
          <button onClick={() => void agregar()} disabled={guardando || !desc.trim()} className="flex items-center gap-1 disabled:opacity-50" style={boton}>{guardando ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Agregar</button>
        </div>
        <p className="text-[10px] text-[#7f8a9c] mt-1">Las reuniones se registran en el módulo de reuniones y se vinculan al lead desde ahí.</p>
      </div>

      {ints.length > 0 && (
        <div>
          <button onClick={() => setAbierto(o => !o)} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#7f8a9c] hover:text-gray-300">
            {abierto ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Interacciones con el cliente ({ints.length}) · de todo el lead
          </button>
          {abierto && (
            <div className="mt-1 space-y-1">
              {ints.slice(0, 30).map(i => { const I = ICONO_INT[i.type] ?? Phone; return (
                <div key={i.id} className="flex items-start gap-2 text-[11px] px-2 py-1">
                  <I size={11} className="text-[#7f8a9c] mt-0.5 flex-shrink-0" /><span className="text-gray-300 flex-1">{i.description}</span><span className="text-[10px] text-[#7f8a9c] flex-shrink-0">{fechaCorta(i.date)} · {i.user?.name}</span>
                </div>) })}
            </div>)}
        </div>)}
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  )
}
