'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '../proyectos/api'
import { type AgenteOrg, type AreaOrg, type Organigrama, NIVEL } from './tipos'
import AgFicha from './AgFicha'
import AgAprobaciones from './AgAprobaciones'
import AgAlta from './AgAlta'
import AgIdentidades from './AgIdentidades'
import AgHilos from './AgHilos'

// Identidad, gateway y trazabilidad de los agentes: jerarquía por áreas con editor de ficha y matriz de comunicación,
// bandeja de aprobaciones, alta guiada, identidades por canal y los hilos con sus decisiones.
type Pestana = 'jerarquia' | 'aprobaciones' | 'alta' | 'identidades' | 'hilos'

function Fila({ a, sel, nombreSuperior, onSel }: { a: AgenteOrg; sel: boolean; nombreSuperior: string | null; onSel: () => void }) {
  return (
    <button type="button" onClick={onSel} aria-pressed={sel} className="w-full text-left rounded-md px-2.5 py-1.5 flex items-center gap-2 hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-purple-400/60"
      style={{ background: sel ? 'rgba(167,139,250,0.14)' : 'transparent', border: `1px solid ${sel ? 'rgba(167,139,250,0.5)' : 'transparent'}` }}>
      <span aria-hidden className="inline-block rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: a.estado !== 'ACTIVE' ? '#4b5563' : a.conFuncion ? '#4ade80' : '#a3a3a3' }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-gray-100 truncate">{a.nombre}</span>
        <span className="block text-[10.5px] text-[#7f8a9c] truncate">{a.rol}{nombreSuperior ? ` · reporta a ${nombreSuperior}` : ''}</span>
      </span>
      {a.autonomia && <span className="text-[10px] flex-shrink-0" style={{ color: NIVEL[a.autonomia]?.color }}>{NIVEL[a.autonomia]?.txt}</span>}
      <span className="text-[10px] text-[#7f8a9c] flex-shrink-0" title="Reglas de comunicación">{a.reglasComunicacion}↔</span>
    </button>
  )
}

export default function DirectoryAgentes() {
  const [tab, setTab] = useState<Pestana>('jerarquia')
  const [org, setOrg] = useState<Organigrama | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState(0)

  const cargar = useCallback(async () => {
    try {
      const [o, p] = await Promise.all([api<Organigrama>('/api/agentes/organigrama'), api<unknown[]>('/api/gateway/aprobaciones')])
      setOrg(o); setPendientes(p.length)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer el organigrama') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const nombres = useMemo(() => new Map((org?.agentes ?? []).map(a => [a.slug, a.nombre])), [org])
  // Áreas raíz, sus subáreas y los agentes de cada una; lo que no tiene área va aparte.
  const hijos = useMemo(() => {
    const m = new Map<string | null, AreaOrg[]>()
    for (const a of org?.areas ?? []) m.set(a.padre, [...(m.get(a.padre) ?? []), a])
    return m
  }, [org])
  const porArea = (id: string) => (org?.agentes ?? []).filter(a => a.areaId === id)
  const sinArea = (org?.agentes ?? []).filter(a => !a.areaId)

  const Area = ({ area, nivel }: { area: AreaOrg; nivel: number }) => {
    const ags = porArea(area.id)
    const subs = hijos.get(area.id) ?? []
    if (!ags.length && !subs.some(s => porArea(s.id).length)) return null
    return (
      <div style={{ marginLeft: nivel * 12 }}>
        <div className="text-[10px] font-black uppercase tracking-wider mt-3 mb-1 px-1" style={{ color: area.color }}>{area.nombre}</div>
        {ags.map(a => <Fila key={a.slug} a={a} sel={sel === a.slug} nombreSuperior={a.superior ? nombres.get(a.superior) ?? a.superior : null} onSel={() => setSel(a.slug)} />)}
        {subs.map(s => <Area key={s.id} area={s} nivel={nivel + 1} />)}
      </div>
    )
  }

  const boton = (t: Pestana, texto: string, n?: number) => (
    <button onClick={() => setTab(t)} aria-pressed={tab === t}
      className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${tab === t ? 'bg-purple-500/25 text-purple-200' : 'text-gray-400 hover:text-gray-200'}`}>
      {texto}{n ? <span className="ml-1.5 px-1.5 rounded-full bg-amber-400/20 text-amber-200">{n}</span> : null}
    </button>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="px-5 py-2 border-b border-white/5 flex-shrink-0 flex flex-wrap items-center gap-1" style={{ background: 'rgba(167,139,250,0.03)' }} role="tablist">
        {boton('jerarquia', 'Jerarquía y fichas')}{boton('aprobaciones', 'Aprobaciones', pendientes)}{boton('hilos', 'Trazabilidad')}{boton('identidades', 'Identidades')}{boton('alta', 'Nuevo agente')}
      </div>
      {error && <p role="alert" className="m-4 text-[12px] text-red-300">{error}</p>}
      {!org && !error ? <div className="flex-1 flex items-center justify-center text-[#7f8a9c]"><Loader2 className="animate-spin" size={18} /></div> : org && (
        tab === 'jerarquia' ? (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0">
            <nav className="lg:w-[340px] flex-shrink-0 p-3 overflow-y-auto lg:border-r border-white/5 max-h-[40vh] lg:max-h-none" aria-label="Agentes por área">
              <p className="text-[10.5px] text-[#7f8a9c] px-1">{org.agentes.length} agentes · verde: con función real · «n↔»: reglas de comunicación</p>
              {(hijos.get(null) ?? []).map(a => <Area key={a.id} area={a} nivel={0} />)}
              {sinArea.length > 0 && <div><div className="text-[10px] font-black uppercase tracking-wider mt-3 mb-1 px-1 text-gray-400">Sin área</div>{sinArea.map(a => <Fila key={a.slug} a={a} sel={sel === a.slug} nombreSuperior={a.superior ? nombres.get(a.superior) ?? a.superior : null} onSel={() => setSel(a.slug)} />)}</div>}
            </nav>
            <div className="flex-1 min-w-0 overflow-y-auto">
              {sel ? <AgFicha slug={sel} agentes={org.agentes} alCambiar={() => void cargar()} /> : <p className="p-6 text-[12px] text-[#7f8a9c]">Elige un agente para ver y editar su alma, su alcance, su autonomía y con quién se comunica.</p>}
            </div>
          </div>
        ) : tab === 'aprobaciones' ? <AgAprobaciones alCambiar={() => void cargar()} />
          : tab === 'hilos' ? <AgHilos agentes={org.agentes.map(a => ({ slug: a.slug, nombre: a.nombre }))} />
          : tab === 'identidades' ? <AgIdentidades />
          : <AgAlta org={org} alCrear={slug => { setSel(slug); setTab('jerarquia'); void cargar() }} />
      )}
    </div>
  )
}
