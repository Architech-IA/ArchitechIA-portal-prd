'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Check, GitPullRequest } from 'lucide-react'
import { api, post, hace } from './api'
import SeccionPruebas from './SeccionPruebas'

// Catálogo de artefactos (MASD-0026-0001): cada documento del proyecto es una instancia de un TIPO con su ficha
// (quién lo produce y aprueba, de qué deriva, dónde vive y cuándo queda obsoleto). Muestra el estado real de cada uno
// y avisa cuando una entrada de la que deriva avanzó de versión.

interface ObsoletoPor { clave: string; nombre: string | null; versionUsada: number; versionActual: number }
interface Instancia { soporte: boolean; existe: boolean; estado: string; version: number | null; actualizado?: string | null; cantidad?: number }
interface TipoFila {
  clave: string; nombre: string; familia: string; descripcion: string | null; faseDuena: string | null
  entradas: string[]; productor: string | null; aprobador: string | null; visibilidad: string; destino: string | null
  consumidores: string[]; vigencia: string | null
  instancia: Instancia; desactualizado: boolean; obsoletoPor: ObsoletoPor[]
  fuente?: { tipo: string }
}
interface Impacto {
  dependientes: { clave: string; nombre: string; nivel: number; existe: boolean; estado: string; desactualizado: boolean }[]
  requisitosCambiados: { id: string; texto: string; motivo: string }[]
  tareas: { taskCode: string | null; title: string; status: string }[]
  pruebas: { reqCodigo: string; titulo: string; estado: string }[]
  resumen: string
}
interface Respuesta { tipos: TipoFila[]; resumen: { tipos: number; conContenido: number; desactualizados: number } }

const FAMILIAS = ['Descubrimiento', 'Especificación', 'Entrega', 'Operación'] as const
const COLOR_FAMILIA: Record<string, string> = { Descubrimiento: '#fbbf24', Especificación: '#818cf8', Entrega: '#34d399', Operación: '#f472b6' }
const ESTADO: Record<string, { txt: string; color: string }> = {
  APROBADO: { txt: 'Aprobado', color: '#34d399' },
  EN_REVISION: { txt: 'En revisión', color: '#fbbf24' },
  BORRADOR: { txt: 'Borrador', color: '#94a3b8' },
  VIGENTE: { txt: 'Vigente', color: '#34d399' },
  EN_NOTA_DE_FASE: { txt: 'En la nota de la fase', color: '#38bdf8' },
  REVISAR: { txt: 'Revisar (caducó)', color: '#fbbf24' },
  CON_ABIERTOS: { txt: 'Con casos abiertos', color: '#fb923c' },
  SIN_CONTENIDO: { txt: 'Sin contenido', color: '#64748b' },
  SIN_SOPORTE: { txt: 'Aún no existe en el portal', color: '#475569' },
}
type Filtro = 'todos' | 'contenido' | 'desactualizados' | 'pendientes'

