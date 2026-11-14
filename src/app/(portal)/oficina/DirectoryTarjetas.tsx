'use client'
import { useEffect, useMemo, useState } from 'react'

interface SubArea { id: string; name: string; slug: string; color: string; activeItems: number; inProgressItems: number }
interface Area extends SubArea { subAreas: SubArea[] }
interface Funcional { funciones: string[]; canales: string[]; bot?: string; colabora: string[] }
interface Agente { slug: string; name: string; role: string; status: string; llmModel: string | null; areaId: string | null; personality: string; funcional: Funcional | null }
interface Traspaso { de: string; a: string; tipo: string; ronda: number; createdAt: string; hilo: { pedido: string; estado: string } }

const NOMBRE_TIPO: Record<string, string> = { delegacion: 'delegó', contenido: 'entregó contenido', borrador: 'redactó un borrador', ajustes: 'pidió ajustes', aprobado: 'aprobó', respuesta: 'respondió' }
const hace = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`
}

function Punto({ a }: { a: Agente }) {
  const color = a.status !== 'ACTIVE' ? '#4b5563' : a.funcional ? '#4ade80' : '#a3a3a3'
  return <span aria-hidden className="inline-block rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: color }} />
}

function FilaAgente({ a, sel, onSel }: { a: Agente; sel: boolean; onSel: () => void }) {
  return (
    <button type="button" onClick={onSel} className="w-full text-left rounded-lg px-3 py-2 flex items-center gap-2.5 transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400"
      style={{ background: sel ? 'rgba(167,139,250,0.14)' : 'rgba(255,255,255,0.03)', border: `1px solid ${sel ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.07)'}` }}>
      <Punto a={a} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-gray-100 truncate">{a.name}</span>
        <span className="block text-[11px] text-[#8a95a8] truncate">{a.role}</span>
      </span>
      <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 flex-shrink-0"
        style={a.funcional ? { background: 'rgba(74,222,128,0.14)', color: '#86efac' } : { background: 'rgba(255,255,255,0.06)', color: '#9aa4b5' }}>
        {a.funcional ? 'Funcional' : 'Ficha'}
      </span>
    </button>
  )
}

interface Config { activo: boolean; accionesBloqueadas: string[]; reglas: string }
interface DatosControl { config: Config; acciones: { clave: string; etiqueta: string }[]; historial: { id: string; porNombre: string; resumen: string; antes: string; createdAt: string }[]; puedeEditar: boolean }

