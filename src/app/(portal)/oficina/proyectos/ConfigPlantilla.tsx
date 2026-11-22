'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2 } from 'lucide-react'

// Popup de configuración de la plantilla de un documento: si lleva la marca de ArchiTechIA y de qué tipo es.
export const TIPOS_PLANTILLA: { v: string; t: string; d: string }[] = [
  { v: 'documento', t: 'Documento', d: 'Texto general del proyecto' },
  { v: 'briefing', t: 'Briefing', d: 'Resumen previo a una reunión o contacto' },
  { v: 'acta', t: 'Acta', d: 'Registro de una reunión y sus acuerdos' },
  { v: 'propuesta', t: 'Propuesta', d: 'Propuesta técnica o comercial (llevará portada)' },
]

export default function ConfigPlantilla({ plantilla, tipo, guardar, onCerrar }: {
  plantilla: boolean; tipo: string; guardar: (plantilla: boolean, tipo: string) => Promise<void>; onCerrar: () => void
}) {
  const [conPlantilla, setConPlantilla] = useState(plantilla)
  const [tipoSel, setTipoSel] = useState(tipo)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (typeof document === 'undefined') return null

  async function aplicar() {
    setTrabajando(true); setError(null)
    try { await guardar(conPlantilla, tipoSel); onCerrar() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setTrabajando(false) }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(20px)', padding: 16 }} onClick={onCerrar}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)', padding: 28, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', margin: '-28px -28px 20px -28px', padding: '20px 28px', borderRadius: '24px 24px 0 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Configuración del documento</h2>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 15, width: 30, height: 30 }}>×</button>
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-5">
          <input type="checkbox" checked={conPlantilla} onChange={e => setConPlantilla(e.target.checked)} style={{ marginTop: 3, accentColor: '#f97316', width: 16, height: 16 }} />
          <span>
            <span className="block text-[13px] font-semibold text-gray-100">Usar la plantilla de ArchiTechIA</span>
            <span className="block text-[11px] text-[#7f8a9c] mt-0.5">Hoja con curva y logo, tipografía y colores de marca, tablas y pie con página. Aplica al editor y a la exportación a Word.</span>
          </span>
        </label>

        <p style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tipo de documento</p>
        <div className="space-y-1.5">
          {TIPOS_PLANTILLA.map(t => {
            const sel = tipoSel === t.v
            return (
              <button key={t.v} type="button" onClick={() => setTipoSel(t.v)} className={'w-full flex items-start gap-2 text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ' + (sel ? 'bg-orange-500/15 border-orange-500/50' : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.09] hover:border-orange-400/40')}>
                <span className="mt-0.5 flex-shrink-0" style={{ width: 14, height: 14, borderRadius: 7, border: '1px solid ' + (sel ? '#fb923c' : 'rgba(255,255,255,0.25)'), background: sel ? '#fb923c' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sel && <Check size={9} color="#fff" />}</span>
                <span><span className="block text-[12px] text-gray-100">{t.t}</span><span className="block text-[10px] text-[#7f8a9c]">{t.d}</span></span>
              </button>)
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22 }}>
          <span style={{ flex: 1, fontSize: 11, color: '#fca5a5' }}>{error}</span>
          <button onClick={onCerrar} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#94a3b8', fontSize: 11 }}>Cancelar</button>
          <button onClick={() => void aplicar()} disabled={trabajando} className="flex items-center gap-1.5 disabled:opacity-50" style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 11 }}>
            {trabajando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}Guardar</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
