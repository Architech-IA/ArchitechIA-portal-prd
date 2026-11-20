'use client'
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api, put, hace } from '../proyectos/api'
import { type AgenteOrg, type FichaRes, type Regla, NIVELES, NIVEL, CANALES, TIPOS_DESTINO, ROLES, DIRECCIONES, lineas, campo, borde, tarjeta, etiqueta, boton, botonBorde } from './tipos'

// Ficha de un agente (alma, alcance, superior, herramientas, autonomía) y su matriz de comunicación. Solo un administrador guarda.

export default function AgFicha({ slug, agentes, alCambiar }: { slug: string; agentes: AgenteOrg[]; alCambiar: () => void }) {
  const [d, setD] = useState<FichaRes | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<'ficha' | 'comunicacion' | null>(null)
  // Formulario de la ficha
  const [mision, setMision] = useState(''); const [tono, setTono] = useState('')
  const [valores, setValores] = useState(''); const [limites, setLimites] = useState('')
  const [alcance, setAlcance] = useState(''); const [superior, setSuperior] = useState('')
  const [herramientas, setHerramientas] = useState(''); const [autonomia, setAutonomia] = useState('ASISTIDA')
  const [porAccion, setPorAccion] = useState<Record<string, string>>({})
  const [reglas, setReglas] = useState<Regla[]>([])

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const r = await api<FichaRes>(`/api/agentes/${slug}/ficha`)
      setD(r)
      const f = r.ficha
      setMision(f?.alma.mision ?? ''); setTono(f?.alma.tono ?? r.agente.personalidad ?? '')
      setValores((f?.alma.valores ?? []).join('\n')); setLimites((f?.alma.limites ?? []).join('\n'))
      setAlcance(f?.alcance ?? ''); setSuperior(f?.superiorSlug ?? '')
      setHerramientas((f?.herramientas ?? []).join('\n')); setAutonomia(f?.autonomia ?? 'ASISTIDA')
      setPorAccion(f?.autonomiaPorAccion ?? {})
      setReglas(r.comunicacion.map(c => ({ ...c, nota: c.nota ?? '' })))
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer la ficha') }
  }, [slug])
  useEffect(() => { setD(null); setAviso(null); void cargar() }, [cargar])

  const tools = lineas(herramientas)

  async function guardarFicha() {
    setGuardando('ficha'); setError(null); setAviso(null)
    try {
      const nivelAccion: Record<string, string> = {}
      for (const t of tools) if (porAccion[t]) nivelAccion[t] = porAccion[t]
      const r = await put<{ version: number }>(`/api/agentes/${slug}/ficha`, {
        alma: { mision, tono, valores: lineas(valores), limites: lineas(limites), ejemplos: d?.ficha?.alma.ejemplos ?? [] },
        alcance, superiorSlug: superior, herramientas: tools, autonomia, autonomiaPorAccion: nivelAccion,
      })
      setAviso(`Ficha guardada (versión ${r.version}).`); await cargar(); alCambiar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setGuardando(null) }
  }

  async function guardarComunicacion() {
    setGuardando('comunicacion'); setError(null); setAviso(null)
    try {
      await put(`/api/agentes/${slug}/comunicacion`, { reglas: reglas.map(r => ({ ...r, nota: r.nota || undefined })) })
      setAviso('Matriz de comunicación guardada.'); await cargar(); alCambiar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setGuardando(null) }
  }

  const cambiarRegla = (i: number, parte: Partial<Regla>) => setReglas(rs => rs.map((r, j) => (j === i ? { ...r, ...parte } : r)))
  const alternarCanal = (i: number, c: string) => cambiarRegla(i, { canales: reglas[i].canales.includes(c) ? reglas[i].canales.filter(x => x !== c) : [...reglas[i].canales, c] })

  if (!d) return <div className="p-6 flex justify-center text-[#7f8a9c]">{error ? <p role="alert" className="text-[11px] text-red-300">{error}</p> : <Loader2 className="animate-spin" size={16} />}</div>

  return (
    <div className="space-y-4 p-4 overflow-y-auto">
      <header>
        <h2 className="text-[14px] font-semibold text-gray-100">{d.agente.nombre}</h2>
        <p className="text-[11px] text-[#9aa6b8]">{d.agente.rol} · {d.agente.area ?? 'Sin área'}{d.ficha ? ` · ficha v${d.ficha.version}${d.ficha.actualizadoPor ? ` (${d.ficha.actualizadoPor})` : ''}` : ' · sin ficha todavía'}</p>
      </header>
      {error && <p role="alert" className="text-[11px] text-red-300 rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>{error}</p>}
      {aviso && <p role="status" className="text-[11px] text-emerald-300 rounded-lg px-3 py-2" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>{aviso}</p>}

      <section className="rounded-lg p-3 space-y-3" style={tarjeta} aria-label="Identidad">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-purple-300">Alma e identidad</h3>
        <label><span className={etiqueta}>Misión (qué existe para hacer)</span><textarea className={campo} style={borde} rows={2} value={mision} onChange={e => setMision(e.target.value)} /></label>
        <label><span className={etiqueta}>Forma de ser (tono)</span><textarea className={campo} style={borde} rows={2} value={tono} onChange={e => setTono(e.target.value)} /></label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label><span className={etiqueta}>Valores (uno por línea)</span><textarea className={campo} style={borde} rows={3} value={valores} onChange={e => setValores(e.target.value)} /></label>
          <label><span className={etiqueta}>Límites que no cruza (uno por línea)</span><textarea className={campo} style={borde} rows={3} value={limites} onChange={e => setLimites(e.target.value)} /></label>
        </div>
        <label><span className={etiqueta}>Alcance: de qué es responsable (y de qué no)</span><textarea className={campo} style={borde} rows={3} value={alcance} onChange={e => setAlcance(e.target.value)} /></label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label><span className={etiqueta}>Superior en el organigrama</span>
            <select className={campo} style={borde} value={superior} onChange={e => setSuperior(e.target.value)}>
              <option value="" style={{ color: '#111' }}>— sin superior —</option>
              {agentes.filter(a => a.slug !== slug).map(a => <option key={a.slug} value={a.slug} style={{ color: '#111' }}>{a.nombre}</option>)}
            </select></label>
          <label><span className={etiqueta}>Nivel de autonomía general</span>
            <select className={campo} style={{ ...borde, color: NIVEL[autonomia]?.color }} value={autonomia} onChange={e => setAutonomia(e.target.value)}>
              {NIVELES.map(n => <option key={n} value={n} style={{ color: '#111' }}>{NIVEL[n].txt}</option>)}
            </select></label>
        </div>
        <label><span className={etiqueta}>Herramientas permitidas (una acción por línea)</span><textarea className={campo} style={borde} rows={3} value={herramientas} onChange={e => setHerramientas(e.target.value)} placeholder="consultar&#10;crear" /></label>
        {tools.length > 0 && (
          <div>
            <span className={etiqueta}>Autonomía por acción (anula la general)</span>
            <ul className="space-y-1">
              {tools.map(t => (
                <li key={t} className="flex items-center justify-between gap-2 text-[11.5px] text-gray-300">
                  <span className="truncate">{t}</span>
                  <select aria-label={`Autonomía de ${t}`} className={campo + ' !w-40'} style={{ ...borde, color: porAccion[t] ? NIVEL[porAccion[t]]?.color : '#9aa6b8' }} value={porAccion[t] ?? ''} onChange={e => setPorAccion(p => ({ ...p, [t]: e.target.value }))}>
                    <option value="" style={{ color: '#111' }}>(la general)</option>
                    {NIVELES.map(n => <option key={n} value={n} style={{ color: '#111' }}>{NIVEL[n].txt}</option>)}
                  </select>
                </li>))}
            </ul>
          </div>)}
        <p className="text-[10.5px] text-[#7f8a9c]">Asistida: nada sale sin aprobación, salvo responderle al equipo. Supervisada: las lecturas salen; lo que cambia algo espera aprobación. Autónoma: sale todo y queda registrado.</p>
        <button onClick={() => void guardarFicha()} disabled={guardando !== null} className={boton} style={botonBorde}>{guardando === 'ficha' ? 'Guardando…' : 'Guardar ficha'}</button>
      </section>

      <section className="rounded-lg p-3 space-y-3" style={tarjeta} aria-label="Comunicación">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-purple-300">Con quién se comunica</h3>
        <p className="text-[10.5px] text-[#7f8a9c]">Sin reglas hacia personas, el agente solo atiende al equipo interno. Con reglas, solo habla con quien aparezca aquí.</p>
        {reglas.length === 0 && <p className="text-[11px] text-[#9aa6b8]">Sin reglas todavía.</p>}
        {reglas.map((r, i) => (
          <div key={i} className="rounded-md p-2 space-y-2" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="grid sm:grid-cols-3 gap-2">
              <label><span className={etiqueta}>Con</span>
                <select className={campo} style={borde} value={r.tipoDestino} onChange={e => cambiarRegla(i, { tipoDestino: e.target.value, destino: e.target.value === 'ROL' ? 'EQUIPO' : '' })}>
                  {TIPOS_DESTINO.map(([k, v]) => <option key={k} value={k} style={{ color: '#111' }}>{v}</option>)}</select></label>
              <label><span className={etiqueta}>Destino</span>
                {r.tipoDestino === 'ROL'
                  ? <select className={campo} style={borde} value={r.destino} onChange={e => cambiarRegla(i, { destino: e.target.value })}>{ROLES.map(x => <option key={x} value={x} style={{ color: '#111' }}>{x}</option>)}</select>
                  : r.tipoDestino === 'AGENTE'
                    ? <select className={campo} style={borde} value={r.destino} onChange={e => cambiarRegla(i, { destino: e.target.value })}><option value="" style={{ color: '#111' }}>— elige —</option>{agentes.filter(a => a.slug !== slug).map(a => <option key={a.slug} value={a.slug} style={{ color: '#111' }}>{a.nombre}</option>)}</select>
                    : <input className={campo} style={borde} value={r.destino} onChange={e => cambiarRegla(i, { destino: e.target.value })} placeholder={r.tipoDestino === 'PERSONA' ? 'id de la persona' : 'id del área o etiqueta'} />}
              </label>
              <label><span className={etiqueta}>Dirección</span>
                <select className={campo} style={borde} value={r.direccion} onChange={e => cambiarRegla(i, { direccion: e.target.value })}>{DIRECCIONES.map(([k, v]) => <option key={k} value={k} style={{ color: '#111' }}>{v}</option>)}</select></label>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-300">
              <span className="text-[#7f8a9c]">Canales (ninguno = todos):</span>
              {CANALES.map(c => <label key={c} className="flex items-center gap-1"><input type="checkbox" checked={r.canales.includes(c)} onChange={() => alternarCanal(i, c)} />{c.toLowerCase()}</label>)}
              <label className="flex items-center gap-1 ml-auto"><input type="checkbox" checked={r.requiereAprobacion} onChange={e => cambiarRegla(i, { requiereAprobacion: e.target.checked })} />Requiere aprobación</label>
              <button type="button" onClick={() => setReglas(rs => rs.filter((_, j) => j !== i))} className="text-red-300 hover:underline">Quitar</button>
            </div>
            <input className={campo} style={borde} value={r.nota ?? ''} onChange={e => cambiarRegla(i, { nota: e.target.value })} placeholder="Nota (para qué existe esta regla)" aria-label="Nota de la regla" />
          </div>))}
        <div className="flex gap-2">
          <button type="button" onClick={() => setReglas(rs => [...rs, { tipoDestino: 'ROL', destino: 'EQUIPO', direccion: 'AMBAS', canales: [], requiereAprobacion: false, nota: '' }])} className={boton} style={botonBorde}>Añadir regla</button>
          <button onClick={() => void guardarComunicacion()} disabled={guardando !== null} className={boton} style={botonBorde}>{guardando === 'comunicacion' ? 'Guardando…' : 'Guardar comunicación'}</button>
        </div>
      </section>

      {d.historial.length > 0 && (
        <section aria-label="Historial"><h3 className={etiqueta}>Historial de la ficha</h3>
          <ul className="text-[11px] text-[#9aa6b8] space-y-0.5">{d.historial.map(h => <li key={h.id}>v{h.version} · {h.por ?? '—'} · {hace(h.creadoEn)}</li>)}</ul>
        </section>)}
    </div>
  )
}
