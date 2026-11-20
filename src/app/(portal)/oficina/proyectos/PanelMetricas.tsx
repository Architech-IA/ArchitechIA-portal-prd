'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Info } from 'lucide-react'
import { api, put } from './api'

// Métricas del proyecto y nivel de autonomía por fase (MASD-0026-0009). Todo sale de lo que el portal ya guarda; lo que aún
// no se mide se declara en «Sin dato». El nivel es una declaración del equipo: no hace que el motor avance solo.

interface Fase { fase: string; accion: string; entro: string | null; dias: number | null }
interface Metricas {
  ejecuciones: { total: number; hechas: number; fallidas: number; enCurso: number }
  primerIntento: { tareas: number; ok: number; tasa: number }
  consumo: { tokens: number; minutosAgente: number }
  backlog: Record<string, number>
  propuestasDeCambio: Record<string, number>
  artefactos: { conContenido: number; desactualizados: number }
  operacion?: { incidentes: { abiertos: number; cerrados: number; criticosAbiertos: number }; solicitudes: { abiertas: number; cerradas: number } }
  fases: Fase[]
  sugerencia: { nivel: string; motivos: string[] }
  sinDato: string[]
}
interface FaseNivel { clave: string; nombre: string; bloque: string; nivel: string; porDefecto: boolean }
interface Autonomia { fases: FaseNivel[]; niveles: string[]; sugerencia: { nivel: string; motivos: string[] }; nota: string }

const NIVEL: Record<string, { txt: string; color: string }> = {
  ASISTIDA: { txt: 'Asistida', color: '#94a3b8' },
  SUPERVISADA: { txt: 'Supervisada', color: '#fbbf24' },
  AUTONOMA: { txt: 'Autónoma', color: '#34d399' },
}
const fmt = (n: number) => new Intl.NumberFormat('es-CO').format(n)
const humano = (clave: string) => { const t = clave.replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1) }

