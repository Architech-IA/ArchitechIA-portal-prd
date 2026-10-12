'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, Users, Target, Loader2, Search } from 'lucide-react'
import { api, put, ErrorApi } from './api'

// Ficha del cliente dentro del proyecto: la empresa (se reutiliza entre proyectos), sus personas por papel y lo propio de la oportunidad.
// La fase 1 exige 11 datos; los valores de relleno (p. ej. unknow@unknow.com) no cuentan.

interface Persona { nombre: string; cargo: string; correo: string; telefono: string }
interface Falta { campo: string; etiqueta: string; motivo: string }
interface FichaApi {
  existe: boolean
  cliente: { id: string; nombre: string; razonSocial: string | null; nit: string | null; sector: string | null; tamano: string | null; ciudad: string | null; pais: string | null; sitioWeb: string | null } | null
  contactos: Record<'principal' | 'decisor' | 'representante' | 'firmante', { nombre: string; cargo: string | null; correo: string | null; telefono: string | null } | null>
  oportunidad: { resumen: string | null; fuente: string | null; valor: number | null; presupuesto: number | null; responsableId: string | null; responsableNombre: string | null }
  completitud: { ok: number; total: number; faltan: Falta[]; roles: string[] }
}
interface Form {
  nombre: string; razonSocial: string; nit: string; sector: string; tamano: string; ciudad: string; pais: string; sitioWeb: string
  principal: Persona; decisorAparte: boolean; decisor: Persona; representante: Persona; firmante: Persona
  resumen: string; fuente: string; valor: string; presupuesto: string; responsableId: string
}
interface Usuario { id: string; name: string }
const VACIA: Persona = { nombre: '', cargo: '', correo: '', telefono: '' }
const FUENTES = ['Referido', 'Sitio web', 'LinkedIn', 'Evento', 'Llamada en frío', 'Alianza', 'Cliente existente', 'Otro']
const limpio = (t: string | null | undefined) => (t && !/^sin especificar$/i.test(t.trim()) ? t : '')
const persona = (p: FichaApi['contactos']['principal']): Persona => (p ? { nombre: p.nombre ?? '', cargo: p.cargo ?? '', correo: p.correo ?? '', telefono: p.telefono ?? '' } : { ...VACIA })
const num = (t: string) => { const d = t.replace(/[^\d]/g, ''); return d ? Number(d) : null }
const miles = (n: number | null | undefined) => (n ? Math.round(n).toLocaleString('es-CO') : '')
// Mismos valores que editInputCls / editLabelCls del formulario «Editar Lead»
const campo = 'w-full outline-none focus:!border-orange-400/50'
const etiq = 'block text-[11px] font-semibold text-[#64748b] uppercase tracking-[0.06em] mb-1.5 mt-3'
const BASE: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#f1f5f9', padding: '8px 12px', fontSize: 11 }
const OPCION: React.CSSProperties = { background: '#0f172a' }

function aForm(f: FichaApi): Form {
  const c = f.cliente
  return {
    nombre: c?.nombre ?? '', razonSocial: c?.razonSocial ?? '', nit: c?.nit ?? '', sector: limpio(c?.sector), tamano: c?.tamano ?? '', ciudad: c?.ciudad ?? '', pais: limpio(c?.pais), sitioWeb: c?.sitioWeb ?? '',
    principal: persona(f.contactos.principal), decisorAparte: !!f.contactos.decisor, decisor: persona(f.contactos.decisor), representante: persona(f.contactos.representante), firmante: persona(f.contactos.firmante),
    resumen: f.oportunidad.resumen ?? '', fuente: f.oportunidad.fuente ?? '', valor: miles(f.oportunidad.valor), presupuesto: miles(f.oportunidad.presupuesto), responsableId: f.oportunidad.responsableId ?? '',
  }
}