// Pausar el agente, bloquear acciones y reglas adicionales. Rige en el siguiente pedido, sin desplegar.
function ControlAgente({ slug }: { slug: string }) {
  const [d, setD] = useState<DatosControl | null>(null)
  const [cfg, setCfg] = useState<Config | null>(null)
  const [msg, setMsg] = useState('')
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    let vivo = true
    setD(null); setCfg(null); setMsg('')
    fetch(`/api/agents/${slug}/config`).then(r => r.json()).then((x: DatosControl) => { if (vivo && x.config) { setD(x); setCfg(x.config) } }).catch(() => {})
    return () => { vivo = false }
  }, [slug])
  if (!d || !cfg) return null

  const sucio = JSON.stringify(cfg) !== JSON.stringify(d.config)
  const guardar = async (nueva: Config) => {
    setGuardando(true); setMsg('')
    try {
      const r = await fetch(`/api/agents/${slug}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nueva) })
      const x = await r.json()
      if (!r.ok) { setMsg(x.error || 'No se pudo guardar'); return }
      setD({ ...d, config: x.config, historial: x.historial }); setCfg(x.config)
      setMsg(x.resumen === 'sin cambios' ? 'Sin cambios' : 'Guardado. Rige desde el próximo pedido.')
    } catch { setMsg('Error de conexión') } finally { setGuardando(false) }
  }
  const editar = d.puedeEditar
  const campo = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }
  return (
    <section className="mt-5" aria-label="Control del agente">
      <h4 className="text-[11px] font-black uppercase tracking-widest text-purple-300">Control</h4>
      {!editar && <p className="mt-2 text-[11px] text-amber-200/80">Solo un administrador puede cambiar esto.</p>}
      <label className="mt-3 flex items-center gap-2 text-xs text-gray-200">
        <input type="checkbox" disabled={!editar} checked={cfg.activo} onChange={e => setCfg({ ...cfg, activo: e.target.checked })} />
        <span>{cfg.activo ? 'Activo' : 'Pausado: no atiende pedidos'}</span>
      </label>
      <p className="mt-3 text-[11px] text-[#7f8a9c]">Acciones permitidas</p>
      <div className="mt-1 space-y-1">
        {d.acciones.map(ac => {
          const permitida = !cfg.accionesBloqueadas.includes(ac.clave)
          return (
            <label key={ac.clave} className="flex items-center gap-2 text-xs text-gray-200">
              <input type="checkbox" disabled={!editar} checked={permitida}
                onChange={e => setCfg({ ...cfg, accionesBloqueadas: e.target.checked ? cfg.accionesBloqueadas.filter(x => x !== ac.clave) : [...cfg.accionesBloqueadas, ac.clave] })} />
              <span>{ac.etiqueta}</span>
            </label>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] text-[#7f8a9c]">Reglas adicionales (se suman a su prompt; no anulan las reglas de datos ni las confirmaciones)</p>
      <textarea disabled={!editar} value={cfg.reglas} maxLength={1000} rows={4} onChange={e => setCfg({ ...cfg, reglas: e.target.value })}
        placeholder="Ej.: No agendar reuniones los viernes después de las 3 pm." className="mt-1 w-full rounded-md px-2.5 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-60" style={campo} />
      <p className="text-[10px] text-[#6b7686] text-right">{cfg.reglas.length}/1000</p>
      {editar && (
        <div className="mt-2 flex items-center gap-2">
          <button disabled={!sucio || guardando} onClick={() => guardar(cfg)} className="px-3 py-1.5 rounded-md text-xs font-semibold text-white disabled:opacity-40" style={{ background: '#7c5cf0' }}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
          {sucio && <button onClick={() => setCfg(d.config)} className="text-xs text-gray-400 hover:text-white">Descartar</button>}
        </div>
      )}
      {msg && <p role="status" className="mt-2 text-[11px] text-green-300">{msg}</p>}
      {d.historial.length > 0 && (
        <details className="mt-3">
          <summary className="text-[11px] text-[#8a95a8] cursor-pointer">Historial de cambios ({d.historial.length})</summary>
          <ol className="mt-2 space-y-1.5">
            {d.historial.map(h => (
              <li key={h.id} className="text-[11px] rounded-md p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-gray-200"><span className="font-semibold">{h.porNombre}</span> {h.resumen}</p>
                <p className="text-[10px] text-[#6b7686]">{hace(h.createdAt)}</p>
                {editar && <button disabled={guardando} onClick={() => { try { guardar(JSON.parse(h.antes)) } catch { /* historial ilegible */ } }} className="mt-1 text-[10px] text-sky-300 hover:text-sky-200 disabled:opacity-50">Volver a como estaba antes</button>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}

function Detalle({ a, nombres, onCerrar }: { a: Agente; nombres: Record<string, string>; onCerrar: () => void }) {
  const [act, setAct] = useState<{ total: number; traspasos: Traspaso[] } | null>(null)
  useEffect(() => {
    let vivo = true
    setAct(null)
    if (a.funcional) fetch(`/api/agents/${a.slug}/actividad`).then(r => r.json()).then(d => { if (vivo) setAct(d) }).catch(() => {})
    return () => { vivo = false }
  }, [a.slug, a.funcional])
  const f = a.funcional
  return (
    <aside className="w-full md:w-[22rem] flex-shrink-0 overflow-y-auto border-l border-white/10 p-5 pb-24" style={{ background: 'rgba(10,14,22,0.92)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white truncate">{a.name}</h3>
          <p className="text-xs text-[#8a95a8]">{a.role}</p>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar detalle" className="text-gray-400 hover:text-white text-lg leading-none px-1">×</button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div><dt className="text-[#7f8a9c]">Estado</dt><dd className="text-gray-200 mt-0.5">{a.status === 'ACTIVE' ? 'Activo' : a.status}</dd></div>
        <div><dt className="text-[#7f8a9c]">Función real</dt><dd className="mt-0.5" style={{ color: f ? '#86efac' : '#9aa4b5' }}>{f ? 'Sí' : 'Solo ficha'}</dd></div>
        <div className="col-span-2"><dt className="text-[#7f8a9c]">Modelo</dt><dd className="text-gray-200 mt-0.5 break-all">{a.llmModel || 'Sin definir'}</dd></div>
      </dl>
      <p className="mt-4 text-xs text-gray-400 leading-relaxed">{a.personality}</p>

      {f ? (
        <>
          <h4 className="mt-5 text-[11px] font-black uppercase tracking-widest text-purple-300">Qué hace</h4>
          <ul className="mt-2 space-y-1.5 text-xs text-gray-200 list-disc pl-4">{f.funciones.map(x => <li key={x}>{x}</li>)}</ul>
          <h4 className="mt-5 text-[11px] font-black uppercase tracking-widest text-purple-300">Dónde se usa</h4>
          <p className="mt-2 text-xs text-gray-200">{f.canales.join(' · ')}</p>
          {f.bot && <p className="mt-1 text-xs text-sky-300">{f.bot}</p>}
          {f.colabora.length > 0 && (<>
            <h4 className="mt-5 text-[11px] font-black uppercase tracking-widest text-purple-300">Colabora con</h4>
            <p className="mt-2 text-xs text-gray-200">{f.colabora.map(s => nombres[s] || s).join(', ')}</p>
          </>)}
          <ControlAgente slug={a.slug} />
          <h4 className="mt-5 text-[11px] font-black uppercase tracking-widest text-purple-300">Actividad reciente</h4>
          {!act && <p className="mt-2 text-xs text-gray-500">Cargando...</p>}
          {act && act.traspasos.length === 0 && <p className="mt-2 text-xs text-gray-500">Todavía no hay traspasos registrados.</p>}
          {act && act.traspasos.length > 0 && (
            <>
              <p className="mt-1 text-[11px] text-[#7f8a9c]">{act.total} traspaso(s) en total</p>
              <ol className="mt-2 space-y-2">
                {act.traspasos.map((t, i) => (
                  <li key={i} className="text-xs rounded-md p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <p className="text-gray-200"><span className="font-semibold">{nombres[t.de] || t.de}</span> {NOMBRE_TIPO[t.tipo] || t.tipo}{t.ronda ? ` (ronda ${t.ronda})` : ''} → {nombres[t.a] || t.a}</p>
                    <p className="text-[11px] text-[#7f8a9c] truncate">{t.hilo.pedido}</p>
                    <p className="text-[10px] text-[#6b7686]">{hace(t.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      ) : (
        <p className="mt-5 text-xs text-gray-400 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
          Este agente es una ficha del directorio: todavía no tiene un comportamiento real conectado al portal.
        </p>
      )}
    </aside>
  )
}

export default function DirectoryTarjetas({ areas }: { areas: Area[] }) {
  const [agentes, setAgentes] = useState<Agente[] | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => { fetch('/api/agentes-directorio').then(r => r.json()).then(d => setAgentes(Array.isArray(d) ? d : [])).catch(() => setAgentes([])) }, [])

  const nombres = useMemo(() => Object.fromEntries([['sage', 'Sage'], ...(agentes ?? []).map(a => [a.slug, a.name])]), [agentes])
  const porArea = useMemo(() => {
    const m = new Map<string, Agente[]>()
    for (const a of agentes ?? []) m.set(a.areaId ?? '', [...(m.get(a.areaId ?? '') ?? []), a])
    return m
  }, [agentes])
  // Áreas únicas (la consulta puede traer una fila por agente)
  const principales = useMemo(() => [...new Map(areas.map(a => [a.id, a])).values()], [areas])
  const conocidas = new Set(principales.flatMap(a => [a.id, ...a.subAreas.map(s => s.id)]))
  const sueltos = (agentes ?? []).filter(a => !a.areaId || !conocidas.has(a.areaId))
  const funcionales = (agentes ?? []).filter(a => a.funcional)
  const elegido = (agentes ?? []).find(a => a.slug === sel) ?? null

  const bloque = (area: SubArea, nivel: 0 | 1) => {
    const ags = porArea.get(area.id) ?? []
    return (
      <div key={area.id} className={nivel ? 'mt-3' : ''}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <h3 className={`font-black tracking-wide uppercase truncate ${nivel ? 'text-[10px]' : 'text-[12px]'}`} style={{ color: area.color }}>{area.name}</h3>
          {area.activeItems > 0 && <span className="text-[10px] font-mono flex-shrink-0" style={{ color: area.color + 'bb' }}>{area.activeItems} activas</span>}
        </div>
        {ags.length ? <div className="space-y-1.5">{ags.map(a => <FilaAgente key={a.slug} a={a} sel={sel === a.slug} onSel={() => setSel(sel === a.slug ? null : a.slug)} />)}</div>
          : <p className="text-[11px] text-[#5f6b7c]">Sin agente asignado</p>}
      </div>
    )
  }

  if (!agentes) return <div className="flex-1 flex items-center justify-center text-sm text-gray-500">Cargando directorio...</div>

  return (
    <div className="flex-1 flex min-h-0 flex-col md:flex-row overflow-hidden">
      <div className="flex-1 min-w-0 overflow-y-auto p-5 pb-24 space-y-5">
        {/* Orquestación */}
        <section className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.28)' }} aria-label="Orquestación">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Orquestador</p>
              <p className="text-lg font-bold text-white leading-tight">Sage</p>
              <p className="text-[11px] text-amber-200/70 max-w-xs">Recibe tu pedido, decide a quién delegarlo y deja constancia de cada traspaso. Botón «Sage» en el portal.</p>
            </div>
            <div className="flex-1 min-w-[16rem]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8a95a8] mb-1.5">Delega en</p>
              <div className="flex flex-wrap gap-2">
                {funcionales.map(a => (
                  <button key={a.slug} onClick={() => setSel(a.slug)} className="text-xs rounded-full px-3 py-1 text-green-200 hover:bg-white/10 transition-colors" style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }}>{a.name}</button>
                ))}
              </div>
              <p className="text-[11px] text-[#8a95a8] mt-2">Presales y el Documentador trabajan juntos: Presales aporta y revisa el contenido, el Documentador lo redacta.</p>
            </div>
            <div className="text-[11px] text-[#8a95a8]"><span className="text-gray-300 font-semibold">Orión</span> sigue como CEO del despacho.</div>
          </div>
        </section>

        {/* Áreas */}
        <section className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(17rem, 1fr))' }} aria-label="Áreas y agentes">
          {principales.map(area => (
            <div key={area.id} className="rounded-xl p-4" style={{ background: area.color + '0d', border: `1px solid ${area.color}33` }}>
              {bloque(area, 0)}
              {area.subAreas.map(s => bloque(s, 1))}
            </div>
          ))}
          {sueltos.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-[12px] font-black tracking-wide uppercase text-gray-400 mb-1.5">Sin área</h3>
              <div className="space-y-1.5">{sueltos.map(a => <FilaAgente key={a.slug} a={a} sel={sel === a.slug} onSel={() => setSel(sel === a.slug ? null : a.slug)} />)}</div>
            </div>
          )}
        </section>

        <p className="text-[11px] text-[#6b7686] pb-2">
          <span className="text-green-300">Funcional</span>: tiene comportamiento real conectado al portal. <span className="text-gray-300">Ficha</span>: solo figura en el directorio, aún sin función.
        </p>
      </div>
      {elegido && <Detalle a={elegido} nombres={nombres} onCerrar={() => setSel(null)} />}
    </div>
  )
}
