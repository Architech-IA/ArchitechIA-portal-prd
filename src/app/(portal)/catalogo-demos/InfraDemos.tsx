'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, MoreVertical, RefreshCw, Terminal, Pin, PinOff, ExternalLink, Loader2, Snowflake, Box, X, History } from 'lucide-react'

// Panel de infraestructura de las demos: salud del servidor y, por demo, sus contenedores (app + base) con las acciones de dormir, despertar, reiniciar y ver logs.
// El navegador no habla con Docker: pide al servidor, que valida que seas administrador y que el contenedor sea de una demo.

type Cont = { nombre: string; rol: string; estado: string; detalle: string; ramMb: number }
type DemoI = { id: string; nombre: string; url: string; slug: string; fijada: boolean; estado: 'activa' | 'dormida' | 'parcial'; contenedores: Cont[]; ramMb: number; ultimoAcceso: number | null
  actividad: number; diasInactiva: number; memoriaMb: number | null; memoriaConfigurada: number | null }
type Servidor = { ramTotalMb: number; ramUsadaMb: number; swapTotalMb: number; swapUsadoMb: number; discoTotalGb: number; discoUsadoGb: number }
type Modo = 'apagado' | 'simulacro' | 'activo'
type Estado = { servidor: Servidor; demos: DemoI[]; ahora: number; autoDormir: Modo }
type Muestra = { ts: number; ram: number; swap: number; demos: Record<string, number> }
type Previa = { accion: 'detener' | 'iniciar'; lista: DemoI[]; omitidas: { d: DemoI; motivo: string }[] }
type Evento = { accion: string; ok: boolean; detalle: string | null; createdAt: string; usuario: string | null }

const MODOS: { v: Modo; n: string; d: string }[] = [
  { v: 'apagado', n: 'Apagado', d: 'No hace nada solo.' },
  { v: 'simulacro', n: 'Simulacro', d: 'Solo anota en el historial qué dormiría, sin tocar nada.' },
  { v: 'activo', n: 'Activo', d: 'Duerme solo las demos frías (las fijadas no).' },
]

async function llamar<T = unknown>(ruta: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
  const r = await fetch(ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error || j?.message || 'No se pudo completar la acción')
  return j as T
}

const RANGOS = [{ h: 6, n: '6 h' }, { h: 24, n: '24 h' }, { h: 168, n: '7 días' }, { h: 720, n: '30 días' }]
const fmtGb = (mb: number) => (mb / 1024).toFixed(1).replace('.', ',')

// Línea simple en SVG con ejes mínimos; sin librerías.
function Linea({ series, max, ini, fin }: { series: { n: string; c: string; v: { ts: number; y: number }[] }[]; max: number; ini: number; fin: number }) {
  const W = 640, H = 150, pl = 34, pb = 16
  const x = (t: number) => pl + ((t - ini) / Math.max(1, fin - ini)) * (W - pl - 4)
  const y = (v: number) => H - pb - (v / Math.max(1, max)) * (H - pb - 6)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[150px]" role="img" aria-label="Histórico de memoria del servidor">
      {[0, 0.5, 1].map(f => <g key={f}><line x1={pl} x2={W - 4} y1={y(max * f)} y2={y(max * f)} stroke="#1e2b3f" /><text x={pl - 4} y={y(max * f) + 3} textAnchor="end" fontSize="9" fill="#7f8a9c">{fmtGb(max * f)}</text></g>)}
      {series.map(se => se.v.length > 1 && <polyline key={se.n} fill="none" stroke={se.c} strokeWidth="1.6" points={se.v.map(q => `${x(q.ts).toFixed(1)},${y(q.y).toFixed(1)}`).join(' ')} />)}
    </svg>
  )
}