export default function FichaCliente({ proyectoId, onCambio, onCerrar }: { proyectoId: string; onCambio?: () => void; onCerrar?: () => void }) {
  const [ficha, setFicha] = useState<FichaApi | null>(null)
  const [f, setF] = useState<Form | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [error, setError] = useState('')
  const [existente, setExistente] = useState<{ id: string; nombre: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<{ id: string; nombre: string; razonSocial: string | null; nit: string | null }[]>([])
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cargar = useCallback(async () => {
    try { const d = await api<FichaApi>(`/api/proyectos/${proyectoId}/cliente`); setFicha(d); setF(aForm(d)); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la ficha') }
  }, [proyectoId])
  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => { api<Usuario[]>('/api/users').then(u => setUsuarios(Array.isArray(u) ? u : [])).catch(() => setUsuarios([])) }, [])

  function buscar(texto: string) {
    setQ(texto)
    if (temporizador.current) clearTimeout(temporizador.current)
    if (texto.trim().length < 2) { setResultados([]); return }
    temporizador.current = setTimeout(async () => {
      setBuscando(true)
      try { setResultados(await api(`/api/fases/clientes?q=${encodeURIComponent(texto.trim())}`)) } catch { setResultados([]) } finally { setBuscando(false) }
    }, 300)
  }

  async function enviar(cuerpo: Record<string, unknown>, mensaje: string) {
    setGuardando(true); setError(''); setAviso(''); setExistente(null)
    try {
      const d = await put<FichaApi>(`/api/proyectos/${proyectoId}/cliente`, cuerpo)
      setFicha(d); setF(aForm(d)); setAviso(mensaje); setResultados([]); setQ(''); onCambio?.()
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 409 && e.data?.existente) setExistente(e.data.existente as { id: string; nombre: string })
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally { setGuardando(false) }
  }

  function guardar() {
    if (!f) return
    const p = (x: Persona) => (x.nombre.trim() || x.cargo.trim() || x.correo.trim() || x.telefono.trim() ? x : null)
    void enviar({
      cliente: { nombre: f.nombre, razonSocial: f.razonSocial, nit: f.nit, sector: f.sector, tamano: f.tamano, ciudad: f.ciudad, pais: f.pais, sitioWeb: f.sitioWeb },
      contactos: { principal: p(f.principal) ?? { ...VACIA }, decisor: f.decisorAparte ? f.decisor : null, representante: p(f.representante), firmante: p(f.firmante) },
      oportunidad: { resumen: f.resumen, fuente: f.fuente, valor: num(f.valor), presupuesto: num(f.presupuesto), responsableId: f.responsableId || undefined },
    }, 'Ficha guardada')
  }

  if (!f || !ficha) return error ? <p className="text-[11px] text-red-300">{error}</p> : <div className="flex justify-center py-6 text-[#7f8a9c]"><Loader2 size={14} className="animate-spin" /></div>
  const faltan = new Map(ficha.completitud.faltan.map(x => [x.campo, x]))
  const aj = (p: Partial<Form>) => setF({ ...f, ...p })
  const borde = (c: string): React.CSSProperties => ({ ...BASE, borderColor: faltan.has(c) ? 'rgba(245,158,11,0.7)' : 'rgba(255,255,255,0.08)' })
  const aviso1 = (c: string) => (faltan.has(c) ? <p className="text-[10px] text-amber-300 mt-0.5">{faltan.get(c)?.motivo}</p> : null)
  const persona_ = (clave: 'principal' | 'decisor' | 'representante' | 'firmante', p: Persona, marca?: string) => (
    <>
      <label className={etiq}>Nombre</label><input value={p.nombre} onChange={e => aj({ [clave]: { ...p, nombre: e.target.value } } as Partial<Form>)} className={campo} style={marca ? borde(marca) : borde('')} />
      <label className={etiq}>Cargo</label><input value={p.cargo} onChange={e => aj({ [clave]: { ...p, cargo: e.target.value } } as Partial<Form>)} className={campo} style={borde('')} />
      <label className={etiq}>Correo</label><input value={p.correo} onChange={e => aj({ [clave]: { ...p, correo: e.target.value } } as Partial<Form>)} className={campo} style={borde('')} />
      <label className={etiq}>Teléfono</label><input value={p.telefono} onChange={e => aj({ [clave]: { ...p, telefono: e.target.value } } as Partial<Form>)} className={campo} style={borde('')} />
    </>)
  const titulo = (I: typeof Building2, t: string) => <div className="flex items-center gap-2 text-[13px] font-bold text-[#f1f5f9] pb-2 border-b border-white/10"><I size={14} className="text-orange-400" />{t}</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] text-gray-200 font-medium">{ficha.completitud.ok} de {ficha.completitud.total} datos obligatorios</span>
        <div className="flex-1 min-w-[80px] h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full" style={{ width: `${(ficha.completitud.ok / ficha.completitud.total) * 100}%`, background: ficha.completitud.ok === ficha.completitud.total ? '#10b981' : 'linear-gradient(90deg,#f97316,#ea580c)' }} /></div>
      </div>

      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1"><Search size={12} className="absolute left-2.5 top-[11px] text-[#64748b]" />
            <input value={q} onChange={e => buscar(e.target.value)} placeholder={ficha.existe ? 'Cambiar por otra empresa existente (nombre o NIT)…' : 'Buscar una empresa existente por nombre o NIT…'} className={campo} style={{ ...borde(''), paddingLeft: 28 }} /></div>
          {buscando && <Loader2 size={12} className="animate-spin text-[#7f8a9c]" />}
          <button onClick={() => { if (window.confirm('Se crea una empresa nueva para este proyecto. ¿Continuar?')) void enviar({ nueva: true, cliente: { nombre: f.nombre || 'Nueva empresa' } }, 'Empresa nueva creada: completa sus datos') }} disabled={guardando}
            style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#94a3b8', fontSize: 11 }} className="flex-shrink-0 hover:text-white">Crear nueva</button>
        </div>
        {resultados.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg py-1" style={{ background: '#14142b', border: '1px solid rgba(255,255,255,0.12)' }}>
            {resultados.map(r => (
              <button key={r.id} onClick={() => void enviar({ clienteId: r.id }, `Empresa «${r.nombre}» vinculada al proyecto`)} className="w-full text-left px-3 py-1.5 text-[12px] text-gray-200 hover:bg-white/5">
                {r.nombre}<span className="text-[10px] text-[#7f8a9c]"> {r.razonSocial ? `· ${r.razonSocial}` : ''}{r.nit ? ` · NIT ${r.nit}` : ''}</span></button>))}
          </div>)}
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <div>
          {titulo(Building2, 'Empresa')}
          <label className={etiq}>Nombre comercial</label><input value={f.nombre} onChange={e => aj({ nombre: e.target.value })} className={campo} style={borde('nombre')} />{aviso1('nombre')}
          <label className={etiq}>Razón social</label><input value={f.razonSocial} onChange={e => aj({ razonSocial: e.target.value })} className={campo} style={borde('razonSocial')} />{aviso1('razonSocial')}
          <label className={etiq}>NIT</label><input value={f.nit} onChange={e => aj({ nit: e.target.value })} placeholder="900.123.456-7" className={campo} style={borde('nit')} />{aviso1('nit')}
          <label className={etiq}>Sector</label><input value={f.sector} onChange={e => aj({ sector: e.target.value })} className={campo} style={borde('sector')} />{aviso1('sector')}
          <label className={etiq}>Ciudad</label><input value={f.ciudad} onChange={e => aj({ ciudad: e.target.value })} className={campo} style={borde('ciudad')} />
          <label className={etiq}>País</label><input value={f.pais} onChange={e => aj({ pais: e.target.value })} className={campo} style={borde('ciudad')} />{aviso1('ciudad')}
          <label className={etiq}>Tamaño (opcional)</label><input value={f.tamano} onChange={e => aj({ tamano: e.target.value })} placeholder="Ej. 50 a 200 empleados" className={campo} style={borde('')} />
          <label className={etiq}>Sitio web (opcional)</label><input value={f.sitioWeb} onChange={e => aj({ sitioWeb: e.target.value })} placeholder="https://" className={campo} style={borde('')} />
        </div>

        <div>
          {titulo(Users, 'Personas')}
          <p className="text-[10px] text-[#7f8a9c] mt-2">Contacto principal</p>
          {persona_('principal', f.principal, 'principal')}{aviso1('principal')}
          <label className="flex items-center gap-1.5 text-[11px] text-gray-300 mt-3 cursor-pointer"><input type="checkbox" checked={f.decisorAparte} onChange={e => aj({ decisorAparte: e.target.checked })} className="accent-indigo-500" />Decide otra persona</label>
          {f.decisorAparte && <div className="mt-1 pl-2 border-l border-white/10">{persona_('decisor', f.decisor, 'decisor')}{aviso1('decisor')}</div>}
          <details className="mt-3"><summary className="text-[11px] text-indigo-300 cursor-pointer">Representante legal (se pide en la negociación)</summary><div className="pl-2 border-l border-white/10 mt-1">{persona_('representante', f.representante)}</div></details>
          <details className="mt-2"><summary className="text-[11px] text-indigo-300 cursor-pointer">Quién firma la aceptación y el cierre</summary><div className="pl-2 border-l border-white/10 mt-1">{persona_('firmante', f.firmante)}</div></details>
        </div>

        <div>
          {titulo(Target, 'Oportunidad')}
          <label className={etiq}>Qué quiere resolver</label><textarea value={f.resumen} onChange={e => aj({ resumen: e.target.value })} rows={4} className={campo} style={borde('resumen')} />{aviso1('resumen')}
          <label className={etiq}>Fuente</label>
          <select value={f.fuente} onChange={e => aj({ fuente: e.target.value })} className={campo} style={borde('fuente')}><option value="" style={OPCION}>Elige…</option>{[...new Set([...(f.fuente ? [f.fuente] : []), ...FUENTES])].map(x => <option key={x} value={x} style={OPCION}>{x}</option>)}</select>{aviso1('fuente')}
          <label className={etiq}>Valor estimado (COP)</label><input value={f.valor} onChange={e => aj({ valor: miles(num(e.target.value)) })} className={campo} style={borde('valor')} />{aviso1('valor')}
          <label className={etiq}>Responsable</label>
          <select value={f.responsableId} onChange={e => aj({ responsableId: e.target.value })} className={campo} style={borde('responsable')}>
            <option value="" style={OPCION}>{ficha.oportunidad.responsableNombre ? `${ficha.oportunidad.responsableNombre} (actual)` : 'Elige…'}</option>{usuarios.map(u => <option key={u.id} value={u.id} style={OPCION}>{u.name}</option>)}</select>{aviso1('responsable')}
          <label className={etiq}>Presupuesto del cliente (opcional)</label><input value={f.presupuesto} onChange={e => aj({ presupuesto: miles(num(e.target.value)) })} placeholder="COP" className={campo} style={borde('')} />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-white/10">
        <p className="text-[11px] flex-1">
          {error ? <span className="text-red-300">{error}{existente && <> <button onClick={() => void enviar({ clienteId: existente.id }, `Empresa «${existente.nombre}» vinculada al proyecto`)} className="underline ml-1">Usar «{existente.nombre}»</button></>}</span>
            : aviso ? <span className="text-emerald-300">{aviso}</span> : <span className="text-[#7f8a9c]">Se guarda en el proyecto. Si la empresa ya existe, se reutiliza.</span>}
        </p>
        {onCerrar && <button onClick={onCerrar} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#94a3b8', fontSize: 11 }} className="hover:text-white">Cancelar</button>}
        <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 disabled:opacity-60" style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 11 }}>
          {guardando && <Loader2 size={13} className="animate-spin" />}Guardar ficha</button>
      </div>
    </div>
  )
}
