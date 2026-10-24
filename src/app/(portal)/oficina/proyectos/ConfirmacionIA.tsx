'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShieldQuestion, Loader2 } from 'lucide-react'

// Lo que la IA propone y espera que una persona confirme. Se muestra sobre el campo del chat, al estilo de los permisos de Claude Code:
// una pregunta, el detalle de lo que se hará y opciones numeradas (flechas, Enter, números o Esc).

export interface AccionIA {
  id: string; tipo: string; titulo: string; motivo?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>
}

// Tipos de bajo riesgo para los que se puede dejar de preguntar en el proyecto
export const AUTO_PERMITIDAS = ['FICHA', 'NOTA', 'TAREAS']

const TITULO: Record<string, string> = {
  FICHA: 'Completar la ficha del cliente', NOTA: 'Agregar una nota a la fase', TAREAS: 'Crear tareas en el backlog', PLAN: 'Crear épicas y sprints',
  CRITERIO: 'Marcar un criterio de la puerta', EJECUCION_RED: 'Ejecutar un comando con internet', DESPLIEGUE: 'Desplegar',
}
const PREGUNTA: Record<string, string> = {
  FICHA: '¿Guardo estos datos en la ficha del cliente?', NOTA: '¿Agrego esta nota a las notas de la fase?', TAREAS: '¿Creo estas tareas en el backlog?', PLAN: '¿Creo este plan?',
  CRITERIO: '¿Marco este criterio de la puerta?', EJECUCION_RED: '¿Ejecuto este comando con acceso a internet?', DESPLIEGUE: '¿Hago este despliegue?',
}
const SI: Record<string, string> = {
  FICHA: 'Sí, guardar en la ficha', NOTA: 'Sí, agregar la nota', TAREAS: 'Sí, crear las tareas', PLAN: 'Sí, crear el plan', CRITERIO: 'Sí, marcar el criterio',
  EJECUCION_RED: 'Sí, ejecutar con internet', DESPLIEGUE: 'Sí, hacerlo',
}
const SOLO_ADMIN = ['EJECUCION_RED', 'DESPLIEGUE', 'CRITERIO']

function detalle(a: AccionIA): [string, string][] {
  const p = a.payload
  if (a.tipo === 'FICHA') {
    const c = (p.cliente ?? {}) as Record<string, string>
    const k = ((p.contactos ?? {}).principal ?? {}) as Record<string, string>
    const campos: [string, string | undefined][] = [['Razón social', c.razonSocial], ['NIT', c.nit], ['Sector', c.sector], ['Ciudad', c.ciudad], ['País', c.pais], ['Sitio web', c.sitioWeb], ['Tamaño', c.tamano], ['Contacto', k.nombre], ['Cargo', k.cargo], ['Correo', k.correo], ['Teléfono', k.telefono]]
    return campos.filter(([, v]) => !!v) as [string, string][]
  }
  if (a.tipo === 'NOTA') return [['Título', String(p.titulo ?? a.titulo)], ['Contenido', String(p.texto ?? '').slice(0, 400)]]
  if (a.tipo === 'CRITERIO') return [['Criterio', String(p.texto ?? '')], ['Motivo', String(p.motivo ?? '')]]
  if (a.tipo === 'EJECUCION_RED') return [['Comando', String(p.comando ?? '')]]
  if (a.tipo === 'TAREAS') return ((p.tareas ?? []) as { title: string }[]).slice(0, 8).map((t, i) => [String(i + 1), t.title])
  if (a.tipo === 'PLAN') return [...((p.epicas ?? []) as { nombre: string }[]).map(e => ['Épica', e.nombre] as [string, string]), ...((p.sprints ?? []) as { nombre: string }[]).map(s => ['Sprint', s.nombre] as [string, string])]
  if (a.tipo === 'DESPLIEGUE') {
    return [['Qué', p.revertir ? 'Volver a la versión anterior de producción' : p.entorno === 'pruebas' ? `Copia de pruebas desde la rama «${p.rama ?? 'main'}»` : 'Producción: lo que está fusionado en main'], ...(p.nota ? [['Nota', String(p.nota)] as [string, string]] : [])]
  }
  return []
}

