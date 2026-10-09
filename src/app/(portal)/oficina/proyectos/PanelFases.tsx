'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Check, ChevronDown, ChevronRight, Bot, User, Undo2, Flag, Trophy, XCircle, Play, History, AlertTriangle } from 'lucide-react'
import Link from '@/lib/BacklogLink'
import { api, post, hace, type FasesRes, type FaseVista } from './api'

// Panel «Fases» de Oficina > Proyectos: el recorrido del proyecto desde el lead hasta la entrega.
// Muestra las 12 fases, las actividades de cada una (tareas del Backlog) y la puerta para pasar a la
// siguiente. Mover fases lo hacen los administradores; saltarse los criterios, solo un superadmin.

const APROBADOR: Record<string, string> = {
  COMERCIAL: 'Responsable comercial', LIDER_PREVENTA: 'Líder de preventa', LIDER_TECNICO: 'Líder técnico',
  DIRECCION: 'Dirección', LIDER_PROYECTO: 'Líder de proyecto', CLIENTE: 'El cliente',
}
const ACCION: Record<string, string> = {
  INICIO: 'Inició el motor de fases', AVANCE: 'Avanzó de fase', RETROCESO: 'Volvió a una fase anterior', SINCRONIZADO: 'Fase ajustada por el lead',
  VENTA_CONFIRMADA: 'Venta confirmada: pasa a ejecución', VENTA_PERDIDA: 'Oportunidad perdida', COMPLETADO: 'Proyecto completado',
}
const ESTADO_TAREA: Record<string, string> = { BACKLOG: 'En cola', IN_PROGRESS: 'En curso', DONE: 'Hecha', FAILED: 'Fallida', BLOCKED: 'Bloqueada', CANCELLED: 'Cancelada' }

