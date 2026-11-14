'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Upload, X, LayoutGrid, List, Search, Download, ExternalLink, Loader2, ArrowLeft } from 'lucide-react'
import { aHtml } from '../oficina/proyectos/PanelRico'
import { TIPOS, ESTADOS, PLURAL, esSoloLectura, formatoIcono, type DocumentoFila, type DocumentoDetalle, type Opciones } from '@/lib/documentos/tipos'

// Repositorio de documentos: por cliente (iconos agrupados por tipo), lista, por estado y cronología.
// Lo enviado o firmado es de solo lectura; aquí solo se cambia el estado de seguimiento o se sube una versión nueva.

const COLOR_TIPO: Record<string, string> = { Propuesta: '#6c8cff', 'Presentación': '#a98bff', Contrato: '#3ccf9e', Acta: '#f0a35c', Factura: '#f59e6b', Informe: '#4cc4de', Otro: '#94a3b8' }
const COLOR_ESTADO: Record<string, string> = { Borrador: '#94a3b8', Enviado: '#6c8cff', 'En negociación': '#f0a35c', Firmado: '#3ccf9e', Rechazado: '#f27b72', Reemplazado: '#64748b' }
const caja = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 } as const
const campo = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, colorScheme: 'dark' } as const
// Las listas desplegables nativas ignoran el fondo transparente: se les da fondo oscuro propio.
const ESTILO_LISTAS = 'select option{background:#0f172a;color:#e5e7eb}'
const fecha = (s: string | null) => (s ? new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const tam = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : n ? `${n} B` : '')
const fechaDoc = (d: DocumentoFila) => d.enviadoEn ?? d.createdAt

type Vista = 'cliente' | 'lista' | 'estado' | 'tiempo'

function Chip({ estado }: { estado: string }) {
  const c = COLOR_ESTADO[estado] ?? '#94a3b8'
  return <span className="inline-block text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: c, border: `1px solid ${c}66` }}>{estado}</span>
}

function Icono({ d }: { d: DocumentoFila }) {
  const k = COLOR_TIPO[d.tipo] ?? '#94a3b8'
  const x = formatoIcono(d)
  return (
    <svg viewBox="0 0 64 78" width="58" height="70" aria-hidden>
      <path d="M6 4h34l18 18v50a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="rgba(255,255,255,0.05)" stroke={k} strokeWidth="2.5" />
      <path d="M40 4v14a4 4 0 0 0 4 4h14" fill={`${k}33`} stroke={k} strokeWidth="2.5" />
      <rect x="10" y="30" width="26" height="3" rx="1.5" fill={k} opacity=".55" /><rect x="10" y="38" width="36" height="3" rx="1.5" fill={k} opacity=".3" /><rect x="10" y="46" width="30" height="3" rx="1.5" fill={k} opacity=".3" />
      <rect x="8" y="58" width="32" height="12" rx="3" fill={k} /><text x="24" y="67" textAnchor="middle" fontSize="8" fontWeight="700" fill="#0b1220" fontFamily="system-ui">{x}</text>
    </svg>
  )
}

function Tarjeta({ d, onClick }: { d: DocumentoFila; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative text-center p-3 hover:brightness-125 transition" style={caja}>
      <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full" style={{ background: COLOR_ESTADO[d.estado] ?? '#94a3b8' }} title={d.estado} />
      <div className="flex justify-center mb-2"><Icono d={d} /></div>
      <p className="text-[12px] font-semibold text-gray-100 leading-snug line-clamp-2">{d.titulo}</p>
      <p className="text-[11px] text-[#7f8a9c] mt-0.5">v{d.version} · {fecha(fechaDoc(d))}</p>
    </button>
  )
}

function Fila({ d, onClick, cliente }: { d: DocumentoFila; onClick: () => void; cliente?: boolean }) {
  return (
    <tr onClick={onClick} className="cursor-pointer hover:bg-white/5 border-b border-white/5 last:border-0">
      <td className="px-3 py-2.5"><p className="text-[13px] text-gray-100 font-medium">{d.titulo}</p><p className="text-[11px] text-[#7f8a9c]">{d.tipo} · v{d.version}</p></td>
      {cliente && <td className="px-3 py-2.5 text-[12px] text-gray-300">{d.clienteNombre}<p className="text-[11px] text-[#7f8a9c]">{d.proyectoNombre ?? ''}</p></td>}
      <td className="px-3 py-2.5 text-[12px] text-gray-300 whitespace-nowrap">{fecha(fechaDoc(d))}</td>
      <td className="px-3 py-2.5"><Chip estado={d.estado} /></td>
    </tr>
  )
}

