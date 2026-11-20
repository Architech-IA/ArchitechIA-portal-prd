'use client'
import { useState } from 'react'
import { post } from '../proyectos/api'
import { type Organigrama, NIVELES, NIVEL, CANALES, lineas, campo, borde, tarjeta, etiqueta, boton, botonBorde } from './tipos'

// Alta guiada: un agente no se crea sin área, superior, alma, alcance, autonomía y con quién se comunica.
const vacio = { slug: '', nombre: '', rol: '', areaId: '', modelo: '', mision: '', tono: '', valores: '', limites: '', alcance: '', superior: 'orion', autonomia: 'ASISTIDA', herramientas: '' }

export default function AgAlta({ org, alCrear }: { org: Organigrama; alCrear: (slug: string) => void }) {
  const [f, setF] = useState(vacio)
  const [equipo, setEquipo] = useState(true)
  const [clientes, setClientes] = useState(false)
  const [colabora, setColabora] = useState<string[]>([])
  const [canales, setCanales] = useState<string[]>(['PORTAL'])
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const set = (k: keyof typeof vacio, v: string) => setF(x => ({ ...x, [k]: v }))
  const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v])

  async function crear() {
    setEnviando(true); setError(null)
    try {
      const comunicacion = [
        ...(equipo ? [{ tipoDestino: 'ROL', destino: 'EQUIPO', direccion: 'AMBAS', canales }] : []),
        ...(clientes ? [{ tipoDestino: 'ROL', destino: 'CLIENTE', direccion: 'AMBAS', canales, requiereAprobacion: true, nota: 'Todo lo que sale hacia clientes espera aprobación' }] : []),
        ...colabora.map(s => ({ tipoDestino: 'AGENTE', destino: s, direccion: 'AMBAS', canales: [] })),
      ]
      await post('/api/agentes/alta', {
        slug: f.slug, nombre: f.nombre, rol: f.rol, areaId: f.areaId, modelo: f.modelo || undefined,
        alma: { mision: f.mision, tono: f.tono, valores: lineas(f.valores), limites: lineas(f.limites) },
        alcance: f.alcance, superiorSlug: f.superior, autonomia: f.autonomia, herramientas: lineas(f.herramientas), comunicacion,
      })
      setF(vacio); alCrear(f.slug)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear') } finally { setEnviando(false) }
  }

  return (
    <div className="p-4 space-y-3 overflow-y-auto max-w-3xl">
      <h2 className="text-[13px] font-semibold text-gray-100">Nuevo agente</h2>
      <p className="text-[11px] text-[#9aa6b8]">Todo lo marcado es obligatorio: así cada agente nace con identidad, un sitio en el organigrama y reglas claras de con quién habla.</p>
      {error && <p role="alert" className="text-[11px] text-red-300 rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>{error}</p>}
      <section className="rounded-lg p-3 space-y-3" style={tarjeta}>
        <div className="grid sm:grid-cols-3 gap-3">
          <label><span className={etiqueta}>Identificador *</span><input className={campo} style={borde} value={f.slug} onChange={e => set('slug', e.target.value.toLowerCase())} placeholder="soporte-n1" /></label>
          <label><span className={etiqueta}>Nombre *</span><input className={campo} style={borde} value={f.nombre} onChange={e => set('nombre', e.target.value)} /></label>
          <label><span className={etiqueta}>Rol *</span><input className={campo} style={borde} value={f.rol} onChange={e => set('rol', e.target.value)} /></label>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <label><span className={etiqueta}>Área *</span>
            <select className={campo} style={borde} value={f.areaId} onChange={e => set('areaId', e.target.value)}>
              <option value="" style={{ color: '#111' }}>— elige —</option>
              {org.areas.map(a => <option key={a.id} value={a.id} style={{ color: '#111' }}>{a.nombre}</option>)}</select></label>
          <label><span className={etiqueta}>Superior *</span>
            <select className={campo} style={borde} value={f.superior} onChange={e => set('superior', e.target.value)}>
              {org.agentes.map(a => <option key={a.slug} value={a.slug} style={{ color: '#111' }}>{a.nombre}</option>)}</select></label>
          <label><span className={etiqueta}>Modelo (opcional)</span><input className={campo} style={borde} value={f.modelo} onChange={e => set('modelo', e.target.value)} placeholder="opencode-go/…" /></label>
        </div>
        <label><span className={etiqueta}>Misión *</span><textarea className={campo} style={borde} rows={2} value={f.mision} onChange={e => set('mision', e.target.value)} /></label>
        <label><span className={etiqueta}>Forma de ser (tono)</span><textarea className={campo} style={borde} rows={2} value={f.tono} onChange={e => set('tono', e.target.value)} /></label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label><span className={etiqueta}>Valores (uno por línea)</span><textarea className={campo} style={borde} rows={2} value={f.valores} onChange={e => set('valores', e.target.value)} /></label>
          <label><span className={etiqueta}>Límites (uno por línea)</span><textarea className={campo} style={borde} rows={2} value={f.limites} onChange={e => set('limites', e.target.value)} /></label>
        </div>
        <label><span className={etiqueta}>Alcance: de qué es responsable *</span><textarea className={campo} style={borde} rows={3} value={f.alcance} onChange={e => set('alcance', e.target.value)} /></label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label><span className={etiqueta}>Autonomía inicial *</span>
            <select className={campo} style={{ ...borde, color: NIVEL[f.autonomia]?.color }} value={f.autonomia} onChange={e => set('autonomia', e.target.value)}>{NIVELES.map(n => <option key={n} value={n} style={{ color: '#111' }}>{NIVEL[n].txt}</option>)}</select></label>
          <label><span className={etiqueta}>Herramientas (una por línea)</span><textarea className={campo} style={borde} rows={2} value={f.herramientas} onChange={e => set('herramientas', e.target.value)} /></label>
        </div>
      </section>
      <section className="rounded-lg p-3 space-y-2" style={tarjeta}>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-purple-300">Con quién se comunica *</h3>
        <label className="flex items-center gap-2 text-[12px] text-gray-300"><input type="checkbox" checked={equipo} onChange={e => setEquipo(e.target.checked)} />Atiende al equipo interno</label>
        <label className="flex items-center gap-2 text-[12px] text-gray-300"><input type="checkbox" checked={clientes} onChange={e => setClientes(e.target.checked)} />Atiende a clientes (lo que sale espera aprobación)</label>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-300"><span className="text-[#7f8a9c]">Por:</span>{CANALES.map(c => <label key={c} className="flex items-center gap-1"><input type="checkbox" checked={canales.includes(c)} onChange={() => setCanales(alternar(canales, c))} />{c.toLowerCase()}</label>)}</div>
        <div><span className={etiqueta}>Colabora con otros agentes</span>
          <div className="flex flex-wrap gap-x-3 gap-y-1">{org.agentes.map(a => <label key={a.slug} className="flex items-center gap-1 text-[11px] text-gray-300"><input type="checkbox" checked={colabora.includes(a.slug)} onChange={() => setColabora(alternar(colabora, a.slug))} />{a.nombre}</label>)}</div></div>
      </section>
      <button onClick={() => void crear()} disabled={enviando} className={boton} style={botonBorde}>{enviando ? 'Creando…' : 'Crear agente'}</button>
    </div>
  )
}