export default function ConfirmacionIA({ acciones, ocupada, onDecidir, restantes }: {
  acciones: AccionIA[]; ocupada: string | null; restantes: number
  onDecidir: (a: AccionIA, accion: 'aplicar' | 'rechazar', op?: { siempre?: boolean; razon?: string }) => Promise<void>
}) {
  const a = acciones[0]
  const caja = useRef<HTMLDivElement>(null)
  // El panel y su fondo oscuro se dibujan sobre todo el portal (portal de React); el panel se ancla justo encima del campo de texto
  const ancla = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ l: number; w: number; b: number } | null>(null)
  const [sel, setSel] = useState(0)
  const [razon, setRazon] = useState('')
  const opciones = a ? [SI[a.tipo] ?? 'Sí', ...(AUTO_PERMITIDAS.includes(a.tipo) ? [`Sí, y no preguntar de nuevo para esto en este proyecto`] : []), 'No, y decirle a la IA qué cambiar'] : []
  const ultima = opciones.length - 1
  useEffect(() => { setSel(0); setRazon(''); if (a) caja.current?.focus() }, [a?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!a) return
    const f = () => { const r = ancla.current?.getBoundingClientRect(); if (r) setPos({ l: r.left, w: r.width, b: window.innerHeight - r.top + 8 }) }
    f()
    window.addEventListener('resize', f); window.addEventListener('scroll', f, true)
    const t = setInterval(f, 300)
    return () => { window.removeEventListener('resize', f); window.removeEventListener('scroll', f, true); clearInterval(t) }
  }, [a?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!a) return null
  const ocup = ocupada === a.id

  const decidir = (i: number) => {
    if (ocup) return
    if (i === ultima) void onDecidir(a, 'rechazar', { razon: razon.trim() || undefined })
    else void onDecidir(a, 'aplicar', { siempre: i === 1 && opciones.length === 3 })
  }
  const teclas = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => (s + 1) % opciones.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => (s - 1 + opciones.length) % opciones.length) }
    else if (e.key === 'Enter') { e.preventDefault(); decidir(sel) }
    else if (e.key === 'Escape') { e.preventDefault(); void onDecidir(a, 'rechazar') }
    else if (/^[1-9]$/.test(e.key) && Number(e.key) <= opciones.length) { e.preventDefault(); const i = Number(e.key) - 1; setSel(i); if (i !== ultima) decidir(i) }
  }
  const filas = detalle(a)

  const panel = (
    <div ref={caja} tabIndex={-1} onKeyDown={teclas} role="dialog" aria-modal="true" aria-label="La IA necesita tu confirmación" className="rounded-xl overflow-y-auto outline-none"
      style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(217,119,6,0.55)', boxShadow: '0 8px 48px rgba(0,0,0,0.6)', position: 'fixed', left: pos?.l ?? 0, width: pos?.w ?? 0, bottom: pos?.b ?? 0, maxHeight: `calc(100vh - ${(pos?.b ?? 0) + 16}px)`, zIndex: 61 }}>
      <div className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] text-amber-200 border-b border-white/5">
        <ShieldQuestion size={15} className="flex-shrink-0" />
        <span className="font-medium">La IA necesita tu confirmación</span>
        <span className="text-[#9ca3af]">· {TITULO[a.tipo] ?? a.titulo}</span>
        {restantes > 1 && <span className="ml-auto text-[10px] text-[#9ca3af]">{restantes - 1} más en espera</span>}
      </div>
      <div className="px-3.5 py-2.5">
        <p className="text-[12px] text-gray-100 mb-2">{PREGUNTA[a.tipo] ?? '¿Confirmas esta acción?'}</p>
        {filas.length > 0 && (
          <div className="grid gap-x-3 gap-y-0.5 rounded-lg px-2.5 py-2 mb-2 text-[11px] max-h-[170px] overflow-y-auto" style={{ gridTemplateColumns: '92px 1fr', background: 'rgba(255,255,255,0.04)' }}>
            {filas.map(([k, v], i) => (<Fragment key={i}><span className="text-[#7f8a9c]">{k}</span><span className="text-gray-200 break-words whitespace-pre-line">{v}</span></Fragment>))}
          </div>)}
        {a.tipo === 'FICHA' && a.payload.fuentes && <p className="text-[10px] text-[#7f8a9c] mb-1 line-clamp-2">Fuentes: {String(a.payload.fuentes)}</p>}
        {a.motivo && <p className="text-[10px] text-[#7f8a9c] mb-1">{a.motivo}</p>}
        {SOLO_ADMIN.includes(a.tipo) && <p className="text-[10px] text-[#7f8a9c]">Solo un administrador puede confirmar.</p>}
      </div>
      {opciones.map((t, i) => (
        <div key={t} role="button" tabIndex={-1} onClick={() => { setSel(i); if (i !== ultima) decidir(i) }} onMouseEnter={() => setSel(i)}
          className="flex items-center gap-2.5 px-3.5 py-1.5 text-[12px] cursor-pointer border-t border-white/5" style={{ background: i === sel ? 'rgba(255,255,255,0.06)' : 'transparent', color: i === sel ? '#fcd34d' : '#d1d5db' }}>
          <span className="w-3 text-center">{i === sel ? '›' : ''}</span>
          <span className="font-mono text-[11px] w-3 text-[#7f8a9c]">{i + 1}</span>
          <span>{t}</span>
          {ocup && i === sel && <Loader2 size={11} className="animate-spin ml-auto" />}
        </div>))}
      {sel === ultima && (
        <div className="px-3.5 pb-2.5 pl-[52px]">
          <input value={razon} onChange={e => setRazon(e.target.value)} placeholder="Qué debe cambiar la IA (opcional) y Enter" aria-label="Qué debe cambiar la IA"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); decidir(ultima) } if (e.key === 'Escape') { e.preventDefault(); caja.current?.focus() } }}
            className="w-full rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 bg-black/30 border border-white/10 outline-none focus:border-amber-400/50" />
        </div>)}
      <div className="px-3.5 py-1.5 text-[10px] text-[#6b7686] border-t border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>↑↓ elegir · Enter confirma · {opciones.length > 2 ? '1–' + (opciones.length - 1) + ' atajos · ' : ''}Esc rechaza</div>
    </div>
  )

  return (
    <>
      <div ref={ancla} />
      {pos && typeof document !== 'undefined' && createPortal(
        <>
          <div aria-hidden style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.62)', backdropFilter: 'blur(2px)', zIndex: 60 }} />
          {panel}
        </>, document.body)}
    </>
  )
}
