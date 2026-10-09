'use client'

import { useState } from 'react'
import { Loader2, Check, Bot, User, Undo2, Trophy, XCircle, Play, AlertTriangle, ExternalLink, Folder, FileText, Paperclip, Rocket, ListChecks, Users, Flag, Network } from 'lucide-react'
import Link from '@/lib/BacklogLink'
import { post, hace, type FasesRes, type FaseVista, type RecursoFase } from './api'

// Vista de UNA fase del proyecto (una pestaña por fase en Oficina > Proyectos): qué se busca, qué hay que hacer,
// dónde está lo que produce la fase y la puerta para pasar a la siguiente. Mover fases lo hacen los
// administradores; saltarse los criterios, solo un superadmin.

const APROBADOR: Record<string, string> = {
  COMERCIAL: 'Responsable comercial', LIDER_PREVENTA: 'Líder de preventa', LIDER_TECNICO: 'Líder técnico',
  DIRECCION: 'Dirección', LIDER_PROYECTO: 'Líder de proyecto', CLIENTE: 'El cliente',
}
const ACCION: Record<string, string> = {
  INICIO: 'Inició el motor de fases', AVANCE: 'Avanzó de fase', RETROCESO: 'Volvió a una fase anterior', SINCRONIZADO: 'Fase ajustada por el lead',
  VENTA_CONFIRMADA: 'Venta confirmada: pasa a ejecución', VENTA_PERDIDA: 'Oportunidad perdida', COMPLETADO: 'Proyecto completado',
}
const ESTADO_TAREA: Record<string, string> = { BACKLOG: 'En cola', IN_PROGRESS: 'En curso', DONE: 'Hecha', FAILED: 'Fallida', BLOCKED: 'Bloqueada', CANCELLED: 'Cancelada' }
const NIVEL: Record<string, { color: string; fondo: string }> = {
  ok: { color: '#6ee7b7', fondo: 'rgba(16,185,129,0.14)' }, medio: { color: '#fcd34d', fondo: 'rgba(245,158,11,0.14)' },
  vacio: { color: '#9ca3af', fondo: 'rgba(255,255,255,0.07)' }, aviso: { color: '#fdba74', fondo: 'rgba(249,115,22,0.14)' },
}
const ICONO: Record<string, typeof Folder> = {
  LEAD_HUB: Users, PROPUESTAS: FileText, HUB_PRD: FileText, HUB_DISENO: FileText, HUB_ARQUITECTURA: Network, HUB_PLAN: ListChecks, HUB_CODIGO: Folder, HUB_DESPLIEGUE: Rocket,
  BACKLOG: ListChecks, SALA_CONTROL: Rocket, REUNIONES: Users, ADJUNTOS: Paperclip,
}
const externo = (href: string) => /^\/(leads|proposals|meetings)\b/.test(href)

function Seccion({ titulo, derecha, children }: { titulo: string; derecha?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <header className="flex items-center gap-2 px-4 py-2 border-b border-white/5"><h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">{titulo}</h3><span className="flex-1" />{derecha}</header>
      <div className="p-3">{children}</div>
    </section>)
}

