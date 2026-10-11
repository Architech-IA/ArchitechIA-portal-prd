'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, Paperclip, Download, ChevronDown, ChevronRight, ExternalLink, Phone, Mail, Users, MessageCircle } from 'lucide-react'
import TabbedNotes from '../../leads/[id]/hub/TabbedNotes'
import { sanitizarHtml } from '../../solutions/pilots/[id]/sanitizar'
import { api } from './api'

// Las etapas del pipeline del lead y la fase del proyecto que le corresponde.
const ETAPA_DE_FASE: Record<string, { status: string; nombre: string }> = {
  identificacion: { status: 'NEW', nombre: 'Identificación' }, contacto: { status: 'CONTACTED', nombre: 'Contacto' }, diagnostico: { status: 'DIAGNOSIS', nombre: 'Diagnóstico' },
  demo: { status: 'DEMO_VALIDATION', nombre: 'Demo' }, propuesta: { status: 'PROPOSAL_SENT', nombre: 'Propuesta' }, negociacion: { status: 'NEGOTIATION', nombre: 'Negociación' },
}
const ESTADOS_LEAD = ['NEW', 'CONTACTED', 'DIAGNOSIS', 'DEMO_VALIDATION', 'PROPOSAL_SENT', 'NEGOTIATION', 'RESULT']
const ORDEN = ['identificacion', 'contacto', 'diagnostico', 'demo', 'propuesta', 'negociacion']

interface HubFase { id: string; phase: string; content: string; files: { id: string; name: string; size: number; mimeType: string }[] }
interface Interaccion { id: string; type: 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP'; description: string; date: string; user: { name: string } }
interface Propuesta { id: string; title: string; amount: number; status: string; documents?: { id: string; name: string; url: string; archived: boolean }[] }

const ICONO_INT = { CALL: Phone, EMAIL: Mail, MEETING: Users, WHATSAPP: MessageCircle } as const
const tabsDe = (raw: string): { id: string; name: string; content: string }[] => {
  if (!raw) return []
  try { const v = JSON.parse(raw); if (v && Array.isArray(v.tabs)) return v.tabs } catch { /* texto plano */ }
  return [{ id: 'g', name: 'General', content: raw }]
}
const sinHtml = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim()
const vacio = (raw: string) => tabsDe(raw).every(t => !sinHtml(t.content || ''))
const dinero = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO')
const fechaCorta = (v: string) => new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })

