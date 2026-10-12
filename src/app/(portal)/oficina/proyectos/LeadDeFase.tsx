'use client'

import { useEffect, useState } from 'react'
import { Loader2, ExternalLink, Phone, Mail, Users, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { api, post, del } from './api'

// Lo que el módulo de leads guarda de este lead y que se usa desde el proyecto: las interacciones con el cliente y la propuesta.
// (Las notas y los archivos viven en el proyecto; la página del Lead Hub ya no existe.)
type Tipo = 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP'
interface Reunion { id?: string; title?: string; status?: string; date?: string; meetingUrl?: string | null; link?: string | null }
interface Interaccion { id: string; type: Tipo; description: string; date: string; createdAt?: string; user: { name: string }; meeting?: Reunion | null }
interface Propuesta { id: string; title: string; amount: number; status: string; documents?: { id: string; name: string; url: string; archived: boolean }[] }
const ICONO_INT = { CALL: Phone, EMAIL: Mail, MEETING: Users, WHATSAPP: MessageCircle } as const
const ETIQUETA_INT: Record<Tipo, string> = { CALL: 'Llamada', EMAIL: 'Email', MEETING: 'Reunión', WHATSAPP: 'WhatsApp' }
const dinero = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO')
const fechaCorta = (v: string) => new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
const fechaLarga = (v: string) => new Date(v).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' })
const hoy = () => new Date().toISOString().slice(0, 10)
const campo: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#f1f5f9', padding: '8px 12px', fontSize: 11, outline: 'none', width: '100%' }
const boton: React.CSSProperties = { padding: '8px 16px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 11 }
const etiq: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }

export default function LeadDeFase({ leadId, clave }: { leadId: string; clave: string }) {
  const [ints, setInts] = useState<Interaccion[] | null>(null)
  const [prop, setProp] = useState<Propuesta | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [popup, setPopup] = useState(false)
  const [detalle, setDetalle] = useState<Interaccion | null>(null)
  const [borrando, setBorrando] = useState(false)
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

  function abrir() { setTipo('CALL'); setFecha(hoy()); setDesc(''); setError(''); setPopup(true) }
  async function agregar() {
    if (!desc.trim()) return
    setGuardando(true); setError('')
    try { const n = await post<Interaccion>(`/api/leads/${leadId}/interactions`, { type: tipo, description: desc.trim(), date: fecha }); setInts(p => [n, ...(p ?? [])]); setPopup(false) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar la interacción') } finally { setGuardando(false) }
  }
  async function borrar(i: Interaccion) {
    if (!window.confirm('¿Borrar esta interacción? Si estaba vinculada a una reunión, la reunión no se toca.')) return
    setBorrando(true); setError('')
    try { await del(`/api/leads/${leadId}/interactions/${i.id}`); setInts(p => (p ?? []).filter(x => x.id !== i.id)); setDetalle(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo borrar la interacción') } finally { setBorrando(false) }
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
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {conPropuesta && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Propuesta</p>
          {prop
            ? (<div className="rounded-lg px-3 py-2 space-y-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[12px] text-gray-200">{prop.title} <span className="text-[10px] text-[#7f8a9c]">· {prop.status} · {dinero(prop.amount)}</span></p>
              {(prop.documents ?? []).filter(d => !d.archived).map(d => <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="block text-[11px] text-indigo-300 hover:text-indigo-200 truncate">{d.name}</a>)}
              <a href={`/proposals/${prop.id}`} className="inline-flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200"><ExternalLink size={10} /> Gestionar documentos y estado</a>
            </div>)
            : (<div className="space-y-2">
              <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título de la propuesta" style={campo} />
              <div className="flex gap-2"><input value={monto} onChange={e => setMonto(e.target.value)} placeholder="Monto (COP)" style={campo} />
                <button onClick={() => void crearPropuesta()} disabled={guardando || !titulo.trim()} style={boton} className="disabled:opacity-50 flex-shrink-0">Crear</button></div>
            </div>)}
        </div>)}

      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] flex-1">Interacciones con el cliente ({ints.length}) · de todo el lead</p>
          <button onClick={abrir} className="flex items-center gap-1 flex-shrink-0" style={{ ...boton, padding: '5px 12px' }}><Plus size={11} /> Agregar</button>
        </div>
        {ints.length === 0 && <p className="text-[11px] text-[#7f8a9c]">Todavía no hay interacciones registradas.</p>}
        <div className="space-y-0.5 flex-1 min-h-0 overflow-y-auto max-h-72 lg:max-h-none pr-1">
          {ints.map(i => { const I = ICONO_INT[i.type] ?? Phone; return (
            <button key={i.id} onClick={() => setDetalle(i)} title="Ver el detalle" className="w-full flex items-start gap-2 text-[11px] text-left px-1.5 py-1.5 rounded-md hover:bg-white/[0.07] transition-colors">
              <I size={11} className="text-[#7f8a9c] mt-0.5 flex-shrink-0" />
              <span className="min-w-0 flex-1"><span className="block text-gray-300 leading-snug">{i.description}</span><span className="block text-[10px] text-[#7f8a9c]">{fechaCorta(i.date)} · {i.user?.name}</span></span>
            </button>) })}
        </div>
      </div>
      {error && !popup && <p className="text-[11px] text-red-300">{error}</p>}

      {detalle && (() => {
        const I = ICONO_INT[detalle.type] ?? Phone
        const m = detalle.meeting
        return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(20px)', padding: 16 }} onClick={() => setDetalle(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)', padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', margin: '-28px -28px 24px -28px', padding: '20px 28px', borderRadius: '24px 24px 0 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}><I size={16} />{ETIQUETA_INT[detalle.type]}</h2>
              <button onClick={() => setDetalle(null)} aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 15, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={etiq}>Fecha</label><p style={{ fontSize: 12, color: '#f1f5f9', margin: 0, textTransform: 'capitalize' }}>{fechaLarga(detalle.date)}</p></div>
              <div><label style={etiq}>Descripción</label><p style={{ fontSize: 12, color: '#e2e8f0', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{detalle.description}</p></div>
              {m && (m.title || m.status) && (
                <div><label style={etiq}>Reunión vinculada</label>
                  <p style={{ fontSize: 12, color: '#e2e8f0', margin: 0 }}>{m.title}{m.status ? <span style={{ color: '#94a3b8' }}> · {m.status === 'COMPLETED' ? 'Completada' : m.status === 'SCHEDULED' ? 'Programada' : m.status === 'CANCELLED' ? 'Cancelada' : m.status}</span> : null}</p>
                  {(m.meetingUrl || m.link) && <a href={(m.meetingUrl || m.link) as string} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-300 hover:text-indigo-200">Abrir el enlace de la reunión</a>}
                </div>)}
              <div style={{ display: 'flex', gap: 24 }}>
                <div><label style={etiq}>Registrada por</label><p style={{ fontSize: 12, color: '#f1f5f9', margin: 0 }}>{detalle.user?.name ?? '—'}</p></div>
                {detalle.createdAt && <div><label style={etiq}>Registrada el</label><p style={{ fontSize: 12, color: '#f1f5f9', margin: 0 }}>{new Date(detalle.createdAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}</p></div>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22 }}>
              <button onClick={() => void borrar(detalle)} disabled={borrando} className="flex items-center gap-1.5 disabled:opacity-60" style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 9, color: '#fca5a5', fontSize: 11, fontWeight: 600 }}>{borrando ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}Borrar</button>
              <span style={{ flex: 1, fontSize: 11, color: '#fca5a5' }}>{error}</span>
              <button onClick={() => setDetalle(null)} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#94a3b8', fontSize: 11 }}>Cerrar</button>
            </div>
          </div>
        </div>)
      })()}

      {popup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(20px)', padding: 16 }} onClick={() => setPopup(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)', padding: 28, width: '100%', maxWidth: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', margin: '-28px -28px 24px -28px', padding: '20px 28px', borderRadius: '24px 24px 0 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.01em' }}>Nueva interacción</h2>
              <button onClick={() => setPopup(false)} aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 15, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={etiq}>Tipo</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(Object.keys(ICONO_INT) as Tipo[]).map(t => { const I = ICONO_INT[t]; const on = tipo === t; return (
                    <button key={t} onClick={() => setTipo(t)} className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-full"
                      style={on ? { background: 'rgba(249,115,22,0.18)', border: '1px solid rgba(249,115,22,0.5)', color: '#fed7aa' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}><I size={12} />{ETIQUETA_INT[t]}</button>) })}
                </div>
              </div>
              <div><label style={etiq}>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...campo, colorScheme: 'dark' }} /></div>
              <div><label style={etiq}>Descripción <span style={{ color: '#f87171' }}>*</span></label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} autoFocus placeholder="Qué se habló o se acordó…" style={{ ...campo, resize: 'vertical' }} /></div>
              <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>Las reuniones se registran en el módulo de reuniones y se vinculan al lead desde ahí.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              {error && <span style={{ fontSize: 11, color: '#fca5a5', flex: 1 }}>{error}</span>}
              <button onClick={() => setPopup(false)} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#94a3b8', fontSize: 11 }}>Cancelar</button>
              <button onClick={() => void agregar()} disabled={guardando || !desc.trim()} className="flex items-center gap-1.5 disabled:opacity-50" style={boton}>{guardando && <Loader2 size={13} className="animate-spin" />}Guardar interacción</button>
            </div>
          </div>
        </div>)}
    </div>
  )
}