function HistorialMemoria({ servidor }: { servidor: Servidor | undefined }) {
  const [horas, setHoras] = useState(24)
  const [m, setM] = useState<Muestra[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let vivo = true
    setM(null)
    llamar<{ muestras: Muestra[] }>(`/api/infra/memoria?horas=${horas}`).then(r => { if (vivo) { setM(r.muestras); setErr('') } }).catch(e => { if (vivo) setErr(e instanceof Error ? e.message : 'No se pudo leer el histórico') })
    return () => { vivo = false }
  }, [horas])
  const ini = m && m.length ? m[0].ts : 0, fin = m && m.length ? m[m.length - 1].ts : 1
  const slugs = Array.from(new Set((m ?? []).flatMap(q => Object.keys(q.demos))))
  const filas = slugs.map(sl => {
    const v = (m ?? []).map(q => ({ ts: q.ts, y: q.demos[sl] ?? 0 }))
    const primero = v.find(q => q.y > 0)?.y ?? 0, ultimo = v[v.length - 1]?.y ?? 0
    return { sl, v, ultimo, delta: ultimo - primero, pico: Math.max(0, ...v.map(q => q.y)) }
  }).filter(f => f.pico > 0).sort((a, b) => b.pico - a.pico)
  const maxDemo = Math.max(1, ...filas.map(f => f.pico))
  return (
    <div className="rounded-xl bg-[#0b1220] border border-[#1e2b3f] px-4 py-3 mb-5">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <p className="text-[13px] font-medium">Histórico de memoria</p>
        <span className="text-[11.5px] text-[#7f8a9c]">una muestra cada 10 min</span>
        <span className="ml-auto flex gap-1">{RANGOS.map(r => <button key={r.h} type="button" onClick={() => setHoras(r.h)} className={`px-2 py-0.5 rounded-md text-[12px] border ${horas === r.h ? 'border-cyan-500/50 text-cyan-300 bg-cyan-500/10' : 'border-[#2a3a52] text-[#9aa4b5] hover:bg-white/5'}`}>{r.n}</button>)}</span>
      </div>
      {err && <p className="text-[12.5px] text-red-300">{err}</p>}
      {m === null && !err && <Loader2 size={14} className="animate-spin text-[#7f8a9c] my-4" />}
      {m && m.length < 2 && <p className="text-[12.5px] text-[#7f8a9c] py-4">Aún hay pocas muestras en este rango; el gráfico aparece cuando haya al menos dos (cada 10 minutos).</p>}
      {m && m.length >= 2 && (
        <>
          <div className="flex gap-4 text-[11.5px] text-[#9aa4b5] mt-1"><span><i className="inline-block w-3 h-[3px] bg-cyan-400 align-middle mr-1" />RAM usada</span><span><i className="inline-block w-3 h-[3px] bg-amber-400 align-middle mr-1" />Swap usado</span><span className="ml-auto">GB</span></div>
          <Linea ini={ini} fin={fin} max={Math.max(servidor?.ramTotalMb ?? 0, servidor?.swapTotalMb ?? 0, ...m.map(q => Math.max(q.ram, q.swap)))} series={[{ n: 'RAM', c: '#22d3ee', v: m.map(q => ({ ts: q.ts, y: q.ram })) }, { n: 'Swap', c: '#fbbf24', v: m.map(q => ({ ts: q.ts, y: q.swap })) }]} />
          <p className="text-[12px] text-[#7f8a9c] mt-2 mb-1">Memoria por demo en el rango (barra = pico; flecha = cambio entre la primera y la última muestra)</p>
          <div className="space-y-1">
            {filas.slice(0, 12).map(f => (
              <div key={f.sl} className="flex items-center gap-2 text-[12px]">
                <span className="w-40 truncate text-[#b8c2d3]" title={f.sl}>{f.sl}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-cyan-400/70" style={{ width: `${(f.pico / maxDemo) * 100}%` }} /></div>
                <span className="w-16 text-right tabular-nums">{Math.round(f.ultimo)} MB</span>
                <span className={`w-16 text-right tabular-nums ${f.delta > 20 ? 'text-amber-300' : f.delta < -20 ? 'text-emerald-300' : 'text-[#7f8a9c]'}`}>{f.delta > 20 ? '↑' : f.delta < -20 ? '↓' : '='} {Math.abs(Math.round(f.delta))} MB</span>
              </div>))}
          </div>
        </>)}
    </div>
  )
}

function hace(seg: number | null, ahora: number): string {
  if (seg == null) return 'sin visitas registradas'
  const d = Math.max(0, ahora - seg)
  if (d < 90) return 'hace un momento'
  if (d < 3600) return `hace ${Math.round(d / 60)} min`
  if (d < 86400) return `hace ${Math.round(d / 3600)} h`
  return `hace ${Math.round(d / 86400)} d`
}
const esFria = (x: DemoI, ahora: number) => x.estado === 'activa' && !x.fijada && x.actividad > 0 && ahora - x.actividad > x.diasInactiva * 86400
const ETQ_ACCION: Record<string, string> = { detener: 'Dormir', iniciar: 'Despertar', reiniciar: 'Reiniciar', fijar: 'Fijar encendida', soltar: 'Quitar de fijadas', reglas: 'Cambió las reglas', config: 'Cambió el modo automático', simulacro: 'Simulacro: la habría dormido', 'dormir-auto': 'Dormida automáticamente', 'despertar-visita': 'Despertada por una visita' }