export default function DocumentosView() {
  const [docs, setDocs] = useState<DocumentoFila[] | null>(null)
  const [ops, setOps] = useState<Opciones>({ clientes: [], proyectos: [] })
  const [error, setError] = useState('')
  const [vista, setVista] = useState<Vista>('cliente')
  const [modo, setModo] = useState<'iconos' | 'lista'>('iconos')
  const [q, setQ] = useState('')
  const [ftipo, setFtipo] = useState('')
  const [cliente, setCliente] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState<{ grupo?: string; titulo?: string; tipo?: string; cliente?: string; solucionId?: string } | null>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/repositorio-docs', { cache: 'no-store' })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Error ${r.status}`)
      const j = await r.json() as { documentos: DocumentoFila[]; opciones: Opciones }
      setDocs(j.documentos); setOps(j.opciones); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar'); setDocs(d => d ?? []) }
  }, [])
  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('cliente')) setCliente(p.get('cliente'))
    if (p.get('doc')) setAbierto(p.get('doc'))
  }, [])

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (docs ?? []).filter(d => (!ftipo || d.tipo === ftipo) && (!t || `${d.titulo} ${d.clienteNombre} ${d.proyectoNombre ?? ''}`.toLowerCase().includes(t)))
  }, [docs, q, ftipo])

  const porCliente = useMemo(() => {
    const m = new Map<string, DocumentoFila[]>()
    for (const d of filtrados) m.set(d.clienteNombre, [...(m.get(d.clienteNombre) ?? []), d])
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [filtrados])

  const abrirDoc = (id: string) => setAbierto(id)
  const btn = 'flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg text-gray-100'

  const docsCliente = cliente ? filtrados.filter(d => d.clienteNombre === cliente) : []
  const tiposCliente = TIPOS.filter(t => (docs ?? []).some(d => d.clienteNombre === cliente && d.tipo === t))

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1200px]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          {cliente ? <button onClick={() => setCliente(null)} className="flex items-center gap-1 text-[12px] text-indigo-300 mb-1"><ArrowLeft size={12} /> Todos los clientes</button> : null}
          <h1 className="text-[20px] font-bold text-gray-100">{cliente ?? 'Documentos'}</h1>
          <p className="text-[12px] text-[#7f8a9c]">{cliente ? `${(docs ?? []).filter(d => d.clienteNombre === cliente).length} documentos` : 'Todo lo enviado, firmado y archivado'}</p>
        </div>
        <button onClick={() => setSubiendo({ cliente: cliente ?? undefined })} className={`${btn} font-semibold`} style={{ background: 'rgba(99,102,241,0.75)' }}><Upload size={13} /> Subir documento</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!cliente && (
          <div className="flex rounded-lg overflow-hidden" style={campo}>
            {([['cliente', 'Por cliente'], ['lista', 'Lista'], ['estado', 'Por estado'], ['tiempo', 'Cronología']] as [Vista, string][]).map(([v, t]) => (
              <button key={v} onClick={() => setVista(v)} className="text-[12px] px-3 py-1.5" style={{ background: vista === v ? 'rgba(99,102,241,0.75)' : 'transparent', color: vista === v ? '#fff' : '#cbd5e1' }}>{t}</button>))}
          </div>)}
        <div className="flex items-center gap-1.5 flex-1 min-w-[180px] px-2.5 py-1.5" style={campo}>
          <Search size={13} className="text-[#7f8a9c]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar documento, cliente o proyecto" className="bg-transparent outline-none text-[12px] text-gray-100 w-full" />
        </div>
        {cliente
          ? <div className="flex flex-wrap gap-1.5">{['', ...tiposCliente].map(t => <button key={t || 'todos'} onClick={() => setFtipo(t)} className="text-[12px] px-3 py-1 rounded-full" style={{ background: ftipo === t ? 'rgba(99,102,241,0.75)' : 'rgba(255,255,255,0.06)', color: ftipo === t ? '#fff' : '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)' }}>{t ? PLURAL[t] : 'Todos'}</button>)}</div>
          : <select value={ftipo} onChange={e => setFtipo(e.target.value)} className="text-[12px] text-gray-100 px-2.5 py-1.5" style={campo}><option value="">Todos los tipos</option>{TIPOS.map(t => <option key={t} value={t}>{PLURAL[t]}</option>)}</select>}
        {cliente && <div className="flex rounded-lg overflow-hidden" style={campo}>
          <button onClick={() => setModo('iconos')} title="Iconos" className="px-2.5 py-1.5" style={{ background: modo === 'iconos' ? 'rgba(99,102,241,0.75)' : 'transparent', color: '#e5e7eb' }}><LayoutGrid size={14} /></button>
          <button onClick={() => setModo('lista')} title="Lista" className="px-2.5 py-1.5" style={{ background: modo === 'lista' ? 'rgba(99,102,241,0.75)' : 'transparent', color: '#e5e7eb' }}><List size={14} /></button>
        </div>}
      </div>

      {error && <p className="text-[12px] text-red-300">{error}</p>}
      {!docs && <div className="py-10 flex justify-center"><Loader2 size={18} className="animate-spin text-[#7f8a9c]" /></div>}
      {docs && docs.length === 0 && !error && <div className="py-12 text-center text-[13px] text-[#7f8a9c]" style={caja}>Todavía no hay documentos. Sube uno, o marca una propuesta como enviada desde el editor del proyecto.</div>}

      {docs && docs.length > 0 && filtrados.length === 0 && <p className="text-[13px] text-[#7f8a9c] py-6 text-center">Ningún documento coincide con la búsqueda.</p>}

      {docs && filtrados.length > 0 && !cliente && vista === 'cliente' && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}>
          {porCliente.map(([nombre, l]) => {
            const n = (e: string) => l.filter(d => d.estado === e).length
            const ult = [...l].sort((a, b) => fechaDoc(b).localeCompare(fechaDoc(a)))[0]
            return (
              <button key={nombre} onClick={() => { setCliente(nombre); setFtipo('') }} className="text-left p-4 hover:brightness-125 transition" style={caja}>
                <p className="text-[14px] font-semibold text-gray-100">{nombre}</p>
                <p className="text-[12px] text-[#7f8a9c]">{l.length} documentos · {new Set(l.map(d => d.proyectoNombre).filter(Boolean)).size} proyecto(s)</p>
                <div className="flex flex-wrap gap-1.5 my-2.5">
                  {n('En negociación') > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: COLOR_ESTADO['En negociación'], border: `1px solid ${COLOR_ESTADO['En negociación']}66` }}>{n('En negociación')} en negociación</span>}
                  {n('Firmado') > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: COLOR_ESTADO.Firmado, border: `1px solid ${COLOR_ESTADO.Firmado}66` }}>{n('Firmado')} firmado(s)</span>}
                  {n('Enviado') > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: COLOR_ESTADO.Enviado, border: `1px solid ${COLOR_ESTADO.Enviado}66` }}>{n('Enviado')} enviado(s)</span>}
                  {n('Borrador') > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full text-gray-400" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>{n('Borrador')} borrador</span>}
                  {n('Rechazado') > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: COLOR_ESTADO.Rechazado, border: `1px solid ${COLOR_ESTADO.Rechazado}66` }}>{n('Rechazado')} rechazado</span>}
                </div>
                <p className="text-[11px] text-[#7f8a9c] border-t border-white/10 pt-2">Último: {ult.titulo} · {fecha(fechaDoc(ult))}</p>
              </button>)
          })}
        </div>)}

      {docs && filtrados.length > 0 && !cliente && vista === 'lista' && (
        <div style={caja} className="overflow-x-auto"><table className="w-full"><thead><tr className="text-left text-[11px] text-[#7f8a9c] border-b border-white/10"><th className="px-3 py-2 font-medium">Documento</th><th className="px-3 py-2 font-medium">Cliente / proyecto</th><th className="px-3 py-2 font-medium">Fecha</th><th className="px-3 py-2 font-medium">Estado</th></tr></thead>
          <tbody>{filtrados.map(d => <Fila key={d.id} d={d} cliente onClick={() => abrirDoc(d.id)} />)}</tbody></table></div>)}

      {docs && filtrados.length > 0 && !cliente && vista === 'estado' && (
        <div className="grid gap-2.5 overflow-x-auto" style={{ gridTemplateColumns: 'repeat(5,minmax(190px,1fr))' }}>
          {ESTADOS.filter(e => e !== 'Reemplazado').map(e => {
            const l = filtrados.filter(d => d.estado === e)
            return (
              <div key={e} className="p-2 min-h-[120px]" style={{ ...caja, borderRadius: 12 }}>
                <p className="flex justify-between text-[12px] font-semibold px-1 mb-2" style={{ color: COLOR_ESTADO[e] }}><span>{e}</span><span className="text-[#7f8a9c] font-normal">{l.length}</span></p>
                {l.map(d => <button key={d.id} onClick={() => abrirDoc(d.id)} className="block w-full text-left p-2 mb-1.5 rounded-lg hover:brightness-125" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}><p className="text-[12px] font-medium text-gray-100">{d.titulo}</p><p className="text-[11px] text-[#7f8a9c]">{d.clienteNombre}</p></button>)}
              </div>)
          })}
        </div>)}

      {docs && filtrados.length > 0 && !cliente && vista === 'tiempo' && (() => {
        const l = [...filtrados].sort((a, b) => fechaDoc(b).localeCompare(fechaDoc(a)))
        const g = new Map<string, DocumentoFila[]>()
        for (const d of l) { const k = new Date(fechaDoc(d)).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }); g.set(k, [...(g.get(k) ?? []), d]) }
        return <div className="space-y-4">{[...g.entries()].map(([mes, ds]) => (
          <div key={mes}><p className="text-[12px] font-semibold text-[#7f8a9c] capitalize mb-1.5">{mes}</p>
            <div className="space-y-1.5">{ds.map(d => <button key={d.id} onClick={() => abrirDoc(d.id)} className="w-full flex flex-wrap items-center gap-2 px-3 py-2 text-left hover:brightness-125" style={{ ...caja, borderRadius: 10 }}><span className="text-[13px] font-medium text-gray-100">{d.titulo}</span><span className="text-[11px] text-[#7f8a9c] flex-1">{d.clienteNombre} · {fecha(fechaDoc(d))}</span><Chip estado={d.estado} /></button>)}</div></div>))}</div>
      })()}

      {docs && cliente && (
        modo === 'iconos'
          ? <div className="space-y-5">{TIPOS.filter(t => docsCliente.some(d => d.tipo === t)).map(t => (
            <div key={t}><p className="text-[11px] uppercase tracking-wide text-[#7f8a9c] font-semibold mb-2">{PLURAL[t]} <span className="normal-case tracking-normal font-normal">{docsCliente.filter(d => d.tipo === t).length}</span></p>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>{docsCliente.filter(d => d.tipo === t).map(d => <Tarjeta key={d.id} d={d} onClick={() => abrirDoc(d.id)} />)}</div></div>))}
            {docsCliente.length === 0 && <p className="text-[13px] text-[#7f8a9c]">Sin documentos con ese filtro.</p>}
            <div className="flex flex-wrap gap-4 text-[11px] text-[#7f8a9c]">{Object.entries(COLOR_ESTADO).map(([e, c]) => <span key={e}><i className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: c }} />{e}</span>)}</div></div>
          : <div style={caja} className="overflow-x-auto"><table className="w-full"><tbody>{docsCliente.map(d => <Fila key={d.id} d={d} onClick={() => abrirDoc(d.id)} />)}</tbody></table></div>)}

      {abierto && <Detalle id={abierto} onCerrar={() => setAbierto(null)} onCambio={() => void cargar()} onNuevaVersion={s => { setAbierto(null); setSubiendo(s) }} />}
      {subiendo && <Subir inicial={subiendo} ops={ops} clientesExistentes={[...new Set((docs ?? []).map(d => d.clienteNombre))]} onCerrar={() => setSubiendo(null)} onListo={() => { setSubiendo(null); void cargar() }} />}
    </div>
  )
}