/** Lo que el Lead Hub tiene de esta fase: notas (editables), archivos, propuesta e interacciones. En ejecución, el historial comercial en solo lectura. */
export default function LeadDeFase({ leadId, clave }: { leadId: string; clave: string }) {
  const [hub, setHub] = useState<HubFase[] | null>(null)
  const [ints, setInts] = useState<Interaccion[]>([])
  const [prop, setProp] = useState<Propuesta | null>(null)
  const [estadoLead, setEstadoLead] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [texto, setTexto] = useState<string | null>(null) // edición en curso; null = sin cambios
  const [guardando, setGuardando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const etapa = ETAPA_DE_FASE[clave]

  useEffect(() => {
    let vivo = true
    Promise.all([
      api<HubFase[]>(`/api/leads/hub-phase?leadId=${leadId}`).catch(() => []),
      api<Interaccion[]>(`/api/leads/${leadId}/interactions`).catch(() => []),
      api<Propuesta | null>(`/api/leads/${leadId}/proposal`).catch(() => null),
      api<{ status: string }>(`/api/leads/${leadId}`).catch(() => null),
    ]).then(([h, i, p, l]) => { if (vivo) { setEstadoLead(l?.status ?? null); setHub(Array.isArray(h) ? h : []); setInts(Array.isArray(i) ? i : []); setProp(p && p.id ? p : null) } })
    return () => { vivo = false }
  }, [leadId])

  const fila = useMemo(() => hub?.find(h => h.phase === etapa?.status) ?? null, [hub, etapa])
  const contenido = texto ?? fila?.content ?? ''
  // Igual que el Lead Hub: solo se bloquea una etapa a la que el lead todavía no llegó (el servidor también lo exige).
  const puedeEditar = !!etapa && estadoLead !== null && ESTADOS_LEAD.indexOf(etapa.status) <= ESTADOS_LEAD.indexOf(estadoLead)

  async function guardar() {
    if (!etapa || texto === null) return
    setGuardando(true); setError('')
    try {
      const r = await api<HubFase>('/api/leads/hub-phase', { method: 'PUT', body: JSON.stringify({ leadId, phase: etapa.status, content: texto }) })
      setHub(prev => [...(prev ?? []).filter(h => h.phase !== etapa.status), { ...r, files: r.files ?? fila?.files ?? [] }])
      setTexto(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setGuardando(false) }
  }
  async function descargar(id: string, nombre: string) {
    try {
      const { base64, mimeType } = await api<{ base64: string; mimeType: string }>(`/api/leads/hub-file?id=${id}`)
      const a = document.createElement('a'); a.href = `data:${mimeType};base64,${base64}`; a.download = nombre; a.click()
    } catch { setError('No se pudo descargar el archivo') }
  }

  if (!hub) return <div className="flex justify-center py-4 text-[#7f8a9c]"><Loader2 size={14} className="animate-spin" /></div>

  // Fases de ejecución: el historial comercial, solo lectura y plegado
  if (!etapa) {
    const con = ORDEN.map(k => ({ k, e: ETAPA_DE_FASE[k], f: hub.find(h => h.phase === ETAPA_DE_FASE[k].status) })).filter(x => x.f && !vacio(x.f.content))
    return (
      <div>
        <button onClick={() => setAbierto(o => !o)} className="flex items-center gap-1.5 text-[12px] text-gray-300 hover:text-white">
          {abierto ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Historial comercial ({con.length} etapa{con.length === 1 ? '' : 's'} con notas)
        </button>
        {abierto && (
          <div className="mt-2 space-y-3">
            {con.length === 0 && <p className="text-[11px] text-[#7f8a9c]">El lead no tiene notas.</p>}
            {con.map(x => (
              <div key={x.k}>
                <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">{x.e.nombre}</p>
                {tabsDe(x.f!.content).filter(t => sinHtml(t.content || '')).map(t => (
                  <div key={t.id} className="mb-2">
                    {tabsDe(x.f!.content).length > 1 && <p className="text-[11px] text-indigo-300 mb-0.5">{t.name}</p>}
                    <div className="text-[12px] text-gray-300 leading-relaxed [&_h2]:text-[13px] [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: sanitizarHtml(t.content) }} />
                  </div>))}
              </div>))}
          </div>)}
      </div>
    )
  }

  const conPropuesta = clave === 'propuesta' || clave === 'negociacion'
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Notas de la etapa «{etapa.nombre}»</p>
        {puedeEditar
          ? (<>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <TabbedNotes key={fila?.id ?? 'nuevo'} value={contenido} onChange={setTexto} />
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <button onClick={() => void guardar()} disabled={guardando || texto === null || vacio(texto)} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg text-white disabled:opacity-40" style={{ background: 'rgba(99,102,241,0.8)' }}>
                {guardando ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Guardar en el Lead Hub</button>
              {texto !== null && <span className="text-[10px] text-amber-300">Cambios sin guardar</span>}
              <a href={`/leads/${leadId}/hub`} target="_blank" rel="noreferrer" className="ml-auto text-[10px] text-[#7f8a9c] hover:text-gray-200 flex items-center gap-1"><ExternalLink size={10} /> Abrir el Lead Hub</a>
            </div>
          </>)
          : (estadoLead === null
            ? <p className="text-[11px] text-[#7f8a9c]">No se pudo leer el estado del lead.</p>
            : <p className="text-[11px] text-[#7f8a9c]">El lead todavía no llegó a esta etapa: aún no se escriben notas aquí.</p>)}
        {error && <p className="text-[11px] text-red-300 mt-1">{error}</p>}
      </div>

      {!!fila?.files?.length && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Archivos</p>
          <div className="space-y-1">
            {fila.files.map(f => (
              <button key={f.id} onClick={() => void descargar(f.id, f.name)} className="w-full flex items-center gap-2 text-left rounded-md px-2 py-1 hover:bg-white/[0.06]">
                <Paperclip size={11} className="text-[#7f8a9c] flex-shrink-0" /><span className="text-[11px] text-gray-300 truncate flex-1">{f.name}</span>
                <span className="text-[10px] text-[#7f8a9c]">{Math.max(1, Math.round(f.size / 1024))} KB</span><Download size={11} className="text-[#7f8a9c]" />
              </button>))}
          </div>
        </div>)}

      {conPropuesta && prop && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Propuesta</p>
          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-[12px] text-gray-200">{prop.title} <span className="text-[10px] text-[#7f8a9c]">· {prop.status} · {dinero(prop.amount)}</span></p>
            {(prop.documents ?? []).filter(d => !d.archived).map(d => <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="block text-[11px] text-indigo-300 hover:text-indigo-200 truncate">{d.name}</a>)}
          </div>
        </div>)}

      {ints.length > 0 && (
        <div>
          <button onClick={() => setAbierto(o => !o)} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#7f8a9c] hover:text-gray-300">
            {abierto ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Interacciones con el cliente ({ints.length}) · de todo el lead
          </button>
          {abierto && (
            <div className="mt-1 space-y-1">
              {ints.slice(0, 20).map(i => { const I = ICONO_INT[i.type] ?? Phone; return (
                <div key={i.id} className="flex items-start gap-2 text-[11px] px-2 py-1">
                  <I size={11} className="text-[#7f8a9c] mt-0.5 flex-shrink-0" /><span className="text-gray-300 flex-1">{i.description}</span><span className="text-[10px] text-[#7f8a9c] flex-shrink-0">{fechaCorta(i.date)} · {i.user?.name}</span>
                </div>) })}
            </div>)}
        </div>)}
    </div>
  )
}