function Medidor({ titulo, valor, total, unidad, aviso }: { titulo: string; valor: number; total: number; unidad: string; aviso?: boolean }) {
  const p = total > 0 ? Math.round((valor / total) * 100) : 0
  const color = p >= 90 ? 'bg-red-400' : p >= 80 ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className="rounded-xl bg-[#0b1220] border border-[#1e2b3f] px-3.5 py-3">
      <p className="text-[11.5px] text-[#7f8a9c]">{titulo}</p>
      <p className="text-[17px] font-semibold mt-0.5">{unidad === 'GB' ? valor : (valor / 1024).toFixed(1).replace('.', ',')} <span className="text-[12px] font-normal text-[#7f8a9c]">/ {unidad === 'GB' ? total : (total / 1024).toFixed(1).replace('.', ',')} GB · {p} %</span></p>
      <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden"><div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, p)}%` }} /></div>
      {aviso && p >= 80 && <p className="text-[11px] text-amber-300 mt-1.5">{p >= 90 ? 'Casi lleno: conviene dormir demos que no se usan.' : 'Va justo: vigila antes de compilar.'}</p>}
    </div>
  )
}

export default function InfraDemos() {
  const [datos, setDatos] = useState<Estado | null>(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState<Record<string, string>>({})
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const [abierta, setAbierta] = useState<string | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ids?: string[] } | null>(null)
  const [logs, setLogs] = useState<{ id: string; contenedor: string; texto: string; cargando: boolean } | null>(null)
  const [hist, setHist] = useState<Evento[] | null>(null)
  const [progreso, setProgreso] = useState('')
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [reglas, setReglas] = useState<{ id: string; dias: string; mem: string } | null>(null)
  const tt = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enCurso = useRef(0)

  const cargar = useCallback(async () => {
    try { setDatos(await llamar<Estado>('/api/infra/demos')); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el estado') }
  }, [])
  useEffect(() => {
    void cargar()
    const t = setInterval(() => { if (enCurso.current === 0 && document.visibilityState === 'visible') void cargar() }, 20000)
    return () => clearInterval(t)
  }, [cargar])
  useEffect(() => {
    if (!menu) return
    const f = () => setMenu(null)
    document.addEventListener('click', f)
    return () => document.removeEventListener('click', f)
  }, [menu])

  function avisar(msg: string, ids?: string[]) {
    if (tt.current) clearTimeout(tt.current)
    setToast({ msg, ids }); tt.current = setTimeout(() => setToast(null), 8000)
  }

  async function ejecutar(x: DemoI, accion: 'detener' | 'iniciar' | 'reiniciar'): Promise<boolean> {
    enCurso.current++
    setOcupado(o => ({ ...o, [x.id]: accion === 'detener' ? 'Durmiendo…' : accion === 'iniciar' ? 'Despertando…' : 'Reiniciando…' }))
    try {
      const r = await llamar<{ mensaje?: string; responde?: boolean }>(`/api/infra/demos/${x.id}/${accion}`, 'POST')
      setError(''); if (accion !== 'detener' && r.responde === false) setError(r.mensaje || 'La demo no responde todavía')
      return true
    } catch (e) { setError(`${x.nombre}: ${e instanceof Error ? e.message : 'no se pudo completar'}`); return false } finally {
      enCurso.current--
      setOcupado(o => { const n = { ...o }; delete n[x.id]; return n })
    }
  }

  async function dormir(x: DemoI) {
    if (await ejecutar(x, 'detener')) { avisar(`${x.nombre} quedó dormida · libera ${Math.round(x.ramMb)} MB`, [x.id]); await cargar() }
  }
  async function despertar(x: DemoI) {
    if (await ejecutar(x, 'iniciar')) { setToast(null); await cargar() }
  }
  async function reiniciar(x: DemoI) {
    if (await ejecutar(x, 'reiniciar')) { avisar(`${x.nombre} se reinició`); await cargar() }
  }
  async function deshacer(ids: string[]) {
    setToast(null)
    const lista = (datos?.demos ?? []).filter(d => ids.includes(d.id))
    for (const d of lista) await ejecutar(d, 'iniciar')
    await cargar()
  }
  async function fijar(x: DemoI) {
    try { await llamar(`/api/infra/demos/${x.id}/fijar`, 'PUT', { fijada: !x.fijada }); avisar(x.fijada ? `${x.nombre} ya puede dormirse` : `${x.nombre} fijada: se queda encendida`); await cargar() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo fijar') }
  }
  async function guardarReglas(x: DemoI) {
    if (!reglas || reglas.id !== x.id) return
    const dias = Number(reglas.dias), mem = reglas.mem.trim() === '' ? null : Number(reglas.mem)
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) { setError('Los días sin visitas deben estar entre 1 y 365'); return }
    if (mem !== null && (!Number.isInteger(mem) || mem < 64 || mem > 4096)) { setError('El tope de memoria debe estar entre 64 y 4096 MB'); return }
    try { await llamar(`/api/infra/demos/${x.id}/reglas`, 'PUT', { dias, memoriaMb: mem }); setReglas(null); setError(''); avisar(`Reglas de ${x.nombre} guardadas`); await cargar() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron guardar las reglas') }
  }
  async function cambiarModo(m: Modo) {
    try { await llamar('/api/infra/config', 'PUT', { autoDormir: m }); avisar(m === 'activo' ? 'Las demos frías se dormirán solas' : m === 'simulacro' ? 'Modo simulacro: solo se anota qué se dormiría' : 'Dormir automático apagado'); await cargar() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el modo') }
  }
  function pedirPrevia(accion: 'detener' | 'iniciar') {
    const elegidas = (datos?.demos ?? []).filter(d => sel[d.id])
    const lista: DemoI[] = [], omitidas: { d: DemoI; motivo: string }[] = []
    for (const d of elegidas) {
      if (accion === 'detener' && d.fijada) omitidas.push({ d, motivo: 'Está fijada encendida' })
      else if (accion === 'detener' && d.estado === 'dormida') omitidas.push({ d, motivo: 'Ya está dormida' })
      else if (accion === 'iniciar' && d.estado === 'activa') omitidas.push({ d, motivo: 'Ya está despierta' })
      else lista.push(d)
    }
    setPrevia({ accion, lista, omitidas })
  }
  async function enBloque(accion: 'detener' | 'iniciar', lista: DemoI[], fijadas: DemoI[] = []) {
    setPrevia(null)
    setSel({})
    const hechas: string[] = []
    for (let i = 0; i < lista.length; i++) {
      setProgreso(`${accion === 'detener' ? 'Durmiendo' : 'Despertando'} ${i + 1} de ${lista.length}…`)
      if (await ejecutar(lista[i], accion)) hechas.push(lista[i].id)
    }
    setProgreso('')
    const lib = (datos?.demos ?? []).filter(d => hechas.includes(d.id)).reduce((a, d) => a + d.ramMb, 0)
    if (accion === 'detener') avisar(`${hechas.length} demos dormidas${lib ? ` · libera ${Math.round(lib)} MB` : ''}${fijadas.length ? ` · ${fijadas.length} fijada${fijadas.length > 1 ? 's' : ''} sin tocar` : ''}`, hechas.length ? hechas : undefined)
    else avisar(`${hechas.length} demos despiertas`)
    await cargar()
  }

  async function verLogs(x: DemoI, contenedor?: string) {
    setAbierta(x.id)
    setLogs({ id: x.id, contenedor: contenedor ?? x.contenedores[0].nombre, texto: '', cargando: true })
    try {
      const r = await llamar<{ texto: string; contenedor: string }>(`/api/infra/demos/${x.id}/logs`, 'POST', { contenedor: contenedor ?? x.contenedores[0].nombre, lineas: 120 })
      setLogs({ id: x.id, contenedor: r.contenedor, texto: r.texto || '(sin salida)', cargando: false })
    } catch (e) { setLogs({ id: x.id, contenedor: contenedor ?? '', texto: e instanceof Error ? e.message : 'No se pudieron leer los logs', cargando: false }) }
  }
  async function abrir(x: DemoI) {
    if (abierta === x.id) { setAbierta(null); setLogs(null); setHist(null); return }
    setAbierta(x.id); setLogs(null); setHist(null)
    try { setHist(await llamar<Evento[]>(`/api/infra/demos/${x.id}/historial`)) } catch { setHist([]) }
  }

  const demos = datos?.demos ?? []
  const ahora = datos?.ahora ?? Math.floor(Date.now() / 1000)
  const marcadas = demos.filter(d => sel[d.id]).length
  const activas = demos.filter(d => d.estado !== 'dormida').length
  const ramDemos = Math.round(demos.reduce((a, d) => a + d.ramMb, 0))
  const frias = demos.filter(d => esFria(d, ahora))
  const sv = datos?.servidor

  return (
    <div className="p-6 max-w-5xl mx-auto text-[#e6e9ef]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-semibold">Infraestructura de demos</h1>
        <button type="button" onClick={() => void cargar()} className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-lg border border-[#2a3a52] text-[#b8c2d3] hover:bg-white/5"><RefreshCw size={13} /> Actualizar</button>
      </div>
      <p className="text-[13px] text-[#8b97ab] mb-5">Cada demo corre en sus propios contenedores. Dormir una demo detiene sus contenedores y libera su memoria; despertarla los vuelve a encender. No se borra nada.</p>

      {error && <p className="mb-4 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-start gap-2"><span className="flex-1">{error}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setError('')}><X size={14} /></button></p>}

      {sv && (
        <div className="grid gap-3 sm:grid-cols-3 mb-3">
          <Medidor titulo="Memoria del servidor" valor={sv.ramUsadaMb} total={sv.ramTotalMb} unidad="MB" aviso />
          <Medidor titulo="Swap" valor={sv.swapUsadoMb} total={sv.swapTotalMb} unidad="MB" aviso />
          <Medidor titulo="Disco" valor={sv.discoUsadoGb} total={sv.discoTotalGb} unidad="GB" aviso />
        </div>)}

      <HistorialMemoria servidor={sv} />

      {datos === null && !error && <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-[#7f8a9c]" size={18} /></div>}

      {datos && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button type="button" onClick={() => setSel(Object.fromEntries(frias.map(d => [d.id, true])))} title="Activas, no fijadas y sin visitas ni arranques durante más días que su regla" className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-lg border border-[#2a3a52] text-[#b8c2d3] hover:bg-white/5"><Snowflake size={13} /> Seleccionar frías ({frias.length})</button>
            <label className="inline-flex items-center gap-2 text-[12.5px] text-[#9aa4b5]" title={MODOS.find(m => m.v === datos.autoDormir)?.d}>Dormir frías solas
              <select value={datos.autoDormir} onChange={e => void cambiarModo(e.target.value as Modo)} className="rounded-lg bg-[#0d1522] border border-[#243247] px-2 py-1 text-[12.5px] text-[#e6e9ef] focus:outline-none focus:border-cyan-500">
                {MODOS.map(m => <option key={m.v} value={m.v}>{m.n}</option>)}
              </select></label>
            <span className="text-[12px] text-[#7f8a9c] ml-auto">{activas} activas · {demos.length - activas} dormidas · las demos usan {ramDemos} MB</span>
          </div>

          {(marcadas > 0 || progreso) && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-3 py-2 text-[13px]">
              <span>{progreso || `${marcadas} seleccionada${marcadas > 1 ? 's' : ''} · libera ${Math.round(demos.filter(d => sel[d.id] && !d.fijada).reduce((a, d) => a + d.ramMb, 0))} MB al dormirlas`}</span>
              {!progreso && (
                <span className="ml-auto flex gap-2">
                  <button type="button" onClick={() => pedirPrevia('detener')} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#2a3a52] hover:bg-white/5"><Pause size={13} /> Dormir</button>
                  <button type="button" onClick={() => pedirPrevia('iniciar')} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#2a3a52] hover:bg-white/5"><Play size={13} /> Despertar</button>
                  <button type="button" onClick={() => setSel({})} className="px-2.5 py-1 rounded-md text-[#9aa4b5] hover:bg-white/5">Quitar selección</button>
                </span>)}
              {progreso && <Loader2 size={14} className="animate-spin ml-auto" />}
            </div>)}

          {previa && (() => {
            const { accion, lista, omitidas } = previa
            const mb = lista.reduce((a, d) => a + d.ramMb, 0)
            const activasRam = demos.filter(d => d.estado !== 'dormida' && d.ramMb > 0)
            const prom = activasRam.length ? activasRam.reduce((a, d) => a + d.ramMb, 0) / activasRam.length : 150
            const delta = accion === 'detener' ? -mb : Math.round(lista.length * prom)
            const total = sv?.ramTotalMb ?? 0, usada = sv?.ramUsadaMb ?? 0, swap = sv?.swapUsadoMb ?? 0, swapT = sv?.swapTotalMb ?? 0
            const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : 0)
            const despues = Math.max(0, usada + delta)
            const peligro = accion === 'iniciar' && (pct(despues, total) >= 90 || pct(swap, swapT) >= 90)
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Vista previa de la acción">
                <div className="w-full max-w-md rounded-2xl bg-[#0b1220] border border-[#243247] p-5 shadow-2xl">
                  <h2 className="text-[15px] font-semibold mb-1">{accion === 'detener' ? 'Dormir' : 'Despertar'} {lista.length} demo{lista.length === 1 ? '' : 's'}</h2>
                  <p className="text-[12.5px] text-[#8b97ab] mb-3">{accion === 'detener' ? 'Se detienen sus contenedores; no se borra nada.' : 'Se encienden sus contenedores; cada una tarda unos segundos.'}</p>
                  {lista.length > 0 && <ul className="max-h-40 overflow-auto rounded-lg border border-[#1e2b3f] divide-y divide-[#1e2b3f] mb-3">{lista.map(d => <li key={d.id} className="flex justify-between px-3 py-1.5 text-[12.5px]"><span className="truncate">{d.nombre}</span><span className="text-[#7f8a9c] tabular-nums">{accion === 'detener' ? `-${Math.round(d.ramMb)} MB` : `~+${Math.round(prom)} MB`}</span></li>)}</ul>}
                  {omitidas.length > 0 && <div className="mb-3 text-[12px] text-[#9aa4b5]"><p className="mb-1">No se tocan ({omitidas.length}):</p><ul className="space-y-0.5">{omitidas.map(o => <li key={o.d.id}>{o.d.nombre} <span className="text-[#6b7789]">· {o.motivo}</span></li>)}</ul></div>}
                  <div className="rounded-lg bg-white/5 px-3 py-2 text-[12.5px] mb-3">
                    <p>Memoria del servidor: <b>{fmtGb(usada)} GB</b> ({pct(usada, total)} %) → <b>{fmtGb(despues)} GB</b> ({pct(despues, total)} %){accion === 'iniciar' ? ' · estimado' : ''}</p>
                    <p className="text-[#7f8a9c] mt-0.5">Swap hoy: {pct(swap, swapT)} %{accion === 'detener' ? '. El swap solo baja con el tiempo, no al instante.' : ''}</p>
                  </div>
                  {peligro && <p className="text-[12.5px] text-amber-300 mb-3">El servidor quedaría muy justo. Conviene dormir otras demos antes de despertar estas.</p>}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setPrevia(null)} className="px-3 py-1.5 rounded-lg text-[13px] text-[#9aa4b5] hover:bg-white/5">Cancelar</button>
                    <button type="button" disabled={lista.length === 0} onClick={() => void enBloque(accion, lista, accion === 'detener' ? omitidas.filter(o => o.motivo.startsWith('Está fijada')).map(o => o.d) : [])} className="px-3 py-1.5 rounded-lg text-[13px] border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-40">{accion === 'detener' ? 'Dormir' : 'Despertar'} {lista.length}</button>
                  </div>
                </div>
              </div>)
          })()}

          {demos.length === 0 && <p className="py-10 text-center text-[13px] text-[#7f8a9c]">No hay demos desplegadas con contenedores.</p>}

          <div className="rounded-xl border border-[#1e2b3f] overflow-visible bg-[#0b1220]">
            {demos.map(x => {
              const pend = ocupado[x.id]
              const fria = esFria(x, ahora)
              return (
                <div key={x.id} className="border-b border-[#1e2b3f] last:border-b-0">
                  <div className={`relative flex flex-wrap items-center gap-3 px-4 py-3 ${sel[x.id] ? 'bg-cyan-500/5' : ''}`}>
                    <input type="checkbox" checked={!!sel[x.id]} onChange={e => setSel(s => ({ ...s, [x.id]: e.target.checked }))} aria-label={`Seleccionar ${x.nombre}`} />
                    <button type="button" onClick={() => void abrir(x)} className="flex-1 min-w-[200px] text-left">
                      <p className="text-[14px] font-medium flex items-center gap-1.5">{x.nombre}{x.fijada && <Pin size={13} className="text-cyan-300" aria-label="Fijada encendida" />}</p>
                      <p className="text-[12px] text-[#7f8a9c] truncate">{x.slug}.demos.architechia.co</p>
                    </button>
                    <span className={`text-[11.5px] px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${pend ? 'border-amber-500/30 text-amber-300 bg-amber-500/10' : x.estado === 'activa' ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' : x.estado === 'parcial' ? 'border-amber-500/30 text-amber-300 bg-amber-500/10' : 'border-[#2a3a52] text-[#8b97ab]'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${pend ? 'bg-amber-300 animate-pulse' : x.estado === 'activa' ? 'bg-emerald-300' : x.estado === 'parcial' ? 'bg-amber-300' : 'bg-[#6b7789]'}`} />
                      {pend ? pend.replace('…', '') : x.estado === 'activa' ? 'Activa' : x.estado === 'parcial' ? 'Parcial' : 'Dormida'}</span>
                    <div className="w-[104px]">
                      <p className="text-[12px]">{Math.round(x.ramMb)} MB <span className="text-[#7f8a9c]">· {x.contenedores.length} cont.</span></p>
                      <div className="h-1 rounded-full bg-white/10 mt-1 overflow-hidden"><div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.min(100, x.ramMb / 3)}%` }} /></div>
                    </div>
                    <p className={`w-[120px] text-[12px] ${fria ? 'text-amber-300' : 'text-[#7f8a9c]'}`}>{hace(x.ultimoAcceso, ahora)}</p>
                    {pend
                      ? <button type="button" className="w-[116px] inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-[#2a3a52] text-[12.5px] text-[#8b97ab]"><Loader2 size={13} className="animate-spin" /> Espere</button>
                      : x.estado === 'dormida'
                        ? <button type="button" onClick={() => void despertar(x)} className="w-[116px] inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-cyan-500/40 text-cyan-300 text-[12.5px] hover:bg-cyan-500/10"><Play size={13} /> Despertar</button>
                        : <button type="button" onClick={() => void dormir(x)} className="w-[116px] inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-[#2a3a52] text-[#cbd3e0] text-[12.5px] hover:bg-white/5"><Pause size={13} /> Dormir</button>}
                    <div className="relative">
                      <button type="button" aria-label={`Más acciones de ${x.nombre}`} onClick={e => { e.stopPropagation(); setMenu(m => (m === x.id ? null : x.id)) }} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[#9aa4b5] hover:bg-white/5"><MoreVertical size={16} /></button>
                      {menu === x.id && (
                        <div className="absolute right-0 top-9 z-20 w-52 rounded-lg border border-[#2a3a52] bg-[#0d1522] p-1 shadow-xl" onClick={e => e.stopPropagation()}>
                          <button type="button" disabled={!!pend} onClick={() => { setMenu(null); void reiniciar(x) }} className="w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] hover:bg-white/5 text-left"><RefreshCw size={14} /> Reiniciar</button>
                          <button type="button" onClick={() => { setMenu(null); void verLogs(x) }} className="w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] hover:bg-white/5 text-left"><Terminal size={14} /> Ver logs</button>
                          <button type="button" onClick={() => { setMenu(null); void fijar(x) }} className="w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] hover:bg-white/5 text-left">{x.fijada ? <PinOff size={14} /> : <Pin size={14} />} {x.fijada ? 'Quitar de fijadas' : 'Fijar encendida'}</button>
                          <a href={x.url} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(null)} className="w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] hover:bg-white/5"><ExternalLink size={14} /> Abrir demo</a>
                        </div>)}
                    </div>
                  </div>

                  {abierta === x.id && (
                    <div className="px-4 pb-4 pl-11 bg-[#0a101b]">
                      <div className="grid gap-4 sm:grid-cols-2 pt-3">
                        <div>
                          <p className="text-[11.5px] text-[#7f8a9c] mb-1.5">Contenedores</p>
                          {x.contenedores.map(c => (
                            <div key={c.nombre} className="flex items-center gap-2 py-1.5 border-b border-[#1e2b3f] text-[12.5px]">
                              <Box size={13} className="text-[#7f8a9c]" /><span className="flex-1 truncate">{c.rol === 'app' ? 'Aplicación' : 'Base de datos'}</span>
                              <span className={c.estado === 'running' ? 'text-emerald-300' : 'text-[#8b97ab]'}>{c.estado === 'running' ? `${Math.round(c.ramMb)} MB` : 'detenido'}</span>
                              <button type="button" onClick={() => void verLogs(x, c.nombre)} className="text-[11.5px] text-cyan-300 hover:underline">logs</button>
                            </div>))}
                        </div>
                        <div>
                          <p className="text-[11.5px] text-[#7f8a9c] mb-1.5 flex items-center gap-1.5"><History size={12} /> Últimas acciones</p>
                          {hist === null && <Loader2 size={13} className="animate-spin text-[#7f8a9c]" />}
                          {hist && hist.length === 0 && <p className="text-[12.5px] text-[#7f8a9c]">Aún no hay acciones registradas.</p>}
                          {hist && hist.slice(0, 5).map((h, i) => (
                            <p key={i} className="text-[12.5px] py-1 border-b border-[#1e2b3f]"><span className={h.ok ? '' : 'text-red-300'}>{ETQ_ACCION[h.accion] ?? h.accion}{h.ok ? '' : ' (falló)'}</span> <span className="text-[#7f8a9c]">· {h.usuario ?? 'alguien'} · {new Date(h.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span></p>))}
                        </div>
                      </div>
                                            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
                        <label className="text-[11.5px] text-[#7f8a9c]">Dormir tras (días sin visitas)
                          <input type="number" min={1} max={365} value={reglas?.id === x.id ? reglas.dias : String(x.diasInactiva)} onChange={e => setReglas({ id: x.id, dias: e.target.value, mem: reglas?.id === x.id ? reglas.mem : (x.memoriaConfigurada?.toString() ?? '') })} className="mt-1 w-full rounded-lg bg-[#0d1522] border border-[#243247] px-2.5 py-1.5 text-[13px] text-[#e6e9ef] focus:outline-none focus:border-cyan-500" /></label>
                        <label className="text-[11.5px] text-[#7f8a9c]">Tope de memoria de la app (MB){x.memoriaMb ? ` · hoy ${x.memoriaMb}` : ' · sin tope'}
                          <input type="number" min={64} max={4096} placeholder="512 por defecto" value={reglas?.id === x.id ? reglas.mem : (x.memoriaConfigurada?.toString() ?? '')} onChange={e => setReglas({ id: x.id, dias: reglas?.id === x.id ? reglas.dias : String(x.diasInactiva), mem: e.target.value })} className="mt-1 w-full rounded-lg bg-[#0d1522] border border-[#243247] px-2.5 py-1.5 text-[13px] text-[#e6e9ef] placeholder-[#5b6678] focus:outline-none focus:border-cyan-500" /></label>
                        <button type="button" onClick={() => void guardarReglas(x)} className={`h-[34px] px-3 rounded-lg text-[12.5px] border ${reglas?.id === x.id ? 'border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10' : 'border-[#2a3a52] text-[#6b7789]'}`}>Guardar reglas</button>
                      </div>
                      {logs && logs.id === x.id && (
                        <div className="mt-3">
                          <div className="flex items-center gap-2 mb-1.5"><p className="text-[11.5px] text-[#7f8a9c]">Logs de {logs.contenedor}</p><button type="button" aria-label="Recargar logs" onClick={() => void verLogs(x, logs.contenedor)} className="text-[#9aa4b5] hover:text-white"><RefreshCw size={12} /></button><button type="button" aria-label="Cerrar logs" onClick={() => setLogs(null)} className="text-[#9aa4b5] hover:text-white ml-auto"><X size={13} /></button></div>
                          <pre className="max-h-64 overflow-auto rounded-lg bg-[#05080f] border border-[#1e2b3f] p-3 text-[11px] leading-relaxed text-[#b8c2d3] whitespace-pre-wrap break-all">{logs.cargando ? 'Leyendo…' : logs.texto}</pre>
                        </div>)}
                    </div>)}
                </div>)
            })}
          </div>
        </>)}

      {toast && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-[#16233a] border border-[#2a3a52] px-4 py-2.5 text-[13px]">
          <span className="flex-1">{toast.msg}</span>
          {toast.ids && <button type="button" onClick={() => void deshacer(toast.ids!)} className="px-2.5 py-1 rounded-md border border-[#2f4666] hover:bg-white/5">Deshacer</button>}
          <button type="button" aria-label="Cerrar" onClick={() => setToast(null)} className="text-[#9aa4b5] hover:text-white"><X size={14} /></button>
        </div>)}
      <div className="h-32" />
    </div>
  )
}
