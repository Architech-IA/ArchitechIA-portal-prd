'use client'

import { useCallback, useEffect, useState } from 'react'
import InfraDemos from './InfraDemos'
import { Plus, RefreshCw, Trash2, Pencil, Eye, EyeOff, ExternalLink, X, Loader2, Save } from 'lucide-react'

// Registro interno del catálogo de demos, MVPs y casos. Lo marcado como «público» aparece en la vitrina /demos.

type Ficha = {
  id: string; slug: string; nombre: string; resumen: string; sector: string; servicio: string; tipo: string
  url: string | null; icono: string; publico: boolean; orden: number; vivo: boolean | null; verificadoAt: string | null; solucionNombre?: string | null
}
const VACIA = { nombre: '', resumen: '', sector: '', servicio: 'agentes', tipo: 'DEMO', url: '', icono: 'sparkles', publico: false, orden: 0 }
const ICONOS = ['sparkles', 'bot', 'edificio', 'calendario', 'documentos', 'logistica', 'analitica', 'datos', 'flujo', 'seguridad']
const SERVICIOS: Record<string, string> = { agentes: 'Agentes de IA', automatizacion: 'Automatización', datos: 'Datos y analítica', otro: 'Otros' }
const TIPOS: Record<string, string> = { DEMO: 'Demo en vivo', MVP: 'MVP', CASO_REAL: 'Caso real' }

async function llamar(ruta: string, metodo: string, cuerpo?: unknown) {
  const r = await fetch(ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error || j?.message || 'No se pudo completar la acción')
  return j
}

const campo = 'w-full rounded-lg bg-[#0d1522] border border-[#243247] px-3 py-2 text-[13px] text-[#e6e9ef] placeholder-[#5b6678] focus:outline-none focus:border-cyan-500'

