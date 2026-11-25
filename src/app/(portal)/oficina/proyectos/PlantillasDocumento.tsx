'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X, Plus, Save, Archive, RotateCcw, Lock } from 'lucide-react'
import PanelRico from './PanelRico'
import { api, post, patch, hace } from './api'

// Catálogo de plantillas de documento, por tipo (acta, briefing, propuesta, informe…). Cada una trae la estructura en Markdown que la IA respeta al redactar
// y con la que arranca un documento vacío; los entregables de tipo documento apuntan a una por su nombre. Variables que se llenan solas: {{proyecto}} y {{fecha}}.

export interface PlantillaDoc { id: string; nombre: string; tipo: string; descripcion: string | null; estructura: string; marca: boolean; version: number; estado: 'ACTIVA' | 'ARCHIVADA'; actualizadoPor: string | null; updatedAt: string }
export const TIPO_DOC: Record<string, string> = { acta: 'Acta', briefing: 'Briefing', propuesta: 'Propuesta', informe: 'Informe', otro: 'Otro' }
interface Borrador { nombre: string; tipo: string; descripcion: string; estructura: string; marca: boolean }
const VACIO: Borrador = { nombre: '', tipo: 'acta', descripcion: '', estructura: '# Título del documento\n\n## 1. Primera sección\n\n', marca: true }
const campo = 'w-full rounded-md px-2 py-1.5 text-[12px] text-gray-200 bg-black/30 border border-white/10 outline-none focus:border-indigo-500/50 disabled:opacity-60 [color-scheme:dark]'
const etiqueta = 'block text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1'

