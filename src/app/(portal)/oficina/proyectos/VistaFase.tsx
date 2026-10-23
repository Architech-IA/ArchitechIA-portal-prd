'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, Undo2, Trophy, XCircle, Play, AlertTriangle, ExternalLink, Folder, FileText, Paperclip, Rocket, ListChecks, Users, Flag, Network, Sparkles, Settings, Plus, Send } from 'lucide-react'
import Link from '@/lib/BacklogLink'
import { TITULO_DE_TAB } from '../../solutions/pilots/[id]/ArbolArtefactos'
import type { TabKey } from '../../solutions/pilots/[id]/espacio'
import FaseSesiones from './FaseSesiones'
import ActividadesDeFase from './ActividadesDeFase'
import NotasDeFase from './NotasDeFase'
import EntregablesDeFase from './EntregablesDeFase'
import { post, hace, ETIQUETA_BLOQUE, type FasesRes, type FaseVista, type FaseActividadVista, type RecursoFase, type SesionRes } from './api'

// Vista de UNA fase del proyecto (una pestaña por fase en Oficina > Proyectos): qué se busca, qué hay que hacer,
// dónde está lo que produce la fase y la puerta para pasar a la siguiente. Mover fases lo hacen los
// administradores; saltarse los criterios, solo un superadmin.

const APROBADOR: Record<string, string> = {
  COMERCIAL: 'Responsable comercial', LIDER_PREVENTA: 'Líder de preventa', LIDER_TECNICO: 'Líder técnico',
  DIRECCION: 'Dirección', LIDER_PROYECTO: 'Líder de proyecto', CLIENTE: 'El cliente', DUENO: 'Dueño de la iniciativa',
}
const ACCION: Record<string, string> = {
  INICIO: 'Inició el motor de fases', AVANCE: 'Avanzó de fase', RETROCESO: 'Volvió a una fase anterior', SINCRONIZADO: 'Fase ajustada por el lead',
  VENTA_CONFIRMADA: 'Venta confirmada: pasa a ejecución', VENTA_PERDIDA: 'Oportunidad perdida', COMPLETADO: 'Proyecto completado',
}
const NIVEL: Record<string, { color: string; fondo: string }> = {
  ok: { color: '#6ee7b7', fondo: 'rgba(16,185,129,0.14)' }, medio: { color: '#fcd34d', fondo: 'rgba(245,158,11,0.14)' },
  vacio: { color: '#9ca3af', fondo: 'rgba(255,255,255,0.07)' }, aviso: { color: '#fdba74', fondo: 'rgba(249,115,22,0.14)' },
}
const ICONO: Record<string, typeof Folder> = {
  LEAD_HUB: Users, PROPUESTAS: FileText, HUB_PRD: FileText, HUB_DISENO: FileText, HUB_ARQUITECTURA: Network, HUB_PLAN: ListChecks, HUB_CODIGO: Folder, HUB_DESPLIEGUE: Rocket,
  BACKLOG: ListChecks, SALA_CONTROL: Rocket, REUNIONES: Users, ADJUNTOS: Paperclip,
}
/** /solutions/pilots/<id>?seccion=prd → el artefacto "prd" (se abre en esta misma pantalla). */
const artefactoDe = (href: string): TabKey | null => { const m = href.match(/^\/solutions\/pilots\/[^/?]+\?seccion=([\w-]+)/); return m && m[1] in TITULO_DE_TAB ? (m[1] as TabKey) : null }
const externo = (href: string) => /^\/(leads|proposals|meetings)\b/.test(href)

function Seccion({ titulo, derecha, children, llenar }: { titulo: string; derecha?: React.ReactNode; children: React.ReactNode; llenar?: boolean }) {
  return (
    <section className={`rounded-xl ${llenar ? 'h-full flex flex-col' : ''}`} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5" style={{ background: 'linear-gradient(90deg,rgba(249,115,22,0.05),transparent 60%)' }}><h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#b4bccb]">{titulo}</h3><span className="flex-1" />{derecha}</header>
      <div className={llenar ? 'p-3 flex-1 min-h-0 flex flex-col' : 'p-3'}>{children}</div>
    </section>)
}

