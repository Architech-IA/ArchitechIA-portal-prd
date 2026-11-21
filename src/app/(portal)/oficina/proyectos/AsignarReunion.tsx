'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Check, Loader2, Plus, Search } from 'lucide-react'
import { api, post, hace, type DetalleProyecto } from './api'

// Ventana para cerrar una actividad de «reunión»: asignar una reunión que ya existe en el calendario o crear una nueva.
// En ambos casos: la reunión queda asociada al proyecto (con la fase), se registra como interacción del lead (de ahí sale el
// entregable «reunión registrada») y la actividad se da por hecha. Las reuniones pasadas son válidas.

interface Reu { id: string; titulo: string; fecha: string | null; tipo: string | null; conContenido?: boolean; motivo?: string; asistentes?: string | null }
interface Cli { id: string; nombre: string; razonSocial?: string | null; email?: string | null }
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const GEN = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com']
interface Res { vinculadas: Reu[]; sugeridas: Reu[]; otras: Reu[] }

const campo: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#f1f5f9', padding: '8px 12px', fontSize: 11, outline: 'none', width: '100%' }
const boton: React.CSSProperties = { padding: '8px 16px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 11 }
const etiq: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }
const fechaCorta = (v: string) => new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })

export default function AsignarReunion({ proyectoId, faseClave, tituloSugerido, onCerrar, onListo }: {
  proyectoId: string; faseClave: string; tituloSugerido: string; onCerrar: () => void; onListo: (tituloReunion: string) => Promise<void>
}) {
  const [modo, setModo] = useState<'existente' | 'nueva'>('existente')
  const [datos, setDatos] = useState<Res | null>(null)
  const [leadId, setLeadId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [clientes, setClientes] = useState<Cli[]>([])
  const [cli, setCli] = useState('')
  const [elegida, setElegida] = useState<Reu | null>(null)
  const [titulo, setTitulo] = useState(tituloSugerido)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [hora, setHora] = useState('10:00')
  const [enlace, setEnlace] = useState('')
  const [asistentes, setAsistentes] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    api<Res>(`/api/proyectos/${proyectoId}/reuniones`).then(r => { if (vivo) setDatos(r) }).catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'No se pudieron leer las reuniones') })
    api<DetalleProyecto>(`/api/proyectos/${proyectoId}`).then(d => { if (vivo) setLeadId(d.proyecto.leadId) }).catch(() => {})
    api<Cli[]>('/api/clientes').then(l => { if (vivo && Array.isArray(l)) setClientes(l) }).catch(() => {})
    return () => { vivo = false }
  }, [proyectoId])

  const lista = useMemo(() => {
    if (!datos) return []
    const marca = (r: Reu, grupo: string) => ({ ...r, grupo })
    const todas = [...datos.vinculadas.map(r => marca(r, 'Del proyecto')), ...datos.sugeridas.map(r => marca(r, 'Sugerida')), ...datos.otras.map(r => marca(r, 'Otra'))]
    const t = q.trim().toLowerCase()
    const k = clientes.find(x => x.id === cli)
    const nombres = k ? [k.nombre, k.razonSocial ?? ''].map(norm).filter(n => n.length >= 3) : []
    const dom = (k?.email ?? '').split('@')[1]?.toLowerCase() ?? ''
    const deCliente = (r: Reu) => { const h = norm(r.titulo); const a = (r.asistentes ?? '').toLowerCase(); return nombres.some(n => h.includes(n)) || (!!dom && !GEN.includes(dom) && a.includes('@' + dom)) }
    return todas.filter(r => (!t || r.titulo.toLowerCase().includes(t)) && (!k || deCliente(r)))
  }, [datos, q, cli, clientes])

  async function terminar(reunion: { id: string; titulo: string }) {
    await post(`/api/proyectos/${proyectoId}/reuniones`, { meetingId: reunion.id, faseClave })
    if (leadId) {
      const previas = await api<{ meeting?: { id?: string } | null; meetingId?: string | null }[]>(`/api/leads/${leadId}/interactions`).catch(() => [])
      const ya = previas.some(i => i.meeting?.id === reunion.id || i.meetingId === reunion.id)
      if (!ya) await post(`/api/leads/${leadId}/interactions`, { type: 'MEETING', meetingId: reunion.id })
    }
    await onListo(reunion.titulo)
  }

  async function confirmar() {
    setTrabajando(true); setError(null)
    try {
      if (modo === 'existente') {
        if (!elegida) throw new Error('Elige una reunión de la lista')
        await terminar({ id: elegida.id, titulo: elegida.titulo })
      } else {
        if (!titulo.trim() || !fecha) throw new Error('El título y la fecha son obligatorios')
        const inicio = `${fecha}T${hora || '09:00'}`
        const pasada = new Date(`${inicio}:00-05:00`).getTime() < Date.now()
        const m = await post<{ id: string; title?: string }>('/api/meetings', { title: titulo.trim(), date: inicio, type: 'COMMERCIAL', link: enlace.trim() || undefined, attendees: asistentes.trim() || undefined, status: pasada ? 'COMPLETED' : 'SCHEDULED' })
        await terminar({ id: m.id, titulo: m.title ?? titulo.trim() })
      }
      onCerrar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar') } finally { setTrabajando(false) }
  }

  const pestana = (k: 'existente' | 'nueva', txt: string, I: typeof Plus) => (
    <button type="button" onClick={() => { setModo(k); setError(null) }} className="flex items-center gap-1.5"
      style={{ padding: '7px 14px', borderRadius: 9, fontSize: 11, fontWeight: 600, border: '1px solid ' + (modo === k ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.1)'), background: modo === k ? 'rgba(249,115,22,0.14)' : 'rgba(255,255,255,0.04)', color: modo === k ? '#fed7aa' : '#94a3b8' }}><I size={12} />{txt}</button>
  )

  if (typeof document === 'undefined') return null
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(20px)', padding: 16 }} onClick={onCerrar}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)', padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', margin: '-28px -28px 20px -28px', padding: '20px 28px', borderRadius: '24px 24px 0 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}><CalendarDays size={16} />Reunión de esta actividad</h2>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 15, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div className="flex gap-2 mb-4">{pestana('existente', 'Asignar una existente', Search)}{pestana('nueva', 'Crear una nueva', Plus)}</div>

        {modo === 'existente' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="flex gap-2">
              <select value={cli} onChange={e => setCli(e.target.value)} style={{ ...campo, width: 210, flexShrink: 0, colorScheme: 'dark', cursor: 'pointer' }}>
                <option value="" style={{ background: '#0f172a', color: '#f1f5f9' }}>Todos los clientes</option>
                {clientes.map(x => <option key={x.id} value={x.id} style={{ background: '#0f172a', color: '#f1f5f9' }}>{x.nombre}</option>)}
              </select>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por título…" style={campo} />
            </div>
            {!datos && !error && <div className="flex justify-center py-4 text-[#7f8a9c]"><Loader2 size={16} className="animate-spin" /></div>}
            <div className="space-y-1 overflow-y-auto pr-1" style={{ maxHeight: 280 }}>
              {datos && lista.length === 0 && <p className="text-[11px] text-[#7f8a9c]">No hay reuniones que coincidan. Puedes crear una nueva.</p>}
              {lista.map(r => {
                const sel = elegida?.id === r.id
                return (
                  <button key={r.id} type="button" onClick={() => setElegida(r)} className="w-full flex items-start gap-2 text-left px-2.5 py-2 rounded-lg transition-colors"
                    style={{ background: sel ? 'rgba(249,115,22,0.14)' : 'rgba(255,255,255,0.04)', border: '1px solid ' + (sel ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.06)') }}>
                    <span className="mt-0.5 flex-shrink-0" style={{ width: 14, height: 14, borderRadius: 7, border: '1px solid ' + (sel ? '#fb923c' : 'rgba(255,255,255,0.25)'), background: sel ? '#fb923c' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sel && <Check size={9} color="#fff" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] text-gray-100 leading-snug">{r.titulo}</span>
                      <span className="block text-[10px] text-[#7f8a9c]">{r.fecha ? `${fechaCorta(r.fecha)} · ${hace(r.fecha)}` : ''} <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 6, fontWeight: 700, background: r.grupo === 'Sugerida' ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.08)', color: r.grupo === 'Sugerida' ? '#fed7aa' : '#94a3b8' }}>{r.grupo}</span></span>
                    </span>
                  </button>)
              })}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={etiq}>Título</label><input value={titulo} onChange={e => setTitulo(e.target.value)} style={campo} /></div>
            <div className="flex gap-3">
              <div className="flex-1"><label style={etiq}>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={campo} /></div>
              <div style={{ width: 130 }}><label style={etiq}>Hora</label><input type="time" value={hora} onChange={e => setHora(e.target.value)} style={campo} /></div>
            </div>
            <div><label style={etiq}>Enlace o lugar (opcional)</label><input value={enlace} onChange={e => setEnlace(e.target.value)} placeholder="https://meet.google.com/… o dirección" style={campo} /></div>
            <div><label style={etiq}>Asistentes (opcional)</label><input value={asistentes} onChange={e => setAsistentes(e.target.value)} placeholder="correos separados por coma" style={campo} /></div>
            <p className="text-[10.5px] text-[#7f8a9c]">Se guarda en el calendario del portal. Si la fecha ya pasó, queda como realizada; si es futura, como agendada.</p>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22 }}>
          <span style={{ flex: 1, fontSize: 11, color: '#fca5a5' }}>{error}</span>
          <button onClick={onCerrar} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#94a3b8', fontSize: 11 }}>Cancelar</button>
          <button onClick={() => void confirmar()} disabled={trabajando || (modo === 'existente' && !elegida)} className="flex items-center gap-1.5 disabled:opacity-50" style={boton}>
            {trabajando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}{modo === 'existente' ? 'Asignar y marcar hecha' : 'Crear y marcar hecha'}</button>
        </div>
      </div>
    </div>, document.body)
}