function Fichas() {
  const [filas, setFilas] = useState<Ficha[] | null>(null)
  const [edit, setEdit] = useState<(typeof VACIA & { id?: string }) | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [ocupado, setOcupado] = useState('')

  const cargar = useCallback(async () => {
    try { setFilas(await llamar('/api/demos-catalogo', 'GET')) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar'); setFilas([]) }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  async function guardar() {
    if (!edit) return
    setGuardando(true); setError('')
    try {
      const cuerpo = { ...edit, url: edit.url?.trim() || null }
      if (edit.id) await llamar(`/api/demos-catalogo/${edit.id}`, 'PUT', cuerpo)
      else await llamar('/api/demos-catalogo', 'POST', cuerpo)
      setEdit(null); await cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setGuardando(false) }
  }
  async function accion(id: string, fn: () => Promise<unknown>) {
    setOcupado(id); setError('')
    try { await fn(); await cargar() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción') } finally { setOcupado('') }
  }
  const alternarPublico = (f: Ficha) => accion(f.id, () => llamar(`/api/demos-catalogo/${f.id}`, 'PUT', { ...f, url: f.url, publico: !f.publico }))
  const comprobar = (f: Ficha) => accion(f.id, () => llamar(`/api/demos-catalogo/${f.id}/verificar`, 'POST'))
  const borrar = (f: Ficha) => { if (window.confirm(`¿Quitar «${f.nombre}» del catálogo? La demo en sí no se toca.`)) void accion(f.id, () => llamar(`/api/demos-catalogo/${f.id}`, 'DELETE')) }

  return (
    <div className="p-6 max-w-5xl mx-auto text-[#e6e9ef]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-semibold">Catálogo de demos</h1>
        <div className="flex gap-2">
          <a href="/demos" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-lg border border-[#2a3a52] text-[#b8c2d3] hover:bg-white/5"><ExternalLink size={13} /> Ver la vitrina</a>
          <button type="button" onClick={() => { setError(''); setEdit({ ...VACIA }) }} className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium"><Plus size={14} /> Nueva ficha</button>
        </div>
      </div>
      <p className="text-[13px] text-[#8b97ab] mb-5">Cada ficha es una demo, MVP o caso. Solo las marcadas como públicas aparecen en la vitrina. La salud se comprueba sola cada 15 minutos.</p>

      {error && <p className="mb-4 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      {edit && (
        <div className="mb-6 rounded-xl border border-[#243247] bg-[#0b1220] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold">{edit.id ? 'Editar ficha' : 'Nueva ficha'}</p>
            <button type="button" onClick={() => setEdit(null)} aria-label="Cerrar" className="text-[#7f8a9c] hover:text-white"><X size={16} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[12px] text-[#8b97ab]">Nombre<input className={campo + ' mt-1'} value={edit.nombre} maxLength={120} onChange={e => setEdit({ ...edit, nombre: e.target.value })} placeholder="Asistente de cotización" /></label>
            <label className="text-[12px] text-[#8b97ab]">Sector<input className={campo + ' mt-1'} value={edit.sector} maxLength={60} onChange={e => setEdit({ ...edit, sector: e.target.value })} placeholder="Seguros" /></label>
            <label className="text-[12px] text-[#8b97ab] sm:col-span-2">Frase de valor ({edit.resumen.length}/240)<textarea className={campo + ' mt-1 h-16 resize-none'} value={edit.resumen} maxLength={240} onChange={e => setEdit({ ...edit, resumen: e.target.value })} placeholder="Qué problema resuelve, en una frase." /></label>
            <label className="text-[12px] text-[#8b97ab]">Servicio<select className={campo + ' mt-1'} value={edit.servicio} onChange={e => setEdit({ ...edit, servicio: e.target.value })}>{Object.entries(SERVICIOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="text-[12px] text-[#8b97ab]">Tipo<select className={campo + ' mt-1'} value={edit.tipo} onChange={e => setEdit({ ...edit, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="text-[12px] text-[#8b97ab] sm:col-span-2">Dirección de la demo (https)<input className={campo + ' mt-1'} value={edit.url ?? ''} onChange={e => setEdit({ ...edit, url: e.target.value })} placeholder="https://xxx.architechia.co" /></label>
            <label className="text-[12px] text-[#8b97ab]">Icono<select className={campo + ' mt-1'} value={edit.icono} onChange={e => setEdit({ ...edit, icono: e.target.value })}>{ICONOS.map(i => <option key={i} value={i}>{i}</option>)}</select></label>
            <label className="text-[12px] text-[#8b97ab]">Orden en la vitrina<input type="number" min={0} max={9999} className={campo + ' mt-1'} value={edit.orden} onChange={e => setEdit({ ...edit, orden: Number(e.target.value) || 0 })} /></label>
            <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-[#cbd3e0]"><input type="checkbox" checked={edit.publico} onChange={e => setEdit({ ...edit, publico: e.target.checked })} /> Mostrar en la vitrina pública</label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setEdit(null)} className="text-[12.5px] px-3 py-1.5 rounded-lg text-[#9aa4b5] hover:bg-white/5">Cancelar</button>
            <button type="button" disabled={guardando || !edit.nombre.trim()} onClick={() => void guardar()} className="inline-flex items-center gap-1.5 text-[12.5px] px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-medium">{guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar</button>
          </div>
        </div>)}

      {filas === null && <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-[#7f8a9c]" size={18} /></div>}
      {filas !== null && filas.length === 0 && !error && <p className="py-10 text-center text-[13px] text-[#7f8a9c]">Aún no hay fichas. Crea la primera con «Nueva ficha».</p>}

      <div className="space-y-2">
        {(filas ?? []).map(f => (
          <div key={f.id} className="rounded-xl border border-[#1e2b3f] bg-[#0b1220] px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <p className="text-[14px] font-medium">{f.nombre}</p>
              <p className="text-[12px] text-[#7f8a9c]">{[TIPOS[f.tipo], SERVICIOS[f.servicio], f.sector].filter(Boolean).join(' · ')}{f.url ? ` · ${f.url.replace('https://', '')}` : ''}</p>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-md border ${f.vivo === true ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' : f.vivo === false ? 'border-red-500/30 text-red-300 bg-red-500/10' : 'border-[#2a3a52] text-[#7f8a9c]'}`}>
              {f.vivo === true ? 'Responde' : f.vivo === false ? 'No responde' : f.url ? 'Sin comprobar' : 'Sin dirección'}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md border ${f.publico ? 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10' : 'border-[#2a3a52] text-[#7f8a9c]'}`}>{f.publico ? 'Pública' : 'Privada'}</span>
            <div className="flex items-center gap-1">
              {ocupado === f.id && <Loader2 size={14} className="animate-spin text-[#7f8a9c] mr-1" />}
              <button type="button" title={f.publico ? 'Quitar de la vitrina' : 'Publicar en la vitrina'} aria-label={f.publico ? 'Quitar de la vitrina' : 'Publicar en la vitrina'} onClick={() => void alternarPublico(f)} className="p-1.5 rounded-md text-[#9aa4b5] hover:bg-white/5">{f.publico ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              {f.url && <button type="button" title="Comprobar ahora" aria-label="Comprobar ahora" onClick={() => void comprobar(f)} className="p-1.5 rounded-md text-[#9aa4b5] hover:bg-white/5"><RefreshCw size={15} /></button>}
              <button type="button" title="Editar" aria-label="Editar" onClick={() => { setError(''); setEdit({ id: f.id, nombre: f.nombre, resumen: f.resumen, sector: f.sector, servicio: f.servicio, tipo: f.tipo, url: f.url ?? '', icono: f.icono, publico: f.publico, orden: f.orden }) }} className="p-1.5 rounded-md text-[#9aa4b5] hover:bg-white/5"><Pencil size={15} /></button>
              <button type="button" title="Quitar del catálogo" aria-label="Quitar del catálogo" onClick={() => borrar(f)} className="p-1.5 rounded-md text-red-300/80 hover:bg-red-500/10"><Trash2 size={15} /></button>
            </div>
          </div>))}
      </div>
    </div>
  )
}

export default function CatalogoDemos() {
  const [tab, setTab] = useState<'fichas' | 'infra'>('fichas')
  const t = (k: 'fichas' | 'infra', n: string) => (
    <button type="button" onClick={() => setTab(k)} role="tab" aria-selected={tab === k}
      className={`px-4 py-2 text-[13px] border-b-2 -mb-px transition-colors ${tab === k ? 'border-cyan-400 text-white font-medium' : 'border-transparent text-[#8b97ab] hover:text-white'}`}>{n}</button>
  )
  return (
    <div>
      <div role="tablist" className="max-w-5xl mx-auto px-6 pt-4 flex gap-1 border-b border-[#1e2b3f]">{t('fichas', 'Fichas del catálogo')}{t('infra', 'Infraestructura')}</div>
      {tab === 'fichas' ? <Fichas /> : <InfraDemos />}
    </div>
  )
}
