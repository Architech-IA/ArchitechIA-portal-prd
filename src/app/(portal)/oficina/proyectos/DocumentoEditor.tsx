'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePageTitleOverride } from '@/lib/pageTitleContext'
import { Send, X, Save, History, Sparkles, Download, Loader2, Check, RotateCcw, ExternalLink, Printer, Settings, RefreshCw } from 'lucide-react'
import ConfigPlantilla, { TIPOS_PLANTILLA } from './ConfigPlantilla'
import PanelRico, { aHtml, imprimir } from './PanelRico'
import { RichToolbar } from '../../solutions/pilots/[id]/EditorRico'
import { api, post, put, hace } from './api'
import { TIPOS, CANALES } from '@/lib/documentos/tipos'

// Documento de un entregable que se escribe y se edita en el portal (Markdown). El archivo Word, PDF, HTML o MD sale de este texto cuando alguien lo descarga.

interface Doc { existe: boolean; titulo: string; contenido: string; version: number; propuesta: string | null; propuestaPor: string | null; propuestaEn: string | null; actualizadoPor: string | null; updatedAt: string | null; plantilla?: boolean; tipoPlantilla?: string }
interface Ver { version: number; porNombre: string | null; nota: string | null; chars: number; createdAt: string }

export default function DocumentoEditor({ proyectoId, fase, clave, titulo, editable, sesionId, onCerrar, onCambio, pagina }: {
  pagina?: boolean; proyectoId: string; fase: string; clave: string; titulo: string; editable: boolean; sesionId?: string; onCerrar: () => void; onCambio: () => void
}) {
  const base = `/api/proyectos/${proyectoId}/documentos/${fase}/${clave}`
  const [doc, setDoc] = useState<Doc | null>(null)
  const [verConfig, setVerConfig] = useState(false)
  const [refrescando, setRefrescando] = useState(false)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [decidiendo, setDecidiendo] = useState(false)
  const [verProp, setVerProp] = useState(false)
  const [versiones, setVersiones] = useState<Ver[] | null>(null)
  const [panelVer, setPanelVer] = useState(false)
  const [menuDesc, setMenuDesc] = useState(false)
  const [envio, setEnvio] = useState(false)
  const [envCanal, setEnvCanal] = useState<string>('Correo')
  const [envFecha, setEnvFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [envTipo, setEnvTipo] = useState(() => (fase === 'propuesta' || /propuesta|cotiz|oferta/i.test(`${titulo} ${clave}`) ? 'Propuesta' : 'Otro'))
  const [enviando, setEnviando] = useState(false)
  const [registrado, setRegistrado] = useState<{ id: string; version: number } | null>(null)
  const sucio = !!doc && texto !== doc.contenido
  const abrirPestaña = () => {
    if (sucio && !window.confirm('Hay cambios sin guardar. ¿Abrirlo igualmente en la vista completa y descartarlos?')) return
    window.dispatchEvent(new CustomEvent('abrir-documento', { detail: { proyectoId, fase, clave, titulo } }))
    onCerrar()
  }

  const cargar = useCallback(async () => {
    try { const d = await api<Doc>(base); setDoc(d); setTexto(d.contenido); setVerProp(!!d.propuesta && !d.contenido.trim()); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir el documento') }
  }, [base])
  useEffect(() => { void cargar() }, [cargar])

  async function guardar(nota?: string) {
    if (!doc || !editable || guardando) return
    setGuardando(true); setError(''); setAviso('')
    try {
      const d = await put<Doc>(base, { contenido: texto, version: doc.version, nota })
      setDoc(d); setTexto(d.contenido); setVersiones(null); setAviso(`Guardado · versión ${d.version}`); onCambio()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setGuardando(false) }
  }

  // Ctrl+S guarda y Esc cierra (con aviso si hay cambios)
  useEffect(() => {
    const t = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void guardar() }
    }
    window.addEventListener('keydown', t); return () => window.removeEventListener('keydown', t)
  })

  function cerrar() {
    if (sucio && !window.confirm('Hay cambios sin guardar. ¿Cerrar y descartarlos?')) return
    onCerrar()
  }
  // En la vista de página, la barra superior muestra una flecha de volver que hace lo mismo que «Volver al proyecto».
  const { setBack } = usePageTitleOverride()
  const cerrarRef = useRef(cerrar)
  cerrarRef.current = cerrar
  const [pedirIa, setPedirIa] = useState(0) // orden de abrir el Agente Documentador (la atiende PanelRico)
  useEffect(() => {
    if (!pagina) return
    setBack(() => cerrarRef.current())
    return () => setBack(null)
  }, [pagina, setBack])


  async function decidir(accion: 'aceptar' | 'rechazar') {
    if (accion === 'aceptar' && sucio && !window.confirm('Aceptar la propuesta reemplaza el texto del documento, incluidos tus cambios sin guardar. La versión actual queda en el historial. ¿Continuar?')) return
    setDecidiendo(true); setError(''); setAviso('')
    try {
      const d = await post<Doc>(`${base}/propuesta`, { accion })
      setDoc(d); setTexto(d.contenido); setVerProp(false); setVersiones(null)
      setAviso(accion === 'aceptar' ? `Propuesta aceptada · versión ${d.version}` : 'Propuesta rechazada'); if (accion === 'aceptar') onCambio()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la decisión') } finally { setDecidiendo(false) }
  }

  // «Marcar como enviada»: congela el texto guardado en el repositorio de Documentos. Solo una persona lo hace.
  async function marcarEnviada() {
    setEnviando(true); setError(''); setAviso('')
    try {
      const r = await post<{ id: string; version: number }>('/api/repositorio-docs/enviar', { solucionId: proyectoId, faseClave: fase, entregableClave: clave, canal: envCanal, fecha: envFecha, tipo: envTipo })
      setRegistrado(r); setEnvio(false); setAviso(`Registrada como enviada · versión ${r.version} en Documentos`)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar el envío') } finally { setEnviando(false) }
  }

  async function abrirVersiones() {
    setPanelVer(o => !o)
    if (!versiones) { try { setVersiones(await api<Ver[]>(`${base}/versiones`)) } catch { setVersiones([]) } }
  }

  async function verVersion(n: number) {
    try { const v = await api<{ contenido: string }>(`${base}/versiones/${n}`); if (sucio && !window.confirm('Hay cambios sin guardar; se reemplazan por esa versión en el editor (no se guarda hasta que pulses Guardar). ¿Continuar?')) return; setTexto(v.contenido); setAviso(`Estás viendo la versión ${n}. Pulsa Guardar para dejarla como la versión actual.`) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir esa versión') }
  }

  async function restaurar(n: number) {
    if (!window.confirm(`Se restaura la versión ${n} como versión nueva. Nada se pierde: la actual queda en el historial. ¿Continuar?`)) return
    try { const d = await post<Doc>(`${base}/restaurar`, { version: n }); setDoc(d); setTexto(d.contenido); setVersiones(null); setPanelVer(false); setAviso(`Versión ${n} restaurada · versión ${d.version}`); onCambio() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo restaurar') }
  }

  function descargar(formato: string) {
    setMenuDesc(false)
    if (!doc?.existe || !doc.contenido.trim()) { setError('Guarda el documento con algo de texto antes de descargarlo.'); return }
    if (sucio) { setError('Tienes cambios sin guardar: la descarga usa la última versión guardada. Guarda primero.'); return }
    window.location.href = `${base}/exportar?formato=${formato}`
  }

  const mostrado = useMemo(() => (verProp && doc?.propuesta ? doc.propuesta : texto), [verProp, doc?.propuesta, texto])
  const valorHtml = useMemo(() => aHtml(mostrado), [mostrado])
  const btn = 'flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg disabled:opacity-40 flex-shrink-0'

  return (
    <div className={pagina ? 'flex-1 min-h-0 flex flex-col' : 'fixed inset-0 z-50 flex items-center justify-center p-4'} style={pagina ? undefined : { background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)' }}>
      <div className={pagina ? 'w-full flex-1 min-h-0 flex flex-col overflow-hidden' : 'w-full max-w-6xl h-full max-h-[92vh] flex flex-col overflow-hidden'} style={pagina ? { background: 'rgba(15,23,42,0.85)' } : { background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, boxShadow: '0 8px 64px rgba(0,0,0,0.6)' }}>
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 flex-shrink-0" style={{ background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-[15px] font-bold text-gray-100 truncate min-w-0">{titulo}</h2>
          {doc && <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }}>{doc.existe ? `Versión ${doc.version}` : 'Sin guardar'}</span>}
          {doc && <button onClick={() => setVerConfig(true)} aria-label="Configuración del documento" title={`Plantilla: ${doc.plantilla === false ? 'sin plantilla' : TIPOS_PLANTILLA.find(t => t.v === (doc.tipoPlantilla ?? 'documento'))?.t ?? 'Documento'}`} className="flex-shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-white" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}><Settings size={12} /></button>}
          {verConfig && doc && <ConfigPlantilla plantilla={doc.plantilla !== false} tipo={doc.tipoPlantilla ?? 'documento'} onCerrar={() => setVerConfig(false)} guardar={async (p, t) => { if (!doc.existe) throw new Error('Guarda el documento una vez antes de configurar su plantilla'); const d = await put<Doc>(`${base}/config`, { plantilla: p, tipo: t }); setDoc(prev => prev ? { ...prev, plantilla: d.plantilla, tipoPlantilla: d.tipoPlantilla } : prev) }} />}
          {sucio && <span className="text-[10px] text-amber-300 flex-shrink-0">Cambios sin guardar</span>}
          <span className="flex-1" />
          {editable && !(verProp && !!doc?.propuesta) && <RichToolbar />}
          <span className="flex-1" />
          {editable && !(verProp && !!doc?.propuesta) && <button onClick={() => void guardar()} disabled={!sucio || guardando} aria-label="Guardar cambios" title={guardando ? 'Guardando…' : 'Guardar cambios'} className={`${btn} text-white`} style={{ background: 'rgba(8,145,178,0.85)' }}>{guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}</button>}
          {editable && doc?.existe && doc.contenido.trim() && <button onClick={() => { if (sucio) { setError('Guarda los cambios antes de marcarla como enviada: se registra la última versión guardada.'); return } setEnvio(true) }} title="Congela una copia en Documentos como enviada al cliente" className={`${btn} text-white`} style={{ background: 'rgba(16,185,129,0.65)' }}><Send size={11} /> Marcar como enviada</button>}
          <button onClick={async () => { if (sucio && !window.confirm('Hay cambios sin guardar. ¿Recargar el documento desde el servidor y descartarlos?')) return; setRefrescando(true); setVersiones(null); await cargar(); setRefrescando(false); setAviso('Documento recargado') }} disabled={refrescando} aria-label="Recargar el documento" title="Recargar el documento desde el servidor" className={`${btn} text-gray-200 disabled:opacity-50`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}><RefreshCw size={13} className={refrescando ? 'animate-spin' : ''} /></button>
          <button onClick={() => void abrirVersiones()} aria-label="Historial de versiones" title="Versiones" className={`${btn} text-gray-200`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}><History size={13} /></button>
          <div className="relative">
            <button onClick={() => setMenuDesc(o => !o)} aria-label="Descargar como" aria-haspopup="menu" aria-expanded={menuDesc} title="Descargar como" className={`${btn} text-gray-200`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}><Download size={13} /></button>
            {menuDesc && (
              <div className="absolute right-0 top-full mt-1.5 z-30 w-44 rounded-xl overflow-hidden" style={{ background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                {[['docx', 'Word (.docx)'], ['pdf', 'PDF (.pdf)'], ['html', 'HTML (.html)'], ['md', 'Markdown (.md)']].map(([f, t]) => (
                  <button key={f} onClick={() => descargar(f)} className="w-full text-left px-3 py-2 text-[12px] text-gray-100 hover:bg-white/5 border-b border-white/5 last:border-b-0">{t}</button>))}
                <button onClick={() => { setMenuDesc(false); imprimir(titulo, valorHtml) }} className="w-full text-left px-3 py-2 text-[12px] text-gray-100 hover:bg-white/5 flex items-center gap-2"><Printer size={12} /> Imprimir / PDF</button>
              </div>)}
          </div>
          {editable && !(verProp && !!doc?.propuesta) && <button onClick={() => setPedirIa(n => n + 1)} title="Trabajar el documento completo con el Agente Documentador: generar con preguntas o mejorarlo" className={`${btn} text-cyan-300`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}><Sparkles size={12} /> Agente</button>}
          {!pagina && <button onClick={abrirPestaña} title="Abrir el documento a pantalla completa dentro del proyecto" className={`${btn} text-gray-200`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}><ExternalLink size={11} /> Abrir completo</button>}
          {pagina ? null : <button onClick={cerrar} aria-label="Cerrar" title="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>}
        </div>

        {doc?.propuesta && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-2 flex-shrink-0" style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.25)' }}>
            <Sparkles size={12} className="text-amber-300" />
            <p className="text-[11px] text-amber-200 flex-1">La IA propuso una versión{doc.propuestaPor ? ` (pedida por ${doc.propuestaPor}${doc.propuestaEn ? `, ${hace(doc.propuestaEn)}` : ''})` : ''}. No cambia nada hasta que la aceptes.</p>
            <button onClick={() => setVerProp(v => !v)} className={`${btn} text-gray-200`} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>{verProp ? 'Ver mi texto' : 'Ver la propuesta'}</button>
            {editable && <>
              <button onClick={() => void decidir('aceptar')} disabled={decidiendo} className={`${btn} text-white`} style={{ background: 'rgba(16,185,129,0.7)' }}><Check size={11} /> Aceptar</button>
              <button onClick={() => void decidir('rechazar')} disabled={decidiendo} className={`${btn} text-gray-300 border border-white/10`}>Rechazar</button>
            </>}
          </div>)}

        {(error || aviso) && <p className="px-5 py-1.5 text-[11px] flex-shrink-0" style={{ color: error ? '#fca5a5' : '#6ee7b7' }}>{error || aviso}{!error && registrado && <> · <a href={`/documentos?doc=${registrado.id}`} className="underline">Ver en Documentos</a></>}</p>}

        {envio && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={e => { if (e.target === e.currentTarget) setEnvio(false) }}>
            <div className="w-full max-w-sm p-5 space-y-3" style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16 }}>
              <style>{'select option{background:#0f172a;color:#e5e7eb}'}</style>
              <h3 className="text-[15px] font-bold text-gray-100">Marcar como enviada</h3>
              <p className="text-[11px] text-[#7f8a9c]">Se guarda en Documentos una copia congelada de la versión {doc?.version}. Después no se edita: se corrige con una versión nueva.</p>
              <label className="block text-[12px] text-[#7f8a9c]">Tipo<select value={envTipo} onChange={e => setEnvTipo(e.target.value)} className="w-full mt-1 text-[13px] text-gray-100 px-2.5 py-2 bg-transparent outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, colorScheme: 'dark' }}>{TIPOS.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
              <label className="block text-[12px] text-[#7f8a9c]">Canal<select value={envCanal} onChange={e => setEnvCanal(e.target.value)} className="w-full mt-1 text-[13px] text-gray-100 px-2.5 py-2 bg-transparent outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, colorScheme: 'dark' }}>{CANALES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
              <label className="block text-[12px] text-[#7f8a9c]">Fecha de envío<input type="date" value={envFecha} max={new Date().toISOString().slice(0, 10)} onChange={e => setEnvFecha(e.target.value)} className="w-full mt-1 text-[13px] text-gray-100 px-2.5 py-2 bg-transparent outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }} /></label>
              <div className="flex justify-end gap-2 pt-1"><button onClick={() => setEnvio(false)} className="text-[12px] px-3 py-1.5 rounded-lg text-gray-300" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>Cancelar</button><button onClick={() => void marcarEnviada()} disabled={enviando} className="text-[12px] px-3 py-1.5 rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: 'rgba(16,185,129,0.75)' }}>{enviando ? 'Guardando…' : 'Confirmar envío'}</button></div>
            </div>
          </div>)}

        {!doc && !error && <div className="flex-1 flex items-center justify-center text-[#7f8a9c]"><Loader2 size={18} className="animate-spin" /></div>}
        {doc && (
          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0 min-h-0 flex flex-col"><PanelRico marca={doc.plantilla !== false} proyectoId={proyectoId} fase={fase} clave={clave} valor={valorHtml} onCambio={setTexto} soloLectura={!editable || (verProp && !!doc.propuesta)} puedeEditar={editable && !(verProp && !!doc.propuesta)} sucio={sucio} guardando={guardando} onGuardar={() => void guardar()} pedirIa={pedirIa} titulo={titulo} leyenda={verProp && doc.propuesta ? 'Estás viendo la propuesta de la IA (solo lectura)' : undefined} /></div>
            {panelVer && (
              <div className="w-64 flex-shrink-0 border-l border-white/10 overflow-y-auto p-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c]">Historial de versiones</p>
                {!versiones && <Loader2 size={13} className="animate-spin text-[#7f8a9c]" />}
                {versiones && versiones.length === 0 && <p className="text-[11px] text-[#7f8a9c]">Todavía no hay versiones guardadas.</p>}
                {(versiones ?? []).map(v => (
                  <div key={v.version} className="rounded-lg p-2 space-y-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[12px] text-gray-100">v{v.version}{doc.version === v.version ? ' · actual' : ''}</p>
                    <p className="text-[10px] text-[#7f8a9c]">{v.porNombre ?? '—'} · {hace(v.createdAt)} · {v.chars.toLocaleString('es-CO')} car.</p>
                    {v.nota && <p className="text-[10px] text-gray-300">{v.nota}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => void verVersion(v.version)} className="text-[10px] text-indigo-300 hover:text-indigo-200">Ver</button>
                      {editable && doc.version !== v.version && <button onClick={() => void restaurar(v.version)} className="flex items-center gap-0.5 text-[10px] text-indigo-300 hover:text-indigo-200"><RotateCcw size={9} /> Restaurar</button>}
                    </div>
                  </div>))}
              </div>)}
          </div>)}
      </div>
    </div>
  )
}
