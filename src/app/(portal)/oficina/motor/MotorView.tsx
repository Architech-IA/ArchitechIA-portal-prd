'use client'

import { useCallback, useEffect, useState } from 'react'
import NextLink from 'next/link'
import { Loader2, RefreshCw, Check, AlertTriangle, Bot, UserCheck, Gauge, Cpu, Server } from 'lucide-react'
import Link from '@/lib/BacklogLink'
import { api, post, hace } from '../proyectos/api'

// Oficina > Motor — portada del motor agéntico. Junta en una sola pantalla lo que antes estaba repartido:
// qué proyectos hay y en qué fase, qué puertas esperan a una persona, qué hacen los agentes y cuánto cuesta.
// Es de lectura; las acciones viven en cada proyecto (solo se puede aprobar una puerta ya completa).

interface Puerta { ok: number; total: number; lista: boolean; aprobador: string; tipo: 'NORMAL' | 'RESULTADO' }
interface Tareas { total: number; hechas: number; enCurso: number; fallidas: number; bloqueadas: number }
interface FilaCartera {
  id: string; nombre: string; cliente: string | null; codigo: string | null; estadoMotor: 'EN_CURSO' | 'CERRADO_PERDIDO' | 'COMPLETADO'
  faseNumero: number; faseNombre: string; bloque: 'PREVENTA' | 'EJECUCION'; totalFases: number; puerta: Puerta; enFaseDesde: string | null; tareas: Tareas | null
}
interface Aprobacion { id: string; nombre: string; faseNombre: string; faseNumero: number; aprobador: string; tipo: 'NORMAL' | 'RESULTADO'; ok: number; total: number; lista: boolean; enFaseDesde: string | null }
interface Tarea { id: string; taskCode: string | null; title: string; solucionId: string | null; solucion: string | null; desde?: string | null; status?: string; updatedAt?: string }
interface Atascada { id: string; backlogItemId: string; taskCode: string | null; title: string | null; startedAt: string }
interface Resumen {
  puedeAprobar: boolean
  totales: { proyectos: number; enCurso: number; porAprobar: number; sinMotor: number; corriendo: number; problemas: number }
  cartera: FilaCartera[]; aprobaciones: Aprobacion[]
  ejecucion: { corriendo: Tarea[]; problemas: Tarea[]; atascadas: Atascada[]; atascadaHoras: number; harness: { ok: boolean; colas: Record<string, number> | null } }
  costo: { ejecuciones: number; conUso: number; tokens: number; entrada: number; salida: number; porProyecto: { id: string; nombre: string; tareas: number; tokens: number }[] }
}

const APROBADOR: Record<string, string> = {
  COMERCIAL: 'Comercial', LIDER_PREVENTA: 'Líder de preventa', LIDER_TECNICO: 'Líder técnico', DIRECCION: 'Dirección', LIDER_PROYECTO: 'Líder de proyecto', CLIENTE: 'Cliente',
}
const n = (x: number) => x.toLocaleString('es-CO')
const miles = (x: number) => (x >= 1_000_000 ? `${(x / 1_000_000).toFixed(1)} M` : x >= 1000 ? `${Math.round(x / 1000)} k` : String(x))
const urlProyecto = (id: string) => `/oficina?view=proyectos&p=${id}`

function Tarjeta({ titulo, icono: Icono, derecha, children }: { titulo: string; icono: typeof Gauge; derecha?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
        <Icono size={13} className="text-indigo-300" /><h3 className="text-[12px] font-semibold text-gray-100">{titulo}</h3><span className="flex-1" />{derecha}
      </header>
      <div>{children}</div>
    </section>)
}