function Detalle({ id, onCerrar, onCambio, onNuevaVersion }: { id: string; onCerrar: () => void; onCambio: () => void; onNuevaVersion: (s: { grupo: string; titulo: string; tipo: string; cliente: string; solucionId?: string }) => void }) {
  const [d, setD] = useState<DocumentoDetalle | null>(null)
  const [error, setError] = useState('')
  const [valor, setValor] = useState('')
  const cargar = useCallback(async () => {
    try { const r = await fetch(`/api/repositorio-docs/${id}`, { cache: 'no-store' }); if (!r.ok) throw new Error('No se pudo abrir el documento'); setD(await r.json()) } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
  }, [id])
  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => { const t = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }; window.addEventListener('keydown', t); return () => window.removeEventListener('keydown', t) }, [onCerrar])

  async function estado(nuevo: string) {
    setError('')
    const v = valor.trim() ? Number(valor.replace(/[^\d.]/g, '')) : undefined
    const r = await fetch(`/api/repositorio-docs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevo, valorFinal: v }) })
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error || 'No se pudo cambiar'); return }
    setValor(''); await cargar(); onCambio()
  }

  const esArchivo = !!d && !d.tieneContenido
  const inline = !!d && /pdf|png|jpe?g|gif|webp/i.test(`${d.mime ?? ''}${d.archivoNombre ?? ''}`) && esArchivo
  const srcDoc = d?.contenido ? `<!doctype html><meta charset="utf-8"><style>body{font:14px/1.6 system-ui;color:#1b2330;padding:20px;max-width:760px;margin:auto}table{border-collapse:collapse}td,th{border:1px solid #ccd;padding:4px 8px}</style>${aHtml(d.contenido)}` : ''
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col md:flex-row" style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18 }}>
      <style>{ESTILO_LISTAS}</style>
        <div className="flex-1 min-h-[260px] md:min-h-0 p-3 overflow-auto" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {!d && !error && <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-[#7f8a9c]" size={18} /></div>}
          {d && d.tieneContenido && <iframe title="Vista previa" sandbox="" srcDoc={srcDoc} className="w-full h-[70vh] rounded-lg bg-white" />}
          {d && inline && (/pdf/i.test(`${d.mime ?? ''}${d.archivoNombre ?? ''}`) ? <iframe title="Vista previa" src={`/api/repositorio-docs/${d.id}/archivo?inline=1`} className="w-full h-[70vh] rounded-lg bg-white" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img alt={d.titulo} src={`/api/repositorio-docs/${d.id}/archivo?inline=1`} className="max-w-full mx-auto rounded-lg" />)}
          {d && esArchivo && !inline && <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-[#7f8a9c] py-10"><Icono d={d} /><p className="text-[13px]">Este formato no tiene vista previa en el portal.</p><a href={`/api/repositorio-docs/${d.id}/archivo`} className="text-[12px] text-indigo-300 underline">Descargar {d.archivoNombre}</a></div>}
          {error && <p className="text-[12px] text-red-300">{error}</p>}
        </div>
        {d && (
          <div className="w-full md:w-[300px] flex-shrink-0 p-4 overflow-y-auto border-t md:border-t-0 md:border-l border-white/10 space-y-3">
            <div className="flex items-start gap-2"><div className="flex-1 min-w-0"><p className="text-[15px] font-bold text-gray-100">{d.titulo}</p><p className="text-[12px] text-[#7f8a9c]">{d.tipo} · versión {d.version}</p></div><button onClick={onCerrar} aria-label="Cerrar" className="text-[#94a3b8]"><X size={16} /></button></div>
            <dl className="grid gap-x-2 gap-y-1 text-[12px]" style={{ gridTemplateColumns: '84px 1fr' }}>
              <dt className="text-[#7f8a9c]">Estado</dt><dd><Chip estado={d.estado} /></dd>
              <dt className="text-[#7f8a9c]">Cliente</dt><dd className="text-gray-200">{d.clienteNombre}</dd>
              <dt className="text-[#7f8a9c]">Proyecto</dt><dd className="text-gray-200">{d.proyectoNombre ?? '—'}</dd>
              {d.canal && <><dt className="text-[#7f8a9c]">Canal</dt><dd className="text-gray-200">{d.canal}</dd></>}
              <dt className="text-[#7f8a9c]">Fecha</dt><dd className="text-gray-200">{fecha(fechaDoc(d))}</dd>
              <dt className="text-[#7f8a9c]">Subido por</dt><dd className="text-gray-200">{d.creadoPorNombre ?? '—'}</dd>
              {d.tamano > 0 && <><dt className="text-[#7f8a9c]">Tamaño</dt><dd className="text-gray-200">{tam(d.tamano)}</dd></>}
              {d.valorFinal !== null && <><dt className="text-[#7f8a9c]">Valor final</dt><dd className="text-gray-200">{d.valorFinal.toLocaleString('es-CO')}</dd></>}
            </dl>
            <div className="flex flex-wrap gap-1.5">
              {esArchivo && inline && <a href={`/api/repositorio-docs/${d.id}/archivo?inline=1`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg text-white" style={{ background: 'rgba(99,102,241,0.75)' }}><ExternalLink size={12} /> Abrir</a>}
              <a href={`/api/repositorio-docs/${d.id}/archivo${d.tieneContenido ? '?formato=md' : ''}`} className="flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg text-gray-100" style={campo}><Download size={12} /> Descargar</a>
              <button onClick={() => onNuevaVersion({ grupo: d.grupo, titulo: d.titulo, tipo: d.tipo, cliente: d.clienteNombre, solucionId: d.solucionId ?? undefined })} className="text-[12px] px-2.5 py-1.5 rounded-lg text-gray-100" style={campo}>Subir versión nueva</button>
              {d.tieneContenido && d.solucionId && <a href={`/oficina?view=proyectos&p=${encodeURIComponent(d.solucionId)}`} className="text-[12px] px-2.5 py-1.5 rounded-lg text-gray-100" style={campo}>Editar en el proyecto</a>}
            </div>
            {esSoloLectura(d.estado) && <p className="text-[11px] text-amber-300">Copia congelada: no se edita. Para corregirla, crea una versión nueva.</p>}
            <div className="space-y-1.5"><label className="text-[11px] text-[#7f8a9c]">Cambiar estado</label>
              <select value={d.estado} onChange={e => void estado(e.target.value)} className="w-full text-[12px] text-gray-100 px-2 py-1.5" style={campo}>{ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}</select>
              <input value={valor} onChange={e => setValor(e.target.value)} placeholder="Valor final acordado (opcional)" inputMode="decimal" className="w-full text-[12px] text-gray-100 px-2 py-1.5 bg-transparent outline-none" style={campo} />
              <p className="text-[10px] text-[#7f8a9c]">El valor se guarda al cambiar el estado.</p></div>
            {error && <p className="text-[12px] text-red-300">{error}</p>}
            <div><p className="text-[11px] text-[#7f8a9c] mb-1">Historial</p><ul className="space-y-1">{d.historial.map((h, i) => <li key={i} className="text-[12px] text-gray-300 pl-3 border-l border-white/15">{h.evento}<span className="block text-[10px] text-[#7f8a9c]">{h.usuarioNombre ?? ''} · {fecha(h.createdAt)}</span></li>)}</ul></div>
          </div>)}
      </div>
    </div>
  )
}

function Subir({ inicial, ops, clientesExistentes, onCerrar, onListo }: { inicial: { grupo?: string; titulo?: string; tipo?: string; cliente?: string; solucionId?: string }; ops: Opciones; clientesExistentes: string[]; onCerrar: () => void; onListo: () => void }) {
  const [titulo, setTitulo] = useState(inicial.titulo ?? '')
  const [tipo, setTipo] = useState(inicial.tipo ?? 'Contrato')
  const [estado, setEstado] = useState('Borrador')
  const [clienteSel, setClienteSel] = useState(inicial.cliente ?? '')
  const [clienteNuevo, setClienteNuevo] = useState('')
  const [solucionId, setSolucionId] = useState(inicial.solucionId ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const nombres = useMemo(() => [...new Set([...ops.clientes.map(c => c.nombre), ...clientesExistentes])].sort((a, b) => a.localeCompare(b, 'es')), [ops.clientes, clientesExistentes])

  async function enviar() {
    if (!file) { setError('Elige un archivo.'); return }
    if (!titulo.trim()) { setError('Falta el título.'); return }
    const nombre = clienteSel === '__nuevo' ? clienteNuevo.trim() : clienteSel
    if (!nombre && !solucionId) { setError('Indica el cliente o el proyecto.'); return }
    setEnviando(true); setError('')
    const f = new FormData()
    f.set('archivo', file); f.set('titulo', titulo); f.set('tipo', tipo); f.set('estado', estado); f.set('clienteNombre', nombre)
    const cid = ops.clientes.find(c => c.nombre === nombre)?.id
    if (cid) f.set('clienteId', cid)
    if (solucionId) f.set('solucionId', solucionId)
    if (inicial.grupo) f.set('grupo', inicial.grupo)
    try {
      const r = await fetch('/api/repositorio-docs', { method: 'POST', body: f })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Error ${r.status}`)
      onListo()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo subir'); setEnviando(false) }
  }
  const inp = 'w-full text-[13px] text-gray-100 px-2.5 py-2 bg-transparent outline-none'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="w-full max-w-md p-5 space-y-3 max-h-[92vh] overflow-y-auto" style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16 }}>
        <style>{ESTILO_LISTAS}</style>
        <div className="flex items-center"><h2 className="flex-1 text-[15px] font-bold text-gray-100">{inicial.grupo ? 'Subir versión nueva' : 'Subir documento'}</h2><button onClick={onCerrar} aria-label="Cerrar" className="text-[#94a3b8]"><X size={16} /></button></div>
        {inicial.grupo && <p className="text-[11px] text-[#7f8a9c]">La versión anterior pasará a «Reemplazado» y seguirá visible.</p>}
        <label className="block text-[12px] text-[#7f8a9c]">Archivo (máx. 15 MB)<input type="file" onChange={e => { const x = e.target.files?.[0] ?? null; setFile(x); if (x && !titulo) setTitulo(x.name.replace(/\.[^.]+$/, '')) }} className="block w-full mt-1 text-[12px] text-gray-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-indigo-500/80 file:text-white file:text-[12px] file:font-semibold file:cursor-pointer" /></label>
        <label className="block text-[12px] text-[#7f8a9c]">Título<input value={titulo} onChange={e => setTitulo(e.target.value)} className={inp} style={campo} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[12px] text-[#7f8a9c]">Tipo<select value={tipo} onChange={e => setTipo(e.target.value)} className={inp} style={campo}>{TIPOS.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
          <label className="block text-[12px] text-[#7f8a9c]">Estado<select value={estado} onChange={e => setEstado(e.target.value)} className={inp} style={campo}>{ESTADOS.filter(x => x !== 'Reemplazado').map(t => <option key={t} value={t}>{t}</option>)}</select></label>
        </div>
        <label className="block text-[12px] text-[#7f8a9c]">Cliente
          <select value={clienteSel} onChange={e => setClienteSel(e.target.value)} className={inp} style={campo}><option value="">— elegir —</option>{nombres.map(n => <option key={n} value={n}>{n}</option>)}<option value="__nuevo">Otro cliente (escribir)</option></select></label>
        {clienteSel === '__nuevo' && <input value={clienteNuevo} onChange={e => setClienteNuevo(e.target.value)} placeholder="Nombre del cliente" className={inp} style={campo} />}
        <label className="block text-[12px] text-[#7f8a9c]">Proyecto (opcional)
          <select value={solucionId} onChange={e => setSolucionId(e.target.value)} className={inp} style={campo}><option value="">— ninguno —</option>{ops.proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
        {error && <p className="text-[12px] text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-1"><button onClick={onCerrar} className="text-[12px] px-3 py-1.5 rounded-lg text-gray-300" style={campo}>Cancelar</button><button onClick={() => void enviar()} disabled={enviando} className="text-[12px] px-3 py-1.5 rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: 'rgba(99,102,241,0.8)' }}>{enviando ? 'Subiendo…' : 'Guardar'}</button></div>
      </div>
    </div>
  )
}