export default function PanelFases({ proyectoId, onCambio }: { proyectoId: string; onCambio?: () => void }) {
  const [d, setD] = useState<FasesRes | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [forzar, setForzar] = useState(false)
  const [modo, setModo] = useState<'ninguno' | 'volver' | 'perdido'>('ninguno')
  const [texto, setTexto] = useState('')
  const [volverA, setVolverA] = useState('')
  const [verHistorial, setVerHistorial] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await api<FasesRes>(`/api/proyectos/${proyectoId}/fases`)
      setD(r)
      setAbierta(a => (a && r.fases?.some(f => f.clave === a) ? a : r.faseActual ?? null))
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las fases') }
  }, [proyectoId])

  useEffect(() => { setD(null); setError(null); setModo('ninguno'); setNota(''); setForzar(false); void cargar() }, [cargar])

  const accion = async (ruta: string, cuerpo: Record<string, unknown>) => {
    setOcupado(true); setError(null)
    try {
      await post(`/api/proyectos/${proyectoId}/fases/${ruta}`, cuerpo)
      setNota(''); setForzar(false); setModo('ninguno'); setTexto('')
      await cargar(); onCambio?.()
    } catch (e) {
      const faltan = (e as { data?: { faltan?: string[] } }).data?.faltan
      setError((e instanceof Error ? e.message : 'No se pudo completar la acción') + (faltan?.length ? `: ${faltan.join(' · ')}` : ''))
    } finally { setOcupado(false) }
  }

  if (!d) return <div className="p-4 text-[12px] text-[#7f8a9c] flex items-center gap-2">{error ? <span className="text-red-300">{error}</span> : <><Loader2 size={13} className="animate-spin" /> Cargando fases…</>}</div>

  // ── Sin iniciar ──
  if (!d.iniciado) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-gray-100 text-[13px] font-semibold"><Flag size={14} className="text-indigo-300" /> Motor de fases</div>
        <p className="text-[12px] text-[#9ca3af] leading-relaxed">
          {d.plantilla?.nombre}: {d.plantilla?.fases} fases desde la identificación del lead hasta la entrega. Cada fase crea sus actividades en el Backlog y
          tiene una puerta con criterios que una persona aprueba antes de pasar a la siguiente. El MVP o la demo que se construya en preventa queda como base del proyecto si la venta se gana.
        </p>
        {d.lead && <p className="text-[11px] text-[#7f8a9c]">Lead: {d.lead.companyName} · estado {d.lead.status}. Empezaría en la fase <b className="text-gray-300">{d.faseSugerida}</b>.</p>}
        {!d.lead && <p className="text-[11px] text-[#7f8a9c]">Esta solución no viene de un lead: empezaría directo en la fase de arranque.</p>}
        {d.puedeAprobar
          ? <button disabled={ocupado} onClick={() => void accion('iniciar', {})} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50" style={{ background: '#6366f1' }}>
            {ocupado ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Iniciar el motor de fases</button>
          : <p className="text-[11px] text-amber-300">Solo un administrador puede iniciarlo.</p>}
        {error && <p className="text-[11px] text-red-300">{error}</p>}
      </div>)
  }

  const fases = d.fases ?? []
  const idxActual = fases.findIndex(f => f.clave === d.faseActual)
  const hechas = fases.filter(f => f.estado === 'HECHA').length
  const cerrado = d.estado !== 'EN_CURSO'
  const puede = d.puedeAprobar && !cerrado

  const detalle = (f: FaseVista) => {
    const actual = f.clave === d.faseActual && !cerrado
    const marcados = f.puerta.criterios.filter(c => c.ok).length
    const esResultado = f.puerta.tipo === 'RESULTADO'
    const ultima = f.numero === fases.length
    const siguiente = fases[f.numero]
    return (
      <div className="px-3 pb-3 pt-1 space-y-2.5 text-[11px]">
        <p className="text-[#9ca3af] leading-relaxed">{f.objetivo}</p>

        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1 flex items-center">Actividades ({f.actividades.hechas}/{f.actividades.total})<span className="flex-1" /><Link href="/backlog/solution" className="normal-case tracking-normal text-indigo-300 hover:text-indigo-200">Ver en el Backlog</Link></p>
          <div className="space-y-1">
            {f.actividades.items.map(a => (
              <div key={a.clave} className="flex items-start gap-1.5 rounded-md px-2 py-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {a.tipo === 'AGENTE' ? <Bot size={12} className="text-indigo-300 mt-0.5 flex-shrink-0" /> : <User size={12} className="text-amber-300 mt-0.5 flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-gray-200 leading-snug">{a.titulo}</p>
                  <p className="text-[10px] text-[#7f8a9c]">
                    {a.tipo === 'AGENTE' ? 'Agente' : 'Persona'} · {a.area}
                    {a.creada ? <> · {ESTADO_TAREA[a.status ?? ''] ?? a.status}{a.taskCode ? ` · ${a.taskCode}` : ''}</> : ' · aún no creada'}
                  </p>
                </div>
                              </div>))}
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Entregables</p>
          <ul className="list-disc pl-4 text-gray-300 space-y-0.5">{f.entregables.map(e => <li key={e}>{e}</li>)}</ul>
        </div>

        <div className="rounded-lg p-2.5 space-y-1.5" style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <p className="text-[10px] uppercase tracking-wide text-indigo-200">Puerta · aprueba: {APROBADOR[f.puerta.aprobador] ?? f.puerta.aprobador} ({marcados}/{f.puerta.criterios.length})</p>
          {f.puerta.criterios.map((c, i) => (
            <label key={i} className={`flex items-start gap-2 ${actual && puede ? 'cursor-pointer' : 'cursor-default'}`}>
              <input type="checkbox" checked={c.ok} disabled={!actual || !puede || ocupado} className="mt-0.5 accent-indigo-500"
                onChange={e => void accion('criterio', { fase: f.clave, indice: i, ok: e.target.checked })} />
              <span className={c.ok ? 'text-gray-300' : 'text-gray-400'}>{c.texto}
                {c.ok && c.por && <span className="text-[10px] text-[#7f8a9c]"> — {c.por}{c.en ? `, ${hace(c.en)}` : ''}</span>}</span>
            </label>))}

          {actual && puede && (
            <div className="pt-1.5 space-y-1.5">
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Nota de la aprobación (opcional)"
                className="w-full rounded-md px-2 py-1 text-[11px] text-gray-200 bg-black/30 border border-white/10 outline-none focus:border-indigo-400/50" />
              {d.esSuperadmin && !f.puerta.cumplida && (
                <label className="flex items-center gap-1.5 text-amber-300 cursor-pointer"><input type="checkbox" checked={forzar} onChange={e => setForzar(e.target.checked)} className="accent-amber-500" /><AlertTriangle size={11} /> Saltarme los criterios (queda registrado)</label>)}
              {!esResultado && (
                <button disabled={ocupado || (!f.puerta.cumplida && !forzar)} onClick={() => void accion('avanzar', { nota, forzar })}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium text-white disabled:opacity-40" style={{ background: '#6366f1' }}>
                  {ocupado ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {ultima ? 'Cerrar el proyecto' : `Aprobar y pasar a ${siguiente?.nombre}`}
                </button>)}
              {esResultado && (
                <div className="space-y-1.5">
                  <button disabled={ocupado || (!f.puerta.cumplida && !forzar)} onClick={() => void accion('avanzar', { resultado: 'GANADO', nota, forzar })}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium text-white disabled:opacity-40" style={{ background: '#059669' }}>
                    {ocupado ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={12} />} Venta ganada: convertir en proyecto
                  </button>
                  <p className="text-[10px] text-[#7f8a9c]">El lead queda ganado y esta misma solución (con su repositorio, MVP y PRD) pasa a ejecución. El PRD de preventa se guarda como versión 1.</p>
                  {modo !== 'perdido'
                    ? <button onClick={() => setModo('perdido')} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-red-300 border border-red-400/30 hover:bg-red-500/10"><XCircle size={12} /> Oportunidad perdida…</button>
                    : (<div className="space-y-1">
                      <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Motivo de la pérdida (obligatorio)" className="w-full rounded-md px-2 py-1 text-[11px] text-gray-200 bg-black/30 border border-white/10 outline-none" />
                      <div className="flex gap-1.5">
                        <button disabled={ocupado || !texto.trim()} onClick={() => void accion('avanzar', { resultado: 'PERDIDO', motivo: texto })} className="flex-1 py-1.5 rounded-lg text-white disabled:opacity-40" style={{ background: '#dc2626' }}>Cerrar como perdido</button>
                        <button onClick={() => { setModo('ninguno'); setTexto('') }} className="px-2 py-1.5 rounded-lg text-gray-400 border border-white/10">Cancelar</button>
                      </div>
                    </div>)}
                </div>)}
            </div>)}
        </div>

        {actual && puede && volverOpciones(fases, idxActual).length > 0 && (
          modo !== 'volver'
            ? <button onClick={() => { setModo('volver'); setVolverA(volverOpciones(fases, idxActual)[0]?.clave ?? '') }} className="flex items-center gap-1 text-[#7f8a9c] hover:text-gray-200"><Undo2 size={11} /> Volver a una fase anterior</button>
            : (<div className="space-y-1">
              <select value={volverA} onChange={e => setVolverA(e.target.value)} className="w-full rounded-md px-2 py-1 text-[11px] text-gray-200 bg-black/30 border border-white/10 outline-none">
                {volverOpciones(fases, idxActual).map(o => <option key={o.clave} value={o.clave}>{o.numero}. {o.nombre}</option>)}
              </select>
              <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Motivo (obligatorio)" className="w-full rounded-md px-2 py-1 text-[11px] text-gray-200 bg-black/30 border border-white/10 outline-none" />
              <div className="flex gap-1.5">
                <button disabled={ocupado || !texto.trim() || !volverA} onClick={() => void accion('retroceder', { fase: volverA, motivo: texto })} className="flex-1 py-1.5 rounded-lg text-white disabled:opacity-40" style={{ background: '#d97706' }}>Volver a esa fase</button>
                <button onClick={() => { setModo('ninguno'); setTexto('') }} className="px-2 py-1.5 rounded-lg text-gray-400 border border-white/10">Cancelar</button>
              </div>
            </div>))}
      </div>)
  }

  return (
    <div className="p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Flag size={13} className="text-indigo-300" />
        <span className="text-[12px] font-semibold text-gray-100">{d.plantilla?.nombre}</span>
        <span className="flex-1" />
        {d.lead && <Link href={`/leads/${d.lead.id}/hub`} className="text-[10px] text-indigo-300 hover:text-indigo-200">Lead Hub</Link>}
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={d.estado === 'EN_CURSO' ? { background: 'rgba(99,102,241,0.2)', color: '#c7d2fe' } : d.estado === 'COMPLETADO' ? { background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' } : { background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          {d.estado === 'EN_CURSO' ? 'En curso' : d.estado === 'COMPLETADO' ? 'Completado' : 'Perdido'}</span>
      </div>

      <div>
        <div className="flex gap-0.5">{fases.map(f => (
          <button key={f.clave} onClick={() => setAbierta(f.clave)} title={`${f.numero}. ${f.nombre}`} className="h-1.5 flex-1 rounded-full"
            style={{ background: f.estado === 'HECHA' ? '#10b981' : f.estado === 'ACTUAL' ? '#6366f1' : f.estado === 'CERRADA' ? '#ef4444' : 'rgba(255,255,255,0.12)', outline: abierta === f.clave ? '1px solid #fff' : 'none' }} />))}
        </div>
        <p className="text-[10px] text-[#7f8a9c] mt-1">{hechas} de {fases.length} fases hechas{d.ventaConfirmada ? ' · venta confirmada' : ''}</p>
      </div>

      {error && <p className="text-[11px] text-red-300 leading-snug">{error}</p>}
      {!d.puedeAprobar && <p className="text-[10px] text-amber-300">Solo los administradores mueven las fases; acá puedes seguir el avance.</p>}

      <div className="space-y-1">
        {fases.map((f, i) => {
          const abiertaF = abierta === f.clave
          const color = f.estado === 'HECHA' ? '#10b981' : f.estado === 'ACTUAL' ? '#a5b4fc' : f.estado === 'CERRADA' ? '#fca5a5' : '#6b7280'
          return (
            <div key={f.clave} className="rounded-lg overflow-hidden" style={{ background: f.estado === 'ACTUAL' ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.025)', border: f.estado === 'ACTUAL' ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.05)' }}>
              {i > 0 && fases[i - 1].bloque !== f.bloque && <div className="h-0" />}
              <button onClick={() => setAbierta(abiertaF ? null : f.clave)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ border: `1.5px solid ${color}`, color, background: f.estado === 'HECHA' ? 'rgba(16,185,129,0.15)' : 'transparent' }}>
                  {f.estado === 'HECHA' ? <Check size={11} /> : f.numero}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-medium truncate" style={{ color: f.estado === 'PENDIENTE' ? '#9ca3af' : '#f3f4f6' }}>{f.nombre}</span>
                  <span className="block text-[10px] text-[#7f8a9c]">{f.bloque === 'PREVENTA' ? 'Preventa' : 'Ejecución'}{f.actividades.total ? ` · ${f.actividades.hechas}/${f.actividades.total} tareas` : ''}</span>
                </span>
                {abiertaF ? <ChevronDown size={13} className="text-[#7f8a9c]" /> : <ChevronRight size={13} className="text-[#7f8a9c]" />}
              </button>
              {abiertaF && detalle(f)}
            </div>)
        })}
      </div>

      <button onClick={() => setVerHistorial(o => !o)} className="flex items-center gap-1 text-[11px] text-[#7f8a9c] hover:text-gray-200"><History size={11} /> Historial ({d.historial?.length ?? 0})</button>
      {verHistorial && (
        <div className="space-y-1">
          {(d.historial ?? []).map((h, i) => (
            <div key={i} className="text-[10px] text-[#9ca3af] rounded px-2 py-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-gray-300">{ACCION[h.accion] ?? h.accion}</span> · {fases.find(f => f.clave === h.fase)?.nombre ?? h.fase}
              <br />{h.usuarioNombre ?? 'Sistema'} · {hace(h.createdAt)}{h.nota ? <> — <i>{h.nota}</i></> : null}
            </div>))}
        </div>)}
    </div>
  )
}

// Fases a las que se puede volver: las anteriores, sin cruzar de la ejecución a la preventa (la venta ya está hecha).
function volverOpciones(fases: FaseVista[], idxActual: number): FaseVista[] {
  const actualEsEjecucion = fases[idxActual]?.bloque === 'EJECUCION'
  return fases.slice(0, idxActual).filter(f => !(actualEsEjecucion && f.bloque === 'PREVENTA')).reverse()
}