export default function VistaFase({ proyectoId, fase, data, onCambio, onAbrirPanel }: {
  proyectoId: string; fase: FaseVista; data: FasesRes; onCambio: () => void; onAbrirPanel: (p: 'adjuntos' | 'ejecucion') => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [forzar, setForzar] = useState(false)
  const [modo, setModo] = useState<'ninguno' | 'volver' | 'perdido'>('ninguno')
  const [texto, setTexto] = useState('')
  const [volverA, setVolverA] = useState('')
  const [iniciarEn, setIniciarEn] = useState(data.faseSugerida ?? 'arranque')

  const fases = data.fases ?? []
  const idxActual = fases.findIndex(f => f.clave === data.faseActual)
  const cerrado = !!data.iniciado && data.estado !== 'EN_CURSO'
  const actual = !!data.iniciado && fase.clave === data.faseActual && !cerrado
  const puede = data.puedeAprobar && actual
  const marcados = fase.puerta.criterios.filter(c => c.ok).length
  const esResultado = fase.puerta.tipo === 'RESULTADO'
  const ultima = fase.numero === fases.length
  const siguiente = fases[fase.numero]
  const opcionesVolver = fases.slice(0, Math.max(0, idxActual)).filter(f => !(fases[idxActual]?.bloque === 'EJECUCION' && f.bloque === 'PREVENTA')).reverse()
  const historial = (data.historial ?? []).filter(h => h.fase === fase.clave)

  const accion = async (ruta: string, cuerpo: Record<string, unknown>) => {
    setOcupado(true); setError(null)
    try {
      await post(`/api/proyectos/${proyectoId}/fases/${ruta}`, cuerpo)
      setNota(''); setForzar(false); setModo('ninguno'); setTexto('')
      onCambio()
    } catch (e) {
      const faltan = (e as { data?: { faltan?: string[] } }).data?.faltan
      setError((e instanceof Error ? e.message : 'No se pudo completar la acción') + (faltan?.length ? `: ${faltan.join(' · ')}` : ''))
    } finally { setOcupado(false) }
  }

  const estadoFase = !data.iniciado ? 'Sin iniciar' : fase.estado === 'HECHA' ? 'Hecha' : fase.estado === 'ACTUAL' ? 'Fase actual' : fase.estado === 'CERRADA' ? 'Cerrada: oportunidad perdida' : 'Pendiente'
  const colorEstado = fase.estado === 'HECHA' ? '#6ee7b7' : fase.estado === 'ACTUAL' ? '#a5b4fc' : fase.estado === 'CERRADA' ? '#fca5a5' : '#9ca3af'

  const abrir = (r: RecursoFase) => {
    if (r.panel) onAbrirPanel(r.panel as 'adjuntos' | 'ejecucion')
  }

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-[16px] font-bold text-gray-100">{fase.numero}. {fase.nombre}</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)', color: '#c7d2fe' }}>{fase.bloque === 'PREVENTA' ? 'Preventa' : 'Ejecución'}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)', color: colorEstado }}>{estadoFase}</span>
        </div>
        <p className="text-[12px] text-[#9ca3af] mt-1 max-w-3xl leading-relaxed">{fase.objetivo}</p>
      </div>

      {!data.iniciado && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)' }}>
          <p className="text-[12px] text-gray-200 flex items-center gap-2"><Flag size={13} className="text-indigo-300" /> El motor de fases de este proyecto no está iniciado. Esto es la vista previa de la fase.</p>
          {data.puedeAprobar
            ? (<div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[#9ca3af]">Iniciar en</span>
              <select value={iniciarEn} onChange={e => setIniciarEn(e.target.value)} className="rounded-md px-2 py-1 text-[11px] text-gray-200 bg-black/30 border border-white/10 outline-none">
                {fases.map(f => <option key={f.clave} value={f.clave}>{f.numero}. {f.nombre}{f.clave === data.faseSugerida ? ' (según el lead)' : ''}</option>)}</select>
              <button disabled={ocupado} onClick={() => void accion('iniciar', iniciarEn === data.faseSugerida ? {} : { fase: iniciarEn })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50" style={{ background: '#6366f1' }}>
                {ocupado ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Iniciar el motor</button>
              <span className="text-[10px] text-[#7f8a9c]">Para un proyecto que ya venía avanzado, elige la fase en la que está.</span>
            </div>)
            : <p className="text-[11px] text-amber-300">Solo un administrador puede iniciarlo.</p>}
        </div>)}
      {cerrado && <p className="text-[12px] rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>{data.estado === 'COMPLETADO' ? 'El proyecto está completado.' : 'La oportunidad se cerró como perdida: las fases ya no se mueven.'}</p>}
      {error && <p className="text-[11px] text-red-300">{error}</p>}

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <Seccion titulo={`Actividades (${fase.actividades.hechas}/${fase.actividades.total})`} derecha={<Link href="/backlog/solution" className="text-[10px] text-indigo-300 hover:text-indigo-200">Ver en el Backlog</Link>}>
            <div className="space-y-1.5">
              {fase.actividades.items.map(a => (
                <div key={a.clave} className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {a.tipo === 'AGENTE' ? <Bot size={14} className="text-indigo-300 mt-0.5 flex-shrink-0" /> : <User size={14} className="text-amber-300 mt-0.5 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-gray-200 leading-snug">{a.titulo}</p>
                    <p className="text-[10px] text-[#7f8a9c] mt-0.5">{a.tipo === 'AGENTE' ? 'Agente' : 'Persona'} · {a.area}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={a.status === 'DONE' ? { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' } : a.status === 'FAILED' ? { background: 'rgba(239,68,68,0.15)', color: '#fca5a5' } : { background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>
                    {a.creada ? `${ESTADO_TAREA[a.status ?? ''] ?? a.status}${a.taskCode ? ` · ${a.taskCode}` : ''}` : 'Aún no creada'}</span>
                </div>))}
            </div>
          </Seccion>

          <Seccion titulo="Dónde está lo de esta fase">
            <div className="space-y-1.5">
              {fase.recursos.map(r => {
                const Icono = ICONO[r.tipo] ?? Folder
                const n = NIVEL[r.nivel] ?? NIVEL.vacio
                const cuerpo = (
                  <>
                    <Icono size={14} className="text-indigo-300 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-[12px] text-gray-200 leading-snug">{r.etiqueta}</p>
                      <p className="text-[10px] text-[#7f8a9c] mt-0.5">{r.descripcion}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 max-w-[45%] text-right" style={{ background: n.fondo, color: n.color }}>{r.estado}</span>
                    {(r.href || r.panel) && <ExternalLink size={12} className="text-[#7f8a9c] mt-1 flex-shrink-0" />}
                  </>)
                const cls = 'flex items-start gap-2 rounded-lg px-3 py-2 w-full transition-colors'
                const st = { background: 'rgba(255,255,255,0.04)' }
                if (r.href) return externo(r.href)
                  ? <a key={r.etiqueta} href={r.href} target="_blank" rel="noreferrer" className={`${cls} hover:bg-white/[0.07]`} style={st}>{cuerpo}</a>
                  : <Link key={r.etiqueta} href={r.href} className={`${cls} hover:bg-white/[0.07]`} style={st}>{cuerpo}</Link>
                if (r.panel) return <button key={r.etiqueta} onClick={() => abrir(r)} className={`${cls} hover:bg-white/[0.07]`} style={st}>{cuerpo}</button>
                return <div key={r.etiqueta} className={cls} style={st}>{cuerpo}</div>
              })}
            </div>
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Entregables de la fase</p>
              <ul className="list-disc pl-5 text-[12px] text-gray-300 space-y-0.5">{fase.entregables.map(e => <li key={e}>{e}</li>)}</ul>
            </div>
          </Seccion>
        </div>

        <div className="space-y-4">
          <Seccion titulo={`Puerta · aprueba: ${APROBADOR[fase.puerta.aprobador] ?? fase.puerta.aprobador} (${marcados}/${fase.puerta.criterios.length})`}>
            <div className="space-y-2">
              {fase.puerta.criterios.map((c, i) => (
                <label key={i} className={`flex items-start gap-2 text-[12px] ${puede ? 'cursor-pointer' : 'cursor-default'}`}>
                  <input type="checkbox" checked={c.ok} disabled={!puede || ocupado} className="mt-0.5 accent-indigo-500" onChange={e => void accion('criterio', { fase: fase.clave, indice: i, ok: e.target.checked })} />
                  <span className={c.ok ? 'text-gray-300' : 'text-gray-400'}>{c.texto}{c.ok && c.por && <span className="text-[10px] text-[#7f8a9c]"> — {c.por}{c.en ? `, ${hace(c.en)}` : ''}</span>}</span>
                </label>))}
              {!actual && data.iniciado && fase.estado === 'PENDIENTE' && <p className="text-[11px] text-[#7f8a9c]">Esta fase aún no empieza: sus criterios se marcan cuando sea la fase actual.</p>}
              {!data.puedeAprobar && actual && <p className="text-[11px] text-amber-300">Solo los administradores mueven las fases.</p>}

              {puede && (
                <div className="pt-2 space-y-2 border-t border-white/5">
                  <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Nota de la aprobación (opcional)"
                    className="w-full rounded-md px-2 py-1.5 text-[12px] text-gray-200 bg-black/30 border border-white/10 outline-none focus:border-indigo-400/50" />
                  {data.esSuperadmin && !fase.puerta.cumplida && (
                    <label className="flex items-center gap-1.5 text-[11px] text-amber-300 cursor-pointer"><input type="checkbox" checked={forzar} onChange={e => setForzar(e.target.checked)} className="accent-amber-500" /><AlertTriangle size={11} /> Saltarme los criterios (queda registrado)</label>)}
                  {!esResultado && (
                    <button disabled={ocupado || (!fase.puerta.cumplida && !forzar)} onClick={() => void accion('avanzar', { nota, forzar })}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium text-white disabled:opacity-40" style={{ background: '#6366f1' }}>
                      {ocupado ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {ultima ? 'Cerrar el proyecto' : `Aprobar y pasar a ${siguiente?.nombre}`}</button>)}
                  {esResultado && (
                    <div className="space-y-2">
                      <button disabled={ocupado || (!fase.puerta.cumplida && !forzar)} onClick={() => void accion('avanzar', { resultado: 'GANADO', nota, forzar })}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium text-white disabled:opacity-40" style={{ background: '#059669' }}>
                        {ocupado ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={12} />} Venta ganada: convertir en proyecto</button>
                      <p className="text-[10px] text-[#7f8a9c]">El lead queda ganado y esta misma solución (con su repositorio, MVP y PRD) pasa a ejecución. El PRD de preventa se guarda como versión 1.</p>
                      {modo !== 'perdido'
                        ? <button onClick={() => setModo('perdido')} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] text-red-300 border border-red-400/30 hover:bg-red-500/10"><XCircle size={12} /> Oportunidad perdida…</button>
                        : (<div className="space-y-1.5">
                          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Motivo de la pérdida (obligatorio)" className="w-full rounded-md px-2 py-1.5 text-[12px] text-gray-200 bg-black/30 border border-white/10 outline-none" />
                          <div className="flex gap-2">
                            <button disabled={ocupado || !texto.trim()} onClick={() => void accion('avanzar', { resultado: 'PERDIDO', motivo: texto })} className="flex-1 py-2 rounded-lg text-[12px] text-white disabled:opacity-40" style={{ background: '#dc2626' }}>Cerrar como perdido</button>
                            <button onClick={() => { setModo('ninguno'); setTexto('') }} className="px-3 py-2 rounded-lg text-[12px] text-gray-400 border border-white/10">Cancelar</button>
                          </div>
                        </div>)}
                    </div>)}

                  {opcionesVolver.length > 0 && (modo !== 'volver'
                    ? <button onClick={() => { setModo('volver'); setVolverA(opcionesVolver[0]?.clave ?? '') }} className="flex items-center gap-1 text-[11px] text-[#7f8a9c] hover:text-gray-200"><Undo2 size={11} /> Volver a una fase anterior</button>
                    : (<div className="space-y-1.5">
                      <select value={volverA} onChange={e => setVolverA(e.target.value)} className="w-full rounded-md px-2 py-1.5 text-[12px] text-gray-200 bg-black/30 border border-white/10 outline-none">
                        {opcionesVolver.map(o => <option key={o.clave} value={o.clave}>{o.numero}. {o.nombre}</option>)}</select>
                      <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Motivo (obligatorio)" className="w-full rounded-md px-2 py-1.5 text-[12px] text-gray-200 bg-black/30 border border-white/10 outline-none" />
                      <div className="flex gap-2">
                        <button disabled={ocupado || !texto.trim() || !volverA} onClick={() => void accion('retroceder', { fase: volverA, motivo: texto })} className="flex-1 py-2 rounded-lg text-[12px] text-white disabled:opacity-40" style={{ background: '#d97706' }}>Volver a esa fase</button>
                        <button onClick={() => { setModo('ninguno'); setTexto('') }} className="px-3 py-2 rounded-lg text-[12px] text-gray-400 border border-white/10">Cancelar</button>
                      </div>
                    </div>))}
                </div>)}
            </div>
          </Seccion>

          {historial.length > 0 && (
            <Seccion titulo="Historial de esta fase">
              <div className="space-y-1">
                {historial.map((h, i) => (
                  <div key={i} className="text-[11px] text-[#9ca3af] rounded px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="text-gray-300">{ACCION[h.accion] ?? h.accion}</span> · {h.usuarioNombre ?? 'Sistema'} · {hace(h.createdAt)}{h.nota ? <> — <i>{h.nota}</i></> : null}
                  </div>))}
              </div>
            </Seccion>)}
        </div>
      </div>
    </div>
  )
}