export default function PanelCatalogo({ proyectoId }: { proyectoId: string }) {
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [marcando, setMarcando] = useState<string | null>(null)
  const [impacto, setImpacto] = useState<Record<string, Impacto>>({})
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function verImpacto(clave: string) {
    setTrabajando(`i:${clave}`); setError(null)
    try { const r = await api<Impacto>(`/api/soluciones/${proyectoId}/catalogo-artefactos/${clave}/impacto`); setImpacto(p => ({ ...p, [clave]: r })) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo calcular el impacto') }
    finally { setTrabajando(null) }
  }

  async function regenerar(clave: string) {
    setTrabajando(`r:${clave}`); setError(null); setAviso(null)
    try {
      const r = await post<{ fase: string; entregable: string }>(`/api/soluciones/${proyectoId}/catalogo-artefactos/${clave}/regenerar`)
      setAviso(`Propuesta lista: ábrela en la fase «${r.fase}», entregable «${r.entregable}», revísala y acéptala. El documento actual no se tocó.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo regenerar') }
    finally { setTrabajando(null) }
  }
  const [exportando, setExportando] = useState(false)
  const [exportado, setExportado] = useState<{ cambios: boolean; pr?: string | null; mensaje?: string; archivos: number } | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try { setDatos(await api<Respuesta>(`/api/soluciones/${proyectoId}/catalogo-artefactos`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer el catálogo') }
    finally { setCargando(false) }
  }, [proyectoId])

  useEffect(() => { void cargar() }, [cargar])

  const nombres = useMemo(() => new Map((datos?.tipos ?? []).map(t => [t.clave, t.nombre])), [datos])

  async function revisado(clave: string) {
    setMarcando(clave)
    try { await post(`/api/soluciones/${proyectoId}/catalogo-artefactos/${clave}/derivar`); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo marcar como revisado') }
    finally { setMarcando(null) }
  }

  async function exportarSpec() {
    setExportando(true); setError(null); setExportado(null)
    try { setExportado(await post(`/api/soluciones/${proyectoId}/spec/exportar`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo exportar la spec') }
    finally { setExportando(false) }
  }

  const visibles = (datos?.tipos ?? []).filter(t => {
    if (filtro === 'contenido') return t.instancia.existe
    if (filtro === 'desactualizados') return t.desactualizado
    if (filtro === 'pendientes') return t.instancia.soporte && !t.instancia.existe
    return true
  })

  if (cargando && !datos) return <div className="p-6 flex justify-center text-[#7f8a9c]"><Loader2 className="animate-spin" size={18} /></div>

  return (
    <div className="p-3 space-y-3">
      {error && <p role="alert" className="text-[11px] text-red-300 rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>{error}</p>}
      {aviso && <p role="status" className="text-[11px] text-emerald-300 rounded-lg px-3 py-2" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>{aviso}</p>}

      {datos && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-[#9aa6b8]">
          <span><b className="text-gray-200">{datos.resumen.conContenido}</b> de {datos.resumen.tipos} con contenido
            {datos.resumen.desactualizados > 0 && <> · <b className="text-amber-300">{datos.resumen.desactualizados} desactualizados</b></>}</span>
          <button onClick={() => void cargar()} aria-label="Actualizar" title="Actualizar" className="p-1 rounded hover:bg-white/5"><RefreshCw size={12} className={cargando ? 'animate-spin' : ''} /></button>
        </div>
      )}

      <div className="rounded-lg px-3 py-2 space-y-1.5" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
        <p className="text-[11px] text-gray-400">La spec aprobada puede vivir también en el repositorio del proyecto (carpeta <code className="text-gray-300">spec/</code>), por pull request. Nunca se mergea sola.</p>
        <button onClick={() => void exportarSpec()} disabled={exportando} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-indigo-100 hover:bg-white/10 disabled:opacity-50" style={{ border: '1px solid rgba(99,102,241,0.45)' }}>
          {exportando ? <Loader2 size={12} className="animate-spin" /> : <GitPullRequest size={12} />}Exportar spec al repositorio
        </button>
        {exportado && (exportado.cambios
          ? <p className="text-[11px] text-emerald-300" role="status">PR listo con {exportado.archivos} archivos. {exportado.pr ? <a href={exportado.pr} target="_blank" rel="noreferrer" className="underline">Abrir el PR</a> : 'Revísalo en GitHub.'}</p>
          : <p className="text-[11px] text-[#9aa6b8]" role="status">{exportado.mensaje ?? 'Sin cambios.'}</p>)}
      </div>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtro del catálogo">
        {([['todos', 'Todos'], ['contenido', 'Con contenido'], ['pendientes', 'Por producir'], ['desactualizados', 'Desactualizados']] as [Filtro, string][]).map(([k, txt]) => (
          <button key={k} role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)} className="px-2 py-1 rounded-full text-[10.5px] transition-colors"
            style={filtro === k ? { background: 'rgba(99,102,241,0.2)', color: '#c7d2fe', border: '1px solid rgba(99,102,241,0.4)' } : { color: '#7f8a9c', border: '1px solid rgba(255,255,255,0.08)' }}>{txt}</button>))}
      </div>

      {FAMILIAS.map(fam => {
        const filas = visibles.filter(t => t.familia === fam)
        if (!filas.length) return null
        return (
          <section key={fam} aria-label={fam}>
            <h3 className="text-[10px] uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: COLOR_FAMILIA[fam] }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR_FAMILIA[fam] }} />{fam}
            </h3>
            <ul className="space-y-1.5">
              {filas.map(t => {
                const est = ESTADO[t.instancia.estado] ?? { txt: t.instancia.estado, color: '#94a3b8' }
                const ab = abierto === t.clave
                return (
                  <li key={t.clave} className="rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.desactualizado ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.06)'}` }}>
                    <button onClick={() => setAbierto(ab ? null : t.clave)} aria-expanded={ab} className="w-full flex items-start gap-2 px-2.5 py-2 text-left">
                      {ab ? <ChevronDown size={13} className="mt-0.5 text-[#7f8a9c] flex-shrink-0" /> : <ChevronRight size={13} className="mt-0.5 text-[#7f8a9c] flex-shrink-0" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] text-gray-100 leading-snug">{t.nombre}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10.5px]">
                          <span style={{ color: est.color }}>● {est.txt}</span>
                          {t.instancia.existe && t.instancia.version != null && t.instancia.version > 0 && <span className="text-[#7f8a9c]">v{t.instancia.version}</span>}
                          {t.visibilidad === 'COMPARTIBLE' && <span className="text-sky-300">compartible</span>}
                          {t.desactualizado && <span className="text-amber-300 inline-flex items-center gap-1"><AlertTriangle size={10} />desactualizado</span>}
                        </span>
                      </span>
                    </button>

                    {ab && (
                      <div className="px-3 pb-2.5 space-y-2 text-[11px] text-[#9aa6b8]">
                        {t.descripcion && <p className="text-gray-300">{t.descripcion}</p>}
                        {t.desactualizado && (
                          <div className="rounded-md px-2 py-1.5" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
                            <p className="text-amber-200">Cambió lo que lo origina:</p>
                            <ul className="mt-0.5 list-disc pl-4 text-amber-100/90">
                              {t.obsoletoPor.map(o => <li key={o.clave}>{o.nombre ?? o.clave} (v{o.versionUsada} → v{o.versionActual})</li>)}
                            </ul>
                            <button onClick={() => void revisado(t.clave)} disabled={marcando === t.clave}
                              className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] text-amber-100 hover:bg-white/10 disabled:opacity-50" style={{ border: '1px solid rgba(251,191,36,0.4)' }}>
                              {marcando === t.clave ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Marcar como revisado
                            </button>
                          </div>)}
                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={() => void verImpacto(t.clave)} disabled={trabajando === `i:${t.clave}`} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] text-gray-200 hover:bg-white/10 disabled:opacity-50" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
                            {trabajando === `i:${t.clave}` && <Loader2 size={11} className="animate-spin" />}Ver impacto de un cambio</button>
                          {t.fuente?.tipo === 'documento_fase' && (
                            <button onClick={() => void regenerar(t.clave)} disabled={trabajando === `r:${t.clave}`} title="La IA redacta una versión actualizada a partir de sus entradas y la deja como propuesta" className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] text-indigo-100 hover:bg-white/10 disabled:opacity-50" style={{ border: '1px solid rgba(99,102,241,0.45)' }}>
                              {trabajando === `r:${t.clave}` && <Loader2 size={11} className="animate-spin" />}Regenerar con IA (propuesta)</button>)}
                        </div>
                        {impacto[t.clave] && (
                          <div className="rounded-md px-2 py-1.5 space-y-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
                            <p className="text-gray-300">{impacto[t.clave].resumen}</p>
                            {impacto[t.clave].dependientes.length > 0 && (
                              <ul className="list-disc pl-4">{impacto[t.clave].dependientes.map(d => <li key={d.clave}>{d.nombre} <span className="text-[#6b7686]">(nivel {d.nivel}{d.existe ? `, ${d.estado.toLowerCase().replace(/_/g, ' ')}` : ', aún sin contenido'}{d.desactualizado ? ', desactualizado' : ''})</span></li>)}</ul>)}
                            {impacto[t.clave].requisitosCambiados.length > 0 && (
                              <div><p className="text-gray-400">Requisitos que cambiaron:</p>
                                <ul className="list-disc pl-4">{impacto[t.clave].requisitosCambiados.map(r => <li key={r.id}><span className="text-amber-300">{r.motivo.toLowerCase()}</span> · {r.texto}</li>)}</ul></div>)}
                            {impacto[t.clave].tareas.length > 0 && <p>Tareas a revisar: {impacto[t.clave].tareas.map(x => x.taskCode ?? x.title).join(', ')}</p>}
                            {impacto[t.clave].pruebas.length > 0 && <p>Pruebas de aceptación a revisar: {impacto[t.clave].pruebas.map(x => `${x.reqCodigo} (${x.estado.toLowerCase()})`).join(', ')}</p>}
                          </div>)}
                        <dl className="grid grid-cols-[84px_1fr] gap-x-2 gap-y-1">
                          {t.faseDuena && <><dt className="text-[#6b7686]">Fase dueña</dt><dd>{t.faseDuena}</dd></>}
                          {t.productor && <><dt className="text-[#6b7686]">Lo produce</dt><dd>{t.productor}</dd></>}
                          {t.aprobador && <><dt className="text-[#6b7686]">Lo aprueba</dt><dd>{t.aprobador}</dd></>}
                          {t.destino && <><dt className="text-[#6b7686]">Destino</dt><dd>{t.destino}</dd></>}
                          {t.entradas.length > 0 && <><dt className="text-[#6b7686]">Deriva de</dt><dd>{t.entradas.map(e => nombres.get(e) ?? e).join(', ')}</dd></>}
                          {t.consumidores.length > 0 && <><dt className="text-[#6b7686]">Lo usan</dt><dd>{t.consumidores.map(e => nombres.get(e) ?? e).join(', ')}</dd></>}
                          {t.vigencia && <><dt className="text-[#6b7686]">Vigencia</dt><dd>{t.vigencia}</dd></>}
                          {t.instancia.actualizado && <><dt className="text-[#6b7686]">Actualizado</dt><dd>{hace(t.instancia.actualizado)}</dd></>}
                        </dl>
                      </div>)}
                  </li>)
              })}
            </ul>
          </section>)
      })}

      <SeccionPruebas proyectoId={proyectoId} />

      {datos && visibles.length === 0 && <p className="text-[11px] text-[#7f8a9c] text-center py-4">Ningún artefacto coincide con este filtro.</p>}
    </div>
  )
}