export default function PanelMetricas({ proyectoId }: { proyectoId: string }) {
  const [m, setM] = useState<Metricas | null>(null)
  const [a, setA] = useState<Autonomia | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const [mm, aa] = await Promise.all([api<Metricas>(`/api/proyectos/${proyectoId}/metricas`), api<Autonomia>(`/api/proyectos/${proyectoId}/autonomia`)])
      setM(mm); setA(aa)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron leer las métricas') }
    finally { setCargando(false) }
  }, [proyectoId])

  useEffect(() => { void cargar() }, [cargar])

  async function fijar(fase: string, nivel: string) {
    setGuardando(fase); setError(null)
    try { await put(`/api/proyectos/${proyectoId}/autonomia/${fase}`, { nivel }); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el nivel') }
    finally { setGuardando(null) }
  }

  if (cargando && !m) return <div className="p-6 flex justify-center text-[#7f8a9c]"><Loader2 className="animate-spin" size={18} /></div>

  const tasa = m ? Math.round(m.primerIntento.tasa * 100) : 0
  return (
    <div className="p-3 space-y-3">
      {error && <p role="alert" className="text-[11px] text-red-300 rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>{error}</p>}
      <div className="flex items-center justify-between text-[11px] text-[#9aa6b8]">
        <span>Lo que el portal ya mide de este proyecto</span>
        <button onClick={() => void cargar()} aria-label="Actualizar" title="Actualizar" className="p-1 rounded hover:bg-white/5"><RefreshCw size={12} className={cargando ? 'animate-spin' : ''} /></button>
      </div>

      {m && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {[
              { k: 'Primer intento', v: m.primerIntento.tareas ? `${tasa}%` : '—', s: `${m.primerIntento.ok} de ${m.primerIntento.tareas} tareas` },
              { k: 'Ejecuciones', v: fmt(m.ejecuciones.total), s: `${m.ejecuciones.hechas} hechas · ${m.ejecuciones.fallidas} fallidas` },
              { k: 'Tokens', v: fmt(m.consumo.tokens), s: `${fmt(m.consumo.minutosAgente)} min de agente` },
              { k: 'Artefactos', v: `${m.artefactos.conContenido}`, s: m.artefactos.desactualizados ? `${m.artefactos.desactualizados} desactualizados` : 'ninguno desactualizado' },
            ].map(x => (
              <div key={x.k} className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] uppercase tracking-wider text-[#7f8a9c]">{x.k}</p>
                <p className="text-[20px] font-semibold text-gray-100 tabular-nums leading-tight">{x.v}</p>
                <p className="text-[10.5px] text-[#9aa6b8]">{x.s}</p>
              </div>))}
          </div>

          {Object.keys(m.propuestasDeCambio).length > 0 && (
            <p className="text-[11px] text-[#9aa6b8]">Propuestas de cambio: {Object.entries(m.propuestasDeCambio).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ')}</p>)}

          {m.operacion && (m.operacion.incidentes.abiertos + m.operacion.incidentes.cerrados + m.operacion.solicitudes.abiertas + m.operacion.solicitudes.cerradas) > 0 && (
            <p className="text-[11px] text-[#9aa6b8]">Operación: <b className="text-gray-200">{m.operacion.incidentes.abiertos}</b> incidente(s) abiertos{m.operacion.incidentes.criticosAbiertos > 0 && <b className="text-red-300"> ({m.operacion.incidentes.criticosAbiertos} críticos o altos)</b>}, {m.operacion.incidentes.cerrados} cerrados · <b className="text-gray-200">{m.operacion.solicitudes.abiertas}</b> solicitud(es) de cambio abiertas, {m.operacion.solicitudes.cerradas} cerradas.</p>)}

          {m.fases.length > 0 && (
            <section aria-label="Tiempo por fase">
              <h3 className="text-[10px] uppercase tracking-wider font-semibold text-[#7f8a9c] mb-1.5">Tiempo en cada fase</h3>
              <ul className="space-y-1 text-[11.5px]">
                {m.fases.map((f, i) => (
                  <li key={i} className="flex justify-between gap-2 text-gray-300"><span className="truncate">{humano(f.fase)}{f.accion === 'COMPLETADO' ? ' · cierre del proyecto' : ''}</span><span className="text-[#9aa6b8] tabular-nums flex-shrink-0">{f.accion === 'COMPLETADO' ? '—' : f.dias != null ? `${f.dias} d` : 'en curso'}</span></li>))}
              </ul>
            </section>)}
        </>
      )}

      {a && (
        <section aria-label="Autonomía por fase">
          <h3 className="text-[10px] uppercase tracking-wider font-semibold text-[#7f8a9c] mb-1.5">Autonomía por fase</h3>
          <div className="rounded-lg px-3 py-2 mb-2 text-[11px] text-gray-300" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
            <p><b>Sugerencia de los datos:</b> <span style={{ color: NIVEL[a.sugerencia.nivel]?.color }}>{NIVEL[a.sugerencia.nivel]?.txt ?? a.sugerencia.nivel}</span></p>
            <ul className="mt-1 list-disc pl-4 text-[#9aa6b8]">{a.sugerencia.motivos.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
          {a.fases.length === 0
            ? <p className="text-[11px] text-[#7f8a9c]">El proyecto no tiene el motor de fases iniciado.</p>
            : (
              <ul className="space-y-1">
                {a.fases.map(f => (
                  <li key={f.clave} className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="truncate text-gray-300">{f.nombre}</span>
                    <select value={f.nivel} disabled={guardando === f.clave} onChange={e => void fijar(f.clave, e.target.value)} aria-label={`Nivel de autonomía de ${f.nombre}`}
                      className="bg-transparent rounded px-1.5 py-1 text-[11px] flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.12)', color: NIVEL[f.nivel]?.color }}>
                      {a.niveles.map(n => <option key={n} value={n} style={{ color: '#111' }}>{NIVEL[n]?.txt ?? n}{f.porDefecto && n === f.nivel ? ' (por defecto)' : ''}</option>)}
                    </select>
                  </li>))}
              </ul>)}
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] text-[#7f8a9c]"><Info size={12} className="mt-0.5 flex-shrink-0" />{a.nota}</p>
        </section>)}

      {m && m.sinDato.length > 0 && (
        <section aria-label="Sin dato">
          <h3 className="text-[10px] uppercase tracking-wider font-semibold text-[#7f8a9c] mb-1">Aún sin dato</h3>
          <ul className="list-disc pl-4 text-[10.5px] text-[#7f8a9c]">{m.sinDato.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </section>)}
    </div>
  )
}
