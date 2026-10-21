'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, ArrowUp, ArrowDown, Trash2, RefreshCw } from 'lucide-react'
import { api, post, put, del } from '../proyectos/api'

// Oficina > Config > Tipos de proyecto — la lista que se elige en la cabecera del proyecto y en «Nueva iniciativa».
// De cada tipo sale su naturaleza (comercial o interna) y, con ella, la plantilla de fases. Los cinco de siempre son del sistema:
// se renombran y reordenan, pero no se borran ni se desactivan. Solo los administradores pueden cambiar algo.

interface Tipo { clave: string; etiqueta: string; naturaleza: 'COMERCIAL' | 'INTERNO'; orden: number; activo: boolean; sistema: boolean; proyectos: number }
const inputCls = 'rounded-md px-2.5 py-1.5 text-[12px] text-gray-100 bg-black/30 border border-white/10 outline-none focus:border-indigo-400/50'

export default function TiposView() {
  const [tipos, setTipos] = useState<Tipo[] | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState({ etiqueta: '', naturaleza: 'COMERCIAL' })
  const [edicion, setEdicion] = useState<Record<string, string>>({})
  const cargar = useCallback(async () => {
    setCargando(true)
    try { setTipos(await api<Tipo[]>('/api/tipos-proyecto?todos=1')); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los tipos') } finally { setCargando(false) }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  async function accion(clave: string, f: () => Promise<unknown>) {
    setOcupado(clave); setError('')
    try { await f(); await cargar() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el cambio') } finally { setOcupado(null) }
  }
  const crear = (e: React.FormEvent) => { e.preventDefault(); void accion('nuevo', async () => { await post('/api/tipos-proyecto', nuevo); setNuevo({ etiqueta: '', naturaleza: nuevo.naturaleza }) }) }
  const guardarNombre = (t: Tipo) => {
    const v = (edicion[t.clave] ?? t.etiqueta).trim()
    setEdicion(m => { const c = { ...m }; delete c[t.clave]; return c })
    if (v && v !== t.etiqueta) void accion(t.clave, () => put(`/api/tipos-proyecto/${t.clave}`, { etiqueta: v }))
  }
  const mover = (i: number, d: -1 | 1) => {
    if (!tipos) return
    const l = tipos.map(t => t.clave); const j = i + d
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    void accion(l[j], () => post('/api/tipos-proyecto/orden', { claves: l }))
  }
  const borrar = (t: Tipo) => { if (window.confirm(`¿Borrar el tipo «${t.etiqueta}»? Ningún proyecto lo usa.`)) void accion(t.clave, () => del(`/api/tipos-proyecto/${t.clave}`)) }

  if (!tipos) return <div className="p-6 text-[12px] text-[#7f8a9c] flex items-center gap-2">{error ? <span className="text-red-300">{error}</span> : <><Loader2 size={14} className="animate-spin" /> Cargando los tipos…</>}</div>

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-gray-100">Tipos de proyecto</h2>
          <p className="text-[11px] text-[#7f8a9c] max-w-2xl">De cada tipo sale su naturaleza, comercial o interna, y con ella la plantilla de fases (12 fases la comercial, 8 la interna). Los tipos del sistema se renombran y reordenan, pero no se borran ni se desactivan.</p>
        </div>
        <span className="flex-1" />
        <button onClick={() => void cargar()} className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] hover:text-gray-100 px-2.5 py-1.5 rounded-lg border border-white/10"><RefreshCw size={12} className={cargando ? 'animate-spin' : ''} /> Actualizar</button>
      </div>
      {error && <p className="text-[11px] text-red-300">{error}</p>}

      <form onSubmit={crear} className="flex flex-wrap items-end gap-3 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <label className="text-[11px] text-[#9ca3af]">Nombre del tipo nuevo
          <input value={nuevo.etiqueta} onChange={e => setNuevo({ ...nuevo, etiqueta: e.target.value })} maxLength={40} placeholder="Ej.: Consultoría" className={inputCls + ' block mt-1 w-64'} /></label>
        <label className="text-[11px] text-[#9ca3af]">Naturaleza
          <select value={nuevo.naturaleza} onChange={e => setNuevo({ ...nuevo, naturaleza: e.target.value })} className={inputCls + ' block mt-1'}><option value="COMERCIAL">Comercial (plantilla de 12 fases)</option><option value="INTERNO">Interna (plantilla de 8 fases)</option></select></label>
        <button type="submit" disabled={ocupado === 'nuevo' || nuevo.etiqueta.trim().length < 3} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-40" style={{ background: '#6366f1' }}>
          {ocupado === 'nuevo' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Crear tipo</button>
      </form>

      <section className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] text-left">
            <thead className="text-[#7f8a9c] text-[11px]"><tr className="border-b border-white/5">
              <th className="px-3 py-2 font-medium w-[70px]">Orden</th><th className="py-2 pr-3 font-medium">Nombre</th><th className="py-2 pr-3 font-medium">Clave</th><th className="py-2 pr-3 font-medium">Naturaleza</th><th className="py-2 pr-3 font-medium">Proyectos</th><th className="py-2 pr-3 font-medium">Se ofrece</th><th className="py-2 pr-3 font-medium" />
            </tr></thead>
            <tbody className="text-gray-300">
              {tipos.map((t, i) => (
                <tr key={t.clave} className="border-t border-white/5" style={t.activo ? undefined : { opacity: 0.55 }}>
                  <td className="px-3 py-1.5">
                    <span className="flex items-center gap-0.5">
                      <button onClick={() => mover(i, -1)} disabled={i === 0 || ocupado !== null} aria-label="Subir" className="p-1 rounded hover:bg-white/10 disabled:opacity-30"><ArrowUp size={12} /></button>
                      <button onClick={() => mover(i, 1)} disabled={i === tipos.length - 1 || ocupado !== null} aria-label="Bajar" className="p-1 rounded hover:bg-white/10 disabled:opacity-30"><ArrowDown size={12} /></button>
                    </span>
                  </td>
                  <td className="pr-3"><input value={edicion[t.clave] ?? t.etiqueta} onChange={e => setEdicion({ ...edicion, [t.clave]: e.target.value })} onBlur={() => guardarNombre(t)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} maxLength={40} aria-label={'Nombre del tipo ' + t.clave} className={inputCls + ' w-56'} /></td>
                  <td className="pr-3 font-mono text-[11px] text-[#9ca3af]">{t.clave}{t.sistema && <span className="ml-1.5 text-[9px] px-1 rounded" style={{ background: 'rgba(99,102,241,0.2)', color: '#c7d2fe' }}>sistema</span>}</td>
                  <td className="pr-3">{t.sistema || t.proyectos > 0
                    ? <span className="text-[10px] px-2 py-0.5 rounded-full" style={t.naturaleza === 'INTERNO' ? { background: 'rgba(168,85,247,0.2)', color: '#d8b4fe' } : { background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }} title={t.sistema ? 'La naturaleza de un tipo del sistema no se cambia' : 'Tiene proyectos: no se puede cambiar su naturaleza'}>{t.naturaleza === 'INTERNO' ? 'Interna' : 'Comercial'}</span>
                    : <select value={t.naturaleza} disabled={ocupado !== null} onChange={e => void accion(t.clave, () => put(`/api/tipos-proyecto/${t.clave}`, { naturaleza: e.target.value }))} className={inputCls}><option value="COMERCIAL">Comercial</option><option value="INTERNO">Interna</option></select>}</td>
                  <td className="pr-3">{t.proyectos}</td>
                  <td className="pr-3">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer" title={t.sistema ? 'Un tipo del sistema no se puede desactivar' : 'Si está apagado, no aparece al elegir el tipo (los proyectos que ya lo tienen no cambian)'}>
                      <input type="checkbox" checked={t.activo} disabled={t.sistema || ocupado !== null} onChange={e => void accion(t.clave, () => put(`/api/tipos-proyecto/${t.clave}`, { activo: e.target.checked }))} />
                      <span className="text-[11px]">{t.activo ? 'Sí' : 'No'}</span>
                    </label>
                  </td>
                  <td className="pr-3 text-right">
                    {ocupado === t.clave ? <Loader2 size={12} className="animate-spin text-[#7f8a9c] inline" />
                      : !t.sistema && t.proyectos === 0 && <button onClick={() => borrar(t)} disabled={ocupado !== null} aria-label={'Borrar ' + t.etiqueta} title="Borrar (ningún proyecto lo usa)" className="p-1 rounded text-[#7f8a9c] hover:text-red-300 hover:bg-red-500/10 disabled:opacity-30"><Trash2 size={13} /></button>}
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 border-t border-white/5 text-[10px] text-[#7f8a9c] leading-snug">Un tipo nuevo usa una de las dos plantillas que existen según su naturaleza. Los formularios de lead y de proyecto nuevo siguen usando sus tipos de siempre; un tipo nuevo se asigna desde la cabecera del proyecto, o al crear una iniciativa interna.</p>
      </section>
    </div>
  )
}