export default function VistaFase({ onIniciarActividad, onNuevaGeneral, creandoGeneral, sidActiva, onElegirSesion, renderChat, onAbrirPlantillas, proyectoId, fase, data, onCambio, onAbrirPanel, onAbrirArtefacto, sesiones, creandoRol, onIniciarSesion, onAbrirSesion, onAbrirFicha, onAbrirLead, onInvestigarEmpresa }: {
  onAbrirFicha?: () => void; onAbrirLead?: () => void; onInvestigarEmpresa?: () => void; onAbrirPlantillas?: (fase: string) => void
  onNuevaGeneral?: (texto: string, fase: string) => Promise<void>; creandoGeneral?: boolean
  onIniciarActividad?: (a: FaseActividadVista) => Promise<void>
  sidActiva?: string | null; onElegirSesion?: (id: string) => void; renderChat?: (s: SesionRes, slot: HTMLElement | null) => React.ReactNode
  sesiones: SesionRes[]; creandoRol: string | null; onIniciarSesion: (fase: string, rol: string) => void; onAbrirSesion: (id: string) => void
  proyectoId: string; fase: FaseVista; data: FasesRes; onCambio: () => void; onAbrirPanel: (p: 'adjuntos' | 'ejecucion') => void; onAbrirArtefacto?: (t: TabKey) => void
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [aprobarAbierto, setAprobarAbierto] = useState(false)
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
  // El panel del chat tiene dos pestañas: el asistente general del proyecto (cualquier conversación, con los mismos permisos y herramientas que una sesión de la fase)
  // y la sesión de esta fase que se haya elegido. Si ya hay una sesión de la fase abierta, se muestra esa.
  const [faseSid, setFaseSid] = useState<string | null>(null)
  const [slotChat, setSlotChat] = useState<HTMLElement | null>(null)
  const [panelModo, setPanelModo] = useState<'fase' | 'general'>('general')
  const [primero, setPrimero] = useState('')
  // Las sesiones de rol de esta fase; el asistente de la fase es la conversación libre ligada a ella (sin rol). Cada fase tiene las suyas.
  const delaFase = (x: SesionRes) => x.faseClave === fase.clave && !!x.rol && x.estado !== 'ARCHIVADA'
  const activa = sesiones.find(x => x.id === faseSid && delaFase(x)) ?? null
  const abiertaReciente = [...sesiones].filter(x => delaFase(x) && x.estado === 'ACTIVA').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.id
  const general = [...sesiones].filter(x => x.faseClave === fase.clave && !x.rol && x.tipo !== 'BITACORA' && x.estado === 'ACTIVA').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  // Al entrar a la fase: si hay una sesión suya abierta (o la global ya es de esta fase), se muestra; si no, el asistente general
  useEffect(() => {
    if (activa) return
    const elegida = sesiones.find(x => x.id === sidActiva && delaFase(x))?.id ?? abiertaReciente
    if (elegida) { setFaseSid(elegida); setPanelModo('fase') }
  }, [fase.clave, abiertaReciente, sidActiva]) // eslint-disable-line react-hooks/exhaustive-deps
  // Una sesión de la fase recién creada (o elegida en otro sitio) pasa a verse
  useEffect(() => {
    const s = sesiones.find(x => x.id === sidActiva)
    if (s && delaFase(s) && s.id !== faseSid) { setFaseSid(s.id); setPanelModo('fase') }
  }, [sidActiva, sesiones]) // eslint-disable-line react-hooks/exhaustive-deps
  // Lleva directo al editor de plantillas de fases, en la plantilla de este proyecto y en esta fase (solo los administradores pueden editarlas)
  const botonConfig = data.puedeAprobar && onAbrirPlantillas ? (
    <button onClick={() => onAbrirPlantillas(fase.clave)} title="Configurar los entregables, los criterios y las actividades de esta fase (plantillas de fases)" aria-label="Configurar esta fase en las plantillas"
      className="flex items-center justify-center w-6 h-6 rounded-lg text-[#9ca3af] hover:text-gray-100 hover:bg-white/10 transition-colors"><Settings size={13} /></button>) : null
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
      setNota(''); setForzar(false); setModo('ninguno'); setTexto(''); setAprobarAbierto(false)
      onCambio()
    } catch (e) {
      const faltan = (e as { data?: { faltan?: string[] } }).data?.faltan
      setError((e instanceof Error ? e.message : 'No se pudo completar la acción') + (faltan?.length ? `: ${faltan.join(' · ')}` : ''))
    } finally { setOcupado(false) }
  }

  // Marcar un criterio desde el popup no borra el comentario que se esté escribiendo
  const marcarCriterio = async (indice: number, ok: boolean) => {
    setOcupado(true); setError(null)
    try { await post(`/api/proyectos/${proyectoId}/fases/criterio`, { fase: fase.clave, indice, ok }); onCambio() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo marcar el criterio') } finally { setOcupado(false) }
  }
  useEffect(() => {
    if (!aprobarAbierto) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ocupado) setAprobarAbierto(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [aprobarAbierto, ocupado])
  const estadoFase = !data.iniciado ? 'Sin iniciar' : fase.estado === 'HECHA' ? 'Hecha' : fase.estado === 'ACTUAL' ? 'Fase actual' : fase.estado === 'CERRADA' ? 'Cerrada: oportunidad perdida' : 'Pendiente'
  const colorEstado = fase.estado === 'HECHA' ? '#6ee7b7' : fase.estado === 'ACTUAL' ? '#a5b4fc' : fase.estado === 'CERRADA' ? '#fca5a5' : '#9ca3af'

  const abrir = (r: RecursoFase) => {
    if (r.panel) onAbrirPanel(r.panel as 'adjuntos' | 'ejecucion')
  }

  return (
    <div className="h-full overflow-y-auto p-5 pt-[9px] space-y-4">

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

      {/* Lo que falta para cerrar la fase (50 %) junto al trabajo de la fase (50 %) */}
      <div className={`grid grid-cols-1 gap-4 items-start lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]`}>
        <section className="rounded-xl overflow-hidden flex flex-col" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', height: 620 }}>
          <header className="flex items-center gap-4 px-4 py-2.5 border-b border-white/5 flex-shrink-0" style={{ background: 'linear-gradient(90deg,rgba(249,115,22,0.05),transparent 60%)' }}>
            <button onClick={() => { setPanelModo('general'); if (general) onElegirSesion?.(general.id) }} className="text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors hover:text-gray-100" aria-pressed={panelModo === 'general'}
              style={{ color: panelModo === 'general' ? '#e5e7eb' : '#6b7686', borderBottom: panelModo === 'general' && activa ? '2px solid rgba(249,115,22,0.8)' : '2px solid transparent', paddingBottom: 2 }}>Asistente de la fase</button>
            {activa && <button onClick={() => { setPanelModo('fase'); onElegirSesion?.(activa.id) }} className="text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors hover:text-gray-100 max-w-[280px] truncate" aria-pressed={panelModo === 'fase'} title={activa.titulo}
              style={{ color: panelModo === 'fase' ? '#e5e7eb' : '#6b7686', borderBottom: panelModo === 'fase' && activa ? '2px solid rgba(249,115,22,0.8)' : '2px solid transparent', paddingBottom: 2 }}>Sesión · {activa.titulo}</button>}
            <span className="flex-1" />
            <div ref={setSlotChat} className="flex items-center gap-2" />
            {panelModo === 'general' && general && onNuevaGeneral && <button disabled={creandoGeneral} onClick={() => void onNuevaGeneral('', fase.clave)} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-indigo-200 disabled:opacity-50" style={{ background: 'rgba(99,102,241,0.12)', border: '1px dashed rgba(99,102,241,0.4)' }}>{creandoGeneral ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Nueva conversación</button>}
          </header>
          {panelModo === 'fase' && activa && renderChat ? <div className="flex-1 min-h-0">{renderChat(activa, slotChat)}</div>
            : general && renderChat ? <div className="flex-1 min-h-0">{renderChat(general, slotChat)}</div>
            : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
                <p className="text-[13px] text-gray-200 font-medium">Asistente de esta fase</p>
                <p className="text-[11px] text-[#7f8a9c] max-w-sm leading-snug">Pregúntale lo que quieras sobre el proyecto o pídele que trabaje en algo de esta fase. Cada fase tiene su propia conversación; tiene el mismo contexto, herramientas y permisos que una sesión de la fase.</p>
                <div className="w-full max-w-md flex gap-2">
                  <textarea value={primero} onChange={e => setPrimero(e.target.value)} rows={3} placeholder="Escribe tu primer mensaje…" className="flex-1 rounded-lg px-3 py-2 text-[12px] text-gray-200 bg-black/30 border border-white/10 outline-none focus:border-indigo-400/50" />
                  <button disabled={creandoGeneral || !primero.trim() || !onNuevaGeneral} onClick={() => { const t = primero; setPrimero(''); void onNuevaGeneral?.(t, fase.clave) }} className="self-end flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] text-white disabled:opacity-40" style={{ background: 'rgba(99,102,241,0.85)' }}>{creandoGeneral ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Enviar</button>
                </div>
              </div>)}
        </section>
      <div className="space-y-4">
        <Seccion titulo="Entregables" derecha={botonConfig}>
          <div className="space-y-4">
            <div>
              <EntregablesDeFase key={fase.clave} proyectoId={proyectoId} fase={fase} editable={puede} onCambio={onCambio} onAbrirArtefacto={onAbrirArtefacto} onAbrirFicha={onAbrirFicha} onAbrirLead={onAbrirLead} sesiones={sesiones} />
            </div>
            <div className={esResultado || (puede && opcionesVolver.length > 0) || (!data.puedeAprobar && actual) ? 'border-t border-white/5 pt-3' : ''}>
              {esResultado && <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1.5">Criterios de la puerta · aprueba: {APROBADOR[fase.puerta.aprobador] ?? fase.puerta.aprobador} ({marcados}/{fase.puerta.criterios.length})</p>}
                <div className="space-y-2">
                  {esResultado && fase.puerta.criterios.map((c, i) => (
                    <label key={i} className={`flex items-start gap-2 text-[12px] ${puede ? 'cursor-pointer' : 'cursor-default'}`}>
                      <input type="checkbox" checked={c.ok} disabled={!puede || ocupado} className="mt-0.5 accent-indigo-500" onChange={e => void accion('criterio', { fase: fase.clave, indice: i, ok: e.target.checked })} />
                      <span className={c.ok ? 'text-gray-300' : 'text-gray-400'}>{c.texto}{c.ok && c.por && <span className="text-[10px] text-[#7f8a9c]"> — {c.por}{c.en ? `, ${hace(c.en)}` : ''}</span>}</span>
                    </label>))}
                  {esResultado && !actual && data.iniciado && fase.estado === 'PENDIENTE' && <p className="text-[11px] text-[#7f8a9c]">Esta fase aún no empieza: sus criterios se marcan cuando sea la fase actual.</p>}
                  {!data.puedeAprobar && actual && <p className="text-[11px] text-amber-300">Solo los administradores mueven las fases.</p>}

                  {puede && (esResultado || opcionesVolver.length > 0) && (
                    <div className="pt-2 space-y-2 border-t border-white/5">
                      {data.esSuperadmin && !fase.puerta.cumplida && esResultado && (
                        <label className="flex items-center gap-1.5 text-[11px] text-amber-300 cursor-pointer"><input type="checkbox" checked={forzar} onChange={e => setForzar(e.target.checked)} className="accent-amber-500" /><AlertTriangle size={11} /> Saltarme los criterios (queda registrado)</label>)}
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

            </div>
          </div>
        </Seccion>
        <Seccion titulo="Trabajo de la fase" derecha={botonConfig}>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1.5">Actividades</p>
              <ActividadesDeFase fase={fase} proyectoId={proyectoId} sesiones={sesiones} onInvestigar={onInvestigarEmpresa} onIniciar={onIniciarActividad ? a => onIniciarActividad(a) : undefined} onAbrirSesion={id => onElegirSesion?.(id)} onCambio={onCambio} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1.5">Sesiones con la IA</p>
              <FaseSesiones fase={fase} sesiones={sesiones} creando={creandoRol} activaId={panelModo === 'fase' ? faseSid : null} onIniciar={onIniciarSesion} onElegir={id => { setFaseSid(id); setPanelModo('fase'); onElegirSesion?.(id) }} />
            </div>
          </div>
        </Seccion>
      </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <Seccion titulo="Notas de la fase">
            <NotasDeFase key={`${proyectoId}-${fase.clave}`} proyectoId={proyectoId} clave={fase.clave} esPreventa={fase.bloque === 'PREVENTA'} soloLectura={!!data.iniciado && fase.estado === 'PENDIENTE'} />
          </Seccion>

          {fase.recursos.some(r => r.tipo !== 'LEAD_HUB' && r.tipo !== 'BACKLOG') && <Seccion titulo="Dónde está lo de esta fase">
            <div className="space-y-1.5">
              {fase.recursos.filter(r => r.tipo !== 'LEAD_HUB' && r.tipo !== 'BACKLOG').map(r => {
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
                const art = r.href ? artefactoDe(r.href) : null
                if (art && onAbrirArtefacto) return <button key={r.etiqueta} onClick={() => onAbrirArtefacto(art)} className={`${cls} hover:bg-white/[0.07]`} style={st}>{cuerpo}</button>
                if (r.href) return externo(r.href)
                  ? <a key={r.etiqueta} href={r.href} target="_blank" rel="noreferrer" className={`${cls} hover:bg-white/[0.07]`} style={st}>{cuerpo}</a>
                  : <Link key={r.etiqueta} href={r.href} className={`${cls} hover:bg-white/[0.07]`} style={st}>{cuerpo}</Link>
                if (r.panel) return <button key={r.etiqueta} onClick={() => abrir(r)} className={`${cls} hover:bg-white/[0.07]`} style={st}>{cuerpo}</button>
                return <div key={r.etiqueta} className={cls} style={st}>{cuerpo}</div>
              })}
            </div>
          </Seccion>}
        </div>

        <div className="space-y-4">
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
      {/* Aprobar la fase: barra transversal bajo los cuatro paneles */}
      {puede && !esResultado && (
        <div className="space-y-2">
          <style>{`.btn-aprobar { background: linear-gradient(135deg,#f97316,#ea580c); box-shadow: 0 8px 24px rgba(234,88,12,0.35), inset 0 1px 0 rgba(255,255,255,0.25); transition: transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s, filter .18s; }
.btn-aprobar:not(:disabled):hover { transform: translateY(-2px); filter: brightness(1.1) !important; box-shadow: 0 14px 34px rgba(234,88,12,0.5), 0 0 0 1px rgba(251,146,60,0.55), inset 0 1px 0 rgba(255,255,255,0.35) !important; }
.btn-aprobar:not(:disabled):active { transform: translateY(0); filter: brightness(1.02) !important; }
.btn-aprobar:disabled { box-shadow: none; }
@media (prefers-reduced-motion: reduce) { .btn-aprobar, .btn-aprobar:hover { transition: none; transform: none !important; } }`}</style>
          <button disabled={ocupado} onClick={() => setAprobarAbierto(true)}
            className="btn-aprobar w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed">
            {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {ultima ? 'Cerrar el proyecto' : `Aprobar y pasar a ${siguiente?.nombre}`}</button>
        </div>)}

      {aprobarAbierto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(20px)', padding: 16 }} onClick={() => !ocupado && setAprobarAbierto(false)}>
          <div role="dialog" aria-modal="true" aria-label="Aprobar la fase" onClick={e => e.stopPropagation()}
            style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)', width: '100%', maxWidth: 540, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', margin: '-28px -28px 20px -28px', padding: '20px 28px', borderRadius: '24px 24px 0 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.01em' }}>{ultima ? 'Cerrar el proyecto' : `Aprobar y pasar a ${siguiente?.nombre}`}</h2>
              <button onClick={() => !ocupado && setAprobarAbierto(false)} aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-2">Criterios de la puerta · aprueba: {APROBADOR[fase.puerta.aprobador] ?? fase.puerta.aprobador} ({marcados}/{fase.puerta.criterios.length})</p>
            <div className="space-y-2 mb-3">
              {fase.puerta.criterios.map((c, i) => (
                <label key={i} className="flex items-start gap-2 text-[13px] cursor-pointer">
                  <input type="checkbox" checked={c.ok} disabled={ocupado} className="mt-1 accent-indigo-500" onChange={e => void marcarCriterio(i, e.target.checked)} />
                  <span className={c.ok ? 'text-gray-200' : 'text-gray-400'}>{c.texto}{c.ok && c.por && <span className="text-[10px] text-[#7f8a9c]"> — {c.por}{c.en ? `, ${hace(c.en)}` : ''}</span>}</span>
                </label>))}
            </div>
            {fase.puerta.entregablesOk === false && <p className="text-[11px] text-amber-300 mb-3">Faltan entregables por cumplir: míralos en el panel «Entregables».</p>}
            <label className="block text-[11px] text-[#9ca3af] mb-1">Comentarios (opcional)</label>
            <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3} placeholder="Algo que quieras dejar escrito sobre esta aprobación…" className="w-full rounded-lg px-3 py-2 text-[12px] text-gray-200 bg-black/30 border border-white/10 outline-none focus:border-orange-400/50" />
            {data.esSuperadmin && !fase.puerta.cumplida && (
              <label className="flex items-center gap-1.5 text-[11px] text-amber-300 cursor-pointer mt-3"><input type="checkbox" checked={forzar} onChange={e => setForzar(e.target.checked)} className="accent-amber-500" /><AlertTriangle size={11} /> Saltarme los criterios (queda registrado)</label>)}
            {error && <p className="text-[11px] text-red-300 mt-3">{error}</p>}
            <div className="flex items-center justify-end gap-2 mt-5">
              <button disabled={ocupado} onClick={() => setAprobarAbierto(false)} className="px-4 py-2 rounded-xl text-[12px] text-gray-300 border border-white/10 disabled:opacity-40">Cancelar</button>
              <button disabled={ocupado || (!fase.puerta.cumplida && !forzar)} onClick={() => void accion('avanzar', { nota, forzar })}
                className="btn-aprobar flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed">
                {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {ultima ? 'Cerrar el proyecto' : 'Aprobar y pasar'}</button>
            </div>
          </div>
        </div>)}
    </div>
  )
}