export default function PlantillasDocumento({ onCerrar, onCambio }: { onCerrar: () => void; onCambio: () => void }) {
  const [lista, setLista] = useState<PlantillaDoc[] | null>(null)
  const [tipos, setTipos] = useState<string[]>(Object.keys(TIPO_DOC))
  const [sel, setSel] = useState<string | 'nueva' | null>(null)
  const [b, setB] = useState<Borrador>(VACIO)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [archivadas, setArchivadas] = useState(false)
  const [editable, setEditable] = useState(true)

  const cargar = useCallback(async () => {
    try {
      const r = await api<{ plantillas: PlantillaDoc[]; tipos: string[] }>('/api/plantillas-documento')
      setLista(r.plantillas); setTipos(r.tipos); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const actual = useMemo(() => lista?.find(p => p.id === sel) ?? null, [lista, sel])
  const sucio = sel === 'nueva' ? true : !!actual && (b.nombre !== actual.nombre || b.tipo !== actual.tipo || b.descripcion !== (actual.descripcion ?? '') || b.estructura !== actual.estructura || b.marca !== actual.marca)

  function elegir(p: PlantillaDoc) {
    if (sucio && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return
    setSel(p.id); setAviso(''); setError('')
    setB({ nombre: p.nombre, tipo: p.tipo, descripcion: p.descripcion ?? '', estructura: p.estructura, marca: p.marca })
  }
  function nueva() {
    if (sucio && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return
    setSel('nueva'); setB(VACIO); setAviso(''); setError('')
  }
  async function guardar() {
    if (guardando) return
    setGuardando(true); setError(''); setAviso('')
    try {
      if (sel === 'nueva') {
        const r = await post<{ id: string }>('/api/plantillas-documento', b)
        await cargar(); setSel(r.id); setAviso('Plantilla creada.')
      } else if (sel) {
        const r = await patch<{ version: number }>(`/api/plantillas-documento/${sel}`, b)
        await cargar(); setAviso(`Guardada · versión ${r.version}. Los documentos ya escritos no cambian.`)
      }
      onCambio()
    } catch (e) {
      const m = e instanceof Error ? e.message : 'No se pudo guardar'
      if (/administrador/i.test(m)) setEditable(false)
      setError(m)
    } finally { setGuardando(false) }
  }
  async function archivar(estado: 'ACTIVA' | 'ARCHIVADA') {
    if (!actual) return
    setGuardando(true); setError(''); setAviso('')
    try { await patch(`/api/plantillas-documento/${actual.id}`, { estado }); await cargar(); setAviso(estado === 'ARCHIVADA' ? 'Archivada: ya no se ofrece, pero los entregables que la usan siguen funcionando.' : 'Activada de nuevo.'); onCambio() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado') } finally { setGuardando(false) }
  }

  const grupos = (lista ?? []).filter(p => archivadas || p.estado === 'ACTIVA')
  const dis = !editable
  const nombreVista = b.nombre.trim() || 'Vista previa'

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, backdropFilter: 'blur(20px)', padding: 16 }}>
      <div className="w-full max-w-7xl h-full max-h-[92vh] flex flex-col overflow-hidden" style={{ background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, boxShadow: '0 8px 64px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center gap-3 px-7 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Plantillas de documentos</h2>
          {!editable && <span className="flex items-center gap-1 text-[11px] text-amber-300"><Lock size={11} /> Solo lectura: editar requiere ser administrador</span>}
          <span className="flex-1" />
          <button onClick={() => { if (!sucio || window.confirm('Hay cambios sin guardar. ¿Cerrar y descartarlos?')) onCerrar() }} title="Cerrar" aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
        </div>

        <div className="flex-1 min-h-0 flex">
          <aside className="w-[260px] flex-shrink-0 overflow-y-auto p-3 space-y-3" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            {!lista && !error && <Loader2 size={16} className="animate-spin text-[#7f8a9c]" />}
            {tipos.map(t => {
              const del = grupos.filter(p => p.tipo === t)
              if (del.length === 0) return null
              return (
                <div key={t}>
                  <p className={etiqueta}>{TIPO_DOC[t] ?? t}</p>
                  {del.map(p => (
                    <button key={p.id} onClick={() => elegir(p)} className="w-full text-left rounded-lg px-2.5 py-1.5 mb-1 transition-colors"
                      style={sel === p.id ? { background: 'rgba(249,115,22,0.18)', border: '1px solid rgba(249,115,22,0.5)' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <span className="block text-[12px] text-gray-100">{p.nombre}{p.estado === 'ARCHIVADA' ? ' · archivada' : ''}</span>
                      <span className="block text-[10px] text-[#7f8a9c]">Versión {p.version} · {hace(p.updatedAt)}</span>
                    </button>))}
                </div>)
            })}
            {lista && grupos.length === 0 && <p className="text-[11px] text-[#7f8a9c]">No hay plantillas todavía.</p>}
            <div className="pt-1 space-y-2">
              {!dis && <button onClick={nueva} className="w-full flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-indigo-200" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)' }}><Plus size={13} /> Nueva plantilla</button>}
              <label className="flex items-center gap-1.5 text-[11px] text-[#7f8a9c]"><input type="checkbox" checked={archivadas} onChange={e => setArchivadas(e.target.checked)} /> Mostrar archivadas</label>
            </div>
          </aside>

          <main className="flex-1 min-w-0 overflow-y-auto p-5 space-y-3">
            {error && <p role="alert" className="text-[12px] text-red-300">{error}</p>}
            {aviso && <p role="status" className="text-[12px] text-emerald-300">{aviso}</p>}
            {!sel ? (
              <p className="text-[13px] text-[#9aa6b8]">Elige una plantilla de la lista para verla y editarla, o crea una nueva. Cada entregable de tipo documento puede usar una plantilla desde el editor de plantillas de fases.</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                  <div><span className={etiqueta}>Nombre</span><input value={b.nombre} disabled={dis} maxLength={120} onChange={e => setB({ ...b, nombre: e.target.value })} className={campo} /></div>
                  <div><span className={etiqueta}>Tipo</span>
                    <select value={b.tipo} disabled={dis} onChange={e => setB({ ...b, tipo: e.target.value })} className={campo}>{tipos.map(t => <option key={t} value={t}>{TIPO_DOC[t] ?? t}</option>)}</select></div>
                </div>
                <div><span className={etiqueta}>Para qué sirve</span><input value={b.descripcion} disabled={dis} maxLength={300} onChange={e => setB({ ...b, descripcion: e.target.value })} className={campo} placeholder="Una frase" /></div>
                <label className="flex items-center gap-2 text-[12px] text-gray-300"><input type="checkbox" checked={b.marca} disabled={dis} onChange={e => setB({ ...b, marca: e.target.checked })} /> Lleva la marca de ArchiTechIA (encabezado y pie)</label>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div>
                    <span className={etiqueta}>Estructura (Markdown)</span>
                    <textarea value={b.estructura} disabled={dis} maxLength={6000} rows={26} onChange={e => setB({ ...b, estructura: e.target.value })} className={`${campo} font-mono !text-[11px] leading-relaxed`} spellCheck={false} />
                    <p className="mt-1 text-[11px] text-[#7f8a9c]">Usa <code>#</code> y <code>##</code> para los títulos y <code>| col | col |</code> para las tablas. <code>{'{{proyecto}}'}</code> y <code>{'{{fecha}}'}</code> se llenan solas. {b.estructura.length}/6000</p>
                  </div>
                  <div>
                    <span className={etiqueta}>Así se ve</span>
                    <div className="rounded-lg" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: 560, overflow: 'auto' }}>
                      <div style={{ transform: 'scale(0.62)', transformOrigin: 'top left', width: '161%' }}>
                        <PanelRico proyectoId="" fase="" clave="" valor={b.estructura} onCambio={() => {}} soloLectura puedeEditar={false} sucio={false} guardando={false} onGuardar={() => {}} titulo={nombreVista} marca={b.marca} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {!dis && <button onClick={guardar} disabled={guardando || !sucio || b.nombre.trim().length < 3} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>{guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar</button>}
                  {!dis && actual && (actual.estado === 'ACTIVA'
                    ? <button onClick={() => archivar('ARCHIVADA')} disabled={guardando} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] text-gray-300 disabled:opacity-40" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}><Archive size={13} /> Archivar</button>
                    : <button onClick={() => archivar('ACTIVA')} disabled={guardando} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] text-gray-300 disabled:opacity-40" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}><RotateCcw size={13} /> Reactivar</button>)}
                  {actual && <span className="text-[11px] text-[#7f8a9c]">Versión {actual.version}{actual.actualizadoPor ? ` · ${actual.actualizadoPor}` : ''}. Cambiar la estructura sube la versión y no modifica los documentos ya escritos.</span>}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>,
    document.body,
  )
}
