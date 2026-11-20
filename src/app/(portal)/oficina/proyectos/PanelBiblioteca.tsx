'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, ChevronDown, ChevronRight, Palette, FileText, LayoutTemplate } from 'lucide-react'
import { api, put } from './api'

// Biblioteca de conocimiento y diseño (MASD-0026-0010): skills, sistemas de diseño y plantillas de paneles. Aquí se ve todo
// el detalle y se elige el sistema de diseño del proyecto. El contenido se edita con git (PR), no desde esta pantalla.

interface Ficha { tipo: string; nombre: string; descripcion?: string; cuandoUsar?: string; version?: string; licencia?: string; origen?: string; dueno?: string }
interface Detalle { ficha: Ficha; archivo: string; archivos: string[]; contenido: string }
interface Sistema { sistema: string | null; disponibles: { nombre: string; descripcion: string }[] }

const TIPOS: { k: string; txt: string; icono: typeof Palette }[] = [
  { k: 'sistemas-diseno', txt: 'Sistemas de diseño', icono: Palette },
  { k: 'skills', txt: 'Skills', icono: FileText },
  { k: 'plantillas-ui', txt: 'Plantillas de paneles', icono: LayoutTemplate },
]

export default function PanelBiblioteca({ proyectoId }: { proyectoId: string }) {
  const [items, setItems] = useState<Ficha[]>([])
  const [sistema, setSistema] = useState<Sistema | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const [b, s] = await Promise.all([api<{ elementos: Ficha[] }>('/api/biblioteca'), api<Sistema>(`/api/proyectos/${proyectoId}/sistema-diseno`)])
      setItems(b.elementos); setSistema(s)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer la biblioteca') }
    finally { setCargando(false) }
  }, [proyectoId])

  useEffect(() => { void cargar() }, [cargar])

  async function abrir(f: Ficha, archivo?: string) {
    const clave = `${f.tipo}/${f.nombre}`
    if (!archivo && abierto === clave) { setAbierto(null); setDetalle(null); return }
    setAbierto(clave); setLeyendo(true)
    try { setDetalle(await api<Detalle>(`/api/biblioteca/${f.tipo}/${f.nombre}${archivo ? `?archivo=${encodeURIComponent(archivo)}` : ''}`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir') }
    finally { setLeyendo(false) }
  }

  async function elegir(nombre: string) {
    setGuardando(true); setError(null)
    try { await put(`/api/proyectos/${proyectoId}/sistema-diseno`, { sistema: nombre }); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') }
    finally { setGuardando(false) }
  }

  if (cargando && !items.length) return <div className="p-6 flex justify-center text-[#7f8a9c]"><Loader2 className="animate-spin" size={18} /></div>

  return (
    <div className="p-3 space-y-3">
      {error && <p role="alert" className="text-[11px] text-red-300 rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>{error}</p>}

      <div className="rounded-lg px-3 py-2 space-y-1.5" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
        <label htmlFor="sistema-diseno" className="text-[11px] text-gray-300 font-medium">Sistema de diseño de este proyecto</label>
        <p className="text-[10.5px] text-[#9aa6b8]">Los agentes lo reciben en las tareas de interfaz y manda sobre cualquier otra referencia.</p>
        <select id="sistema-diseno" disabled={guardando} value={sistema?.sistema ?? ''} onChange={e => void elegir(e.target.value)}
          className="w-full bg-transparent rounded px-2 py-1.5 text-[12px] text-gray-100" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
          <option value="" style={{ color: '#111' }}>Ninguno (sin sistema de diseño)</option>
          {(sistema?.disponibles ?? []).map(s => <option key={s.nombre} value={s.nombre} style={{ color: '#111' }}>{s.nombre}</option>)}
        </select>
      </div>

      {TIPOS.map(t => {
        const filas = items.filter(i => i.tipo === t.k)
        if (!filas.length) return null
        return (
          <section key={t.k} aria-label={t.txt}>
            <h3 className="text-[10px] uppercase tracking-wider font-semibold text-[#7f8a9c] mb-1.5 flex items-center gap-1.5"><t.icono size={11} />{t.txt}</h3>
            <ul className="space-y-1.5">
              {filas.map(f => {
                const clave = `${f.tipo}/${f.nombre}`
                const ab = abierto === clave
                return (
                  <li key={clave} className="rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={() => void abrir(f)} aria-expanded={ab} className="w-full flex items-start gap-2 px-2.5 py-2 text-left">
                      {ab ? <ChevronDown size={13} className="mt-0.5 text-[#7f8a9c] flex-shrink-0" /> : <ChevronRight size={13} className="mt-0.5 text-[#7f8a9c] flex-shrink-0" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] text-gray-100">{f.nombre}{sistema?.sistema === f.nombre && <span className="ml-2 text-[10px] text-emerald-300">● en uso</span>}</span>
                        <span className="block text-[10.5px] text-[#9aa6b8] leading-snug">{f.descripcion}</span>
                      </span>
                    </button>
                    {ab && (
                      <div className="px-3 pb-2.5 space-y-2 text-[11px] text-[#9aa6b8]">
                        {f.cuandoUsar && <p><span className="text-[#6b7686]">Cuándo usarlo:</span> {f.cuandoUsar}</p>}
                        <p><span className="text-[#6b7686]">Versión</span> {f.version ?? '—'} · <span className="text-[#6b7686]">Licencia</span> {f.licencia ?? '—'}</p>
                        {f.origen && <p className="text-[10.5px]">{f.origen}</p>}
                        {leyendo && <Loader2 size={13} className="animate-spin" />}
                        {detalle && detalle.ficha.nombre === f.nombre && detalle.ficha.tipo === f.tipo && (
                          <>
                            <div className="flex flex-wrap gap-1">
                              {detalle.archivos.filter(x => x !== 'FICHA.json').map(x => (
                                <button key={x} onClick={() => void abrir(f, x)} className="px-1.5 py-0.5 rounded text-[10px]"
                                  style={x === detalle.archivo ? { background: 'rgba(99,102,241,0.2)', color: '#c7d2fe' } : { border: '1px solid rgba(255,255,255,0.1)' }}>{x}</button>))}
                            </div>
                            <pre className="whitespace-pre-wrap break-words max-h-[320px] overflow-auto rounded p-2 text-[10.5px] text-gray-300" style={{ background: 'rgba(0,0,0,0.25)' }}>{detalle.contenido}</pre>
                          </>)}
                      </div>)}
                  </li>)
              })}
            </ul>
          </section>)
      })}
      <p className="text-[10.5px] text-[#7f8a9c]">Esta biblioteca se edita con git (revisión por PR), no desde esta pantalla.</p>
    </div>
  )
}