function Cifra({ valor, etiqueta, tono }: { valor: number; etiqueta: string; tono?: 'ok' | 'aviso' | 'mal' }) {
  const color = tono === 'mal' && valor > 0 ? '#fca5a5' : tono === 'aviso' && valor > 0 ? '#fcd34d' : tono === 'ok' && valor > 0 ? '#6ee7b7' : '#e5e7eb'
  return (
    <div className="rounded-xl px-4 py-2.5 min-w-[110px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[22px] font-bold leading-none" style={{ color }}>{n(valor)}</p>
      <p className="text-[10px] text-[#7f8a9c] mt-1">{etiqueta}</p>
    </div>)
}

export default function MotorView() {
  const [d, setD] = useState<Resumen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [aprobando, setAprobando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try { setD(await api<Resumen>('/api/motor/resumen')); setError(null) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el motor') } finally { setCargando(false) }
  }, [])

  useEffect(() => {
    void cargar()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void cargar() }, 20_000)
    return () => clearInterval(t)
  }, [cargar])

  const aprobar = async (a: Aprobacion) => {
    if (!window.confirm(`¿Aprobar la fase «${a.faseNombre}» de ${a.nombre} y pasar a la siguiente?`)) return
    setAprobando(a.id)
    try { await post(`/api/proyectos/${a.id}/fases/avanzar`, {}); await cargar() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo aprobar') } finally { setAprobando(null) }
  }

  if (!d) return <div className="p-6 text-[12px] text-[#7f8a9c] flex items-center gap-2">{error ? <span className="text-red-300">{error}</span> : <><Loader2 size={14} className="animate-spin" /> Cargando el motor…</>}</div>

  const t = d.totales
  const ej = d.ejecucion
  const colas = ej.harness.colas ?? {}
  const pendientesCola = (colas.HIGH ?? 0) + (colas.MEDIUM ?? 0) + (colas.LOW ?? 0)
  const maxTokens = Math.max(1, ...d.costo.porProyecto.map(p => p.tokens))

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-gray-100">Motor</h2>
          <p className="text-[11px] text-[#7f8a9c]">Proyectos, aprobaciones, agentes y costo en un solo lugar. Se actualiza solo cada 20 s.</p>
        </div>
        <span className="flex-1" />
        <button onClick={() => void cargar()} className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] hover:text-gray-100 px-2.5 py-1.5 rounded-lg border border-white/10">
          <RefreshCw size={12} className={cargando ? 'animate-spin' : ''} /> Actualizar</button>
      </div>
      {error && <p className="text-[11px] text-red-300">{error}</p>}

      <div className="flex flex-wrap gap-2.5">
        <Cifra valor={t.enCurso} etiqueta="proyectos en curso" />
        <Cifra valor={t.porAprobar} etiqueta="puertas por aprobar" tono="aviso" />
        <Cifra valor={t.corriendo} etiqueta="tareas corriendo" tono="ok" />
        <Cifra valor={t.problemas} etiqueta="con problemas" tono="mal" />
        <Cifra valor={t.sinMotor} etiqueta="leads sin motor de fases" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Tarjeta titulo="Esperan a una persona" icono={UserCheck} derecha={<span className="text-[10px] text-[#7f8a9c]">{d.aprobaciones.length} puerta{d.aprobaciones.length === 1 ? '' : 's'} abiertas</span>}>
          {d.aprobaciones.length === 0 && <p className="px-4 py-3 text-[11px] text-[#7f8a9c]">Ningún proyecto tiene una puerta abierta.</p>}
          <div className="divide-y divide-white/5">
            {d.aprobaciones.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <NextLink href={urlProyecto(a.id)} className="text-[12px] text-gray-100 hover:text-indigo-200 truncate block">{a.nombre}</NextLink>
                  <p className="text-[10px] text-[#7f8a9c]">Fase {a.faseNumero} · {a.faseNombre} · aprueba: {APROBADOR[a.aprobador] ?? a.aprobador} · {a.enFaseDesde ? `desde ${hace(a.enFaseDesde)}` : ''}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={a.lista ? { background: 'rgba(16,185,129,0.18)', color: '#6ee7b7' } : { background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>
                  {a.ok}/{a.total} criterios</span>
                {a.lista && a.tipo === 'NORMAL' && d.puedeAprobar
                  ? <button disabled={aprobando === a.id} onClick={() => void aprobar(a)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-white disabled:opacity-50 flex-shrink-0" style={{ background: '#6366f1' }}>
                    {aprobando === a.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Aprobar</button>
                  : <NextLink href={urlProyecto(a.id)} className="text-[11px] text-indigo-300 hover:text-indigo-200 flex-shrink-0">{a.lista && a.tipo === 'RESULTADO' ? 'Decidir resultado' : 'Abrir'}</NextLink>}
              </div>))}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Agentes y cola" icono={Bot}
          derecha={<span className="flex items-center gap-1 text-[10px]" style={{ color: ej.harness.ok ? '#6ee7b7' : '#fca5a5' }}><Server size={11} /> Harness {ej.harness.ok ? 'responde' : 'NO responde'}</span>}>
          <div className="px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[#9ca3af] border-b border-white/5">
            <span>En cola: <b className="text-gray-200">{pendientesCola}</b></span>
            <span>Corriendo: <b className="text-gray-200">{ej.corriendo.length}</b></span>
            <span style={{ color: (colas.DLQ ?? 0) > 0 ? '#fcd34d' : undefined }}>Cartas muertas (DLQ): <b>{colas.DLQ ?? 0}</b></span>
          </div>
          {ej.atascadas.length > 0 && (
            <div className="px-4 py-2 border-b border-white/5" style={{ background: 'rgba(245,158,11,0.07)' }}>
              <p className="text-[11px] text-amber-300 flex items-center gap-1.5"><AlertTriangle size={12} /> {ej.atascadas.length} ejecución{ej.atascadas.length === 1 ? '' : 'es'} en RUNNING hace más de {ej.atascadaHoras} h (probablemente atascadas)</p>
              {ej.atascadas.slice(0, 4).map(x => <p key={x.id} className="text-[10px] text-[#9ca3af] truncate">{x.taskCode ?? ''} {x.title ?? x.backlogItemId} · desde {hace(x.startedAt)}</p>)}
            </div>)}
          <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
            {ej.corriendo.map(x => (
              <div key={x.id} className="px-4 py-1.5">
                <p className="text-[11px] text-gray-200 truncate"><span className="text-emerald-300">● </span>{x.taskCode ? `${x.taskCode} · ` : ''}{x.title}</p>
                <p className="text-[10px] text-[#7f8a9c]">{x.solucion ?? 'Sin proyecto'}{x.desde ? ` · ${hace(x.desde)}` : ''}</p>
              </div>))}
            {ej.problemas.map(x => (
              <div key={x.id} className="px-4 py-1.5">
                <p className="text-[11px] text-gray-200 truncate"><span style={{ color: x.status === 'FAILED' ? '#fca5a5' : '#fcd34d' }}>● {x.status === 'FAILED' ? 'Fallida' : 'Bloqueada'} </span>{x.taskCode ? `${x.taskCode} · ` : ''}{x.title}</p>
                <p className="text-[10px] text-[#7f8a9c]">{x.solucion ?? 'Sin proyecto'}{x.updatedAt ? ` · ${hace(x.updatedAt)}` : ''}</p>
              </div>))}
            {ej.corriendo.length === 0 && ej.problemas.length === 0 && <p className="px-4 py-3 text-[11px] text-[#7f8a9c]">Nada corriendo ni con problemas.</p>}
          </div>
          <div className="px-4 py-2 border-t border-white/5"><Link href="/backlog/control" className="text-[11px] text-indigo-300 hover:text-indigo-200">Abrir la Sala de Control</Link></div>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Cartera de proyectos" icono={Gauge} derecha={<span className="text-[10px] text-[#7f8a9c]">{d.cartera.length} con motor de fases</span>}>
        {d.cartera.length === 0 && <p className="px-4 py-3 text-[11px] text-[#7f8a9c]">Aún no hay proyectos con el motor de fases iniciado. Se inicia desde Proyectos › Fases.</p>}
        <div className="divide-y divide-white/5">
          {d.cartera.map(p => {
            const tr = p.tareas
            return (
              <NextLink key={p.id} href={urlProyecto(p.id)} className="flex items-center gap-4 px-4 py-2.5 hover:bg-white/[0.03]">
                <div className="w-[210px] flex-shrink-0 min-w-0">
                  <p className="text-[12px] text-gray-100 truncate">{p.nombre}</p>
                  <p className="text-[10px] text-[#7f8a9c] truncate">{p.cliente ?? p.codigo ?? ''}</p>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <div className="flex gap-0.5">{Array.from({ length: p.totalFases }, (_, i) => {
                    const num = i + 1
                    const hecha = p.estadoMotor === 'COMPLETADO' || num < p.faseNumero
                    const actual = num === p.faseNumero && p.estadoMotor !== 'COMPLETADO'
                    return <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: hecha ? '#10b981' : actual ? (p.estadoMotor === 'CERRADO_PERDIDO' ? '#ef4444' : '#6366f1') : 'rgba(255,255,255,0.12)' }} />
                  })}</div>
                  <p className="text-[10px] text-[#9ca3af] mt-1">
                    {p.estadoMotor === 'COMPLETADO' ? 'Completado' : p.estadoMotor === 'CERRADO_PERDIDO' ? `Perdido en ${p.faseNombre}` : `${p.faseNumero}. ${p.faseNombre}`} · {p.bloque === 'PREVENTA' ? 'preventa' : 'ejecución'}
                    {p.estadoMotor === 'EN_CURSO' && p.puerta.total > 0 ? ` · puerta ${p.puerta.ok}/${p.puerta.total}` : ''}
                  </p>
                </div>
                <div className="w-[170px] flex-shrink-0 text-right text-[10px] text-[#9ca3af]">
                  {tr && tr.total > 0 ? <>{tr.hechas}/{tr.total} tareas{tr.enCurso ? <span className="text-emerald-300"> · {tr.enCurso} corriendo</span> : null}{tr.fallidas ? <span className="text-red-300"> · {tr.fallidas} fallidas</span> : null}{tr.bloqueadas ? <span className="text-amber-300"> · {tr.bloqueadas} bloq.</span> : null}</> : 'Sin tareas'}
                </div>
              </NextLink>)
          })}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Uso de tokens" icono={Cpu} derecha={<span className="text-[10px] text-[#7f8a9c]">{d.costo.conUso} de {d.costo.ejecuciones} ejecuciones con medición</span>}>
        {d.costo.conUso === 0
          ? <p className="px-4 py-3 text-[11px] text-[#7f8a9c]">Todavía no hay mediciones: el uso se empezó a guardar con la fase 2 del motor y se llena a medida que corren tareas nuevas.</p>
          : (<div className="px-4 py-3 space-y-2">
            <p className="text-[11px] text-[#9ca3af]">Total <b className="text-gray-100">{miles(d.costo.tokens)}</b> tokens · {miles(d.costo.entrada)} de entrada · {miles(d.costo.salida)} de salida</p>
            {d.costo.porProyecto.map(p => (
              <div key={p.id || p.nombre} className="flex items-center gap-3 text-[11px]">
                <span className="w-[200px] truncate text-gray-300">{p.nombre}</span>
                <span className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${Math.max(2, (p.tokens / maxTokens) * 100)}%`, background: '#6366f1' }} /></span>
                <span className="w-[120px] text-right text-[#9ca3af]">{miles(p.tokens)} · {p.tareas} tarea{p.tareas === 1 ? '' : 's'}</span>
              </div>))}
          </div>)}
      </Tarjeta>
    </div>
  )
}
