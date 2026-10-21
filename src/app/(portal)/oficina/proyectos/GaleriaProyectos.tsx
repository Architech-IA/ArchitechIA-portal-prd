'use client'

import { FolderKanban, Loader2, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { hace, ETIQUETA_BLOQUE, type FaseLista, type ProyectoLista } from './api'

// Portada de Oficina > Proyectos: los proyectos como tarjetas de vidrio. Al abrir uno, la lista lateral queda plegada y se despliega con el botón de la cabecera.

type Nat = 'todas' | 'COMERCIAL' | 'INTERNO'

interface Props {
  proyectos: ProyectoLista[]; cargando: boolean
  filtro: string; onFiltro: (v: string) => void
  nat: Nat; onNat: (n: Nat) => void; conteo: (n: Nat) => number
  orden: string; onOrden: (o: string) => void; ordenes: { k: string; txt: string }[]
  onElegir: (id: string) => void; onNuevo: () => void; onPlantillas: () => void
  espera: (f: FaseLista | null) => boolean; color: (f: FaseLista) => string; texto: (f: FaseLista) => string
}

const VIDRIO = {
  background: 'linear-gradient(150deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03) 55%, rgba(255,255,255,0.05))',
  border: '1px solid rgba(255,255,255,0.13)',
  backdropFilter: 'blur(22px) saturate(170%)', WebkitBackdropFilter: 'blur(22px) saturate(170%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.38)',
} as const

export default function GaleriaProyectos({ proyectos, cargando, filtro, onFiltro, nat, onNat, conteo, orden, onOrden, ordenes, onElegir, onNuevo, onPlantillas, espera, color, texto }: Props) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
      <style>{`
.galeria-card { position: relative; overflow: hidden; transition: transform .2s cubic-bezier(.22,1,.36,1), border-color .2s, box-shadow .2s; }
.galeria-card::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,0.14), transparent 55%); opacity: .7; transition: opacity .2s; }
.galeria-card:hover { transform: translateY(-3px); border-color: rgba(249,115,22,0.5) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(249,115,22,0.18) !important; }
.galeria-card:hover::before { opacity: 1; }
.galeria-card:focus-visible { outline: 2px solid rgba(249,115,22,0.75); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .galeria-card, .galeria-card::before { transition: none; } .galeria-card:hover { transform: none; } }`}</style>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2"><FolderKanban size={16} className="text-indigo-300" /><h2 className="text-[15px] font-bold text-gray-100">Proyectos</h2><span className="text-[12px] text-[#7f8a9c]">{conteo('todas')}</span></div>
        <span className="flex-1" />
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-2.5 text-[#7f8a9c]" />
          <input value={filtro} onChange={e => onFiltro(e.target.value)} placeholder="Buscar proyecto…" aria-label="Buscar proyecto" className="w-56 rounded-xl pl-8 pr-3 py-2 text-[12px] text-gray-200 outline-none placeholder-gray-500" style={VIDRIO} />
        </div>
        <div className="flex gap-1.5">
          {([['todas', 'Todos'], ['COMERCIAL', 'Business'], ['INTERNO', 'Intern']] as const).map(([k, txt]) => (
            <button key={k} onClick={() => onNat(k)} aria-pressed={nat === k} className="px-3 py-1.5 rounded-xl text-[11px] transition-colors"
              style={nat === k ? { background: 'rgba(168,85,247,0.28)', color: '#f3e8ff', border: '1px solid rgba(168,85,247,0.55)' } : { ...VIDRIO, color: '#9ca3af' }}>{txt} {conteo(k)}</button>))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-[#7f8a9c]">Orden
          <select value={orden} onChange={e => onOrden(e.target.value)} className="rounded-xl px-2.5 py-1.5 text-[11px] text-gray-200 outline-none" style={VIDRIO}>{ordenes.map(o => <option key={o.k} value={o.k} style={{ background: '#111827' }}>{o.txt}</option>)}</select>
        </label>
        <button onClick={onPlantillas} title="Plantillas de fases: entregables, criterios y roles de sesión" aria-label="Plantillas de fases" className="flex items-center justify-center w-8 h-8 rounded-xl text-[#9ca3af] hover:text-gray-100" style={VIDRIO}><SlidersHorizontal size={14} /></button>
        <button onClick={onNuevo} title="Nuevo proyecto: registra el lead, crea el proyecto y arranca el motor" className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium text-white" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 6px 18px rgba(234,88,12,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}><Plus size={13} /> Nuevo proyecto</button>
      </div>

      {cargando && <div className="flex justify-center py-16 text-[#7f8a9c]"><Loader2 size={18} className="animate-spin" /></div>}
      {!cargando && proyectos.length === 0 && <p className="text-[12px] text-[#7f8a9c] text-center py-16">No hay proyectos que coincidan.</p>}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
        {proyectos.map(p => {
          const f = p.fase
          const interno = p.naturaleza === 'INTERNO'
          return (
            <button key={p.id} onClick={() => onElegir(p.id)} className="galeria-card text-left rounded-[20px] p-4 flex flex-col gap-3 min-h-[168px]" style={VIDRIO}>
              <div className="relative flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={interno ? { background: 'rgba(168,85,247,0.22)', color: '#e9d5ff', border: '1px solid rgba(168,85,247,0.4)' } : { background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.12)' }} title={'Tipo: ' + p.tipo}>{interno ? 'Interno' : 'Business'}</span>
                <span className="flex-1" />
                {espera(f) && <span title="La puerta de la fase está completa: espera aprobación" className="flex items-center gap-1 text-[10px] text-emerald-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Por aprobar</span>}
                {p.propuestasPendientes > 0 && <span title="Propuestas de memoria pendientes" className="flex items-center gap-1 text-[10px] text-amber-300"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{p.propuestasPendientes}</span>}
              </div>
              <div className="relative min-w-0">
                <p className="text-[14px] font-semibold text-gray-50 leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.nombre}</p>
                {(f?.cliente || p.codigo) && <p className="text-[11px] text-[#9ca3af] mt-0.5 truncate">{[f?.cliente, p.codigo].filter(Boolean).join(' · ')}</p>}
              </div>
              <div className="relative mt-auto">
                {f ? (<>
                  <div className="flex gap-0.5 mb-1.5">{Array.from({ length: f.totalFases }, (_, i) => {
                    const n = i + 1
                    const hecha = f.estadoMotor === 'COMPLETADO' || n < f.numero
                    const actual = n === f.numero && f.estadoMotor !== 'COMPLETADO'
                    return <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: hecha ? '#10b981' : actual ? (f.estadoMotor === 'CERRADO_PERDIDO' ? '#ef4444' : '#6366f1') : 'rgba(255,255,255,0.14)' }} />
                  })}</div>
                  <p className="text-[11px] font-medium truncate" style={{ color: color(f) }}>{texto(f)}<span className="font-normal text-[#9ca3af]"> · {(ETIQUETA_BLOQUE[f.bloque] ?? '').toLowerCase()}{f.estadoMotor === 'EN_CURSO' && f.puerta.total > 0 ? ' · puerta ' + f.puerta.ok + '/' + f.puerta.total : ''}</span></p>
                </>) : <p className="text-[11px] text-[#6b7280]">Sin motor de fases</p>}
                <p className="text-[10px] text-[#7f8a9c] mt-1.5">{p.sesiones} sesión{p.sesiones === 1 ? '' : 'es'}{p.ultimaActividad ? ' · ' + hace(p.ultimaActividad) : ''}</p>
              </div>
            </button>)
        })}
      </div>
    </div>
  )
}
