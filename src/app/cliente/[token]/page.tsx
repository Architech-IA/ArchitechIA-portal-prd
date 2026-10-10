'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Vista {
  nombre: string; empresa: string | null; estado: string; descripcion: string | null; actualizado: string
  fase: { clave: string; estado: string; nombre: string | null } | null
  avance: { total: number; hechas: number }
  hitos: { titulo: string; descripcion: string | null; fechaComprometida: string | null; fechaReal: string | null; estado: string; aceptadoEn: string | null }[]
  cambios: { titulo: string; estado: string; impactoDias: number }[]
}

const f = (v?: string | null) => (v ? new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }) : '—')
const ESTADO_HITO: Record<string, string> = { PENDIENTE: 'Pendiente', CUMPLIDO: 'Entregado', ATRASADO: 'Con retraso' }

/** Seguimiento del proyecto para el cliente: solo lectura, sin sesión, con un enlace personal. No muestra dinero ni nada interno. */
export default function SeguimientoCliente() {
  const { token } = useParams<{ token: string }>()
  const [v, setV] = useState<Vista | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch(`/api/publico/proyecto/${token}`).then(async r => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(r.status === 404 ? 'Este enlace no es válido o ya fue desactivado. Pide uno nuevo a tu contacto en ArchiTechIA.' : d?.error || 'No se pudo cargar el seguimiento.')
      setV(d)
      document.title = `${d.nombre} — Seguimiento`
    }).catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar el seguimiento.'))
  }, [token])

  const pct = v && v.avance.total > 0 ? Math.round((v.avance.hechas / v.avance.total) * 100) : null
  const hoy = new Date().toISOString().slice(0, 10)
  return (
    <main style={{ background: '#f8fafc', color: '#0f172a', minHeight: '100vh', padding: '32px 16px', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        {error && <p style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center' }}>{error}</p>}
        {!v && !error && <p style={{ textAlign: 'center', color: '#64748b' }}>Cargando…</p>}
        {v && (
          <>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Seguimiento del proyecto · ArchiTechIA</p>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: '4px 0 2px' }}>{v.nombre}</h1>
            {v.empresa && <p style={{ margin: 0, color: '#475569' }}>{v.empresa}</p>}
            {v.descripcion && <p style={{ color: '#475569', lineHeight: 1.55 }}>{v.descripcion}</p>}

            <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginTop: 20 }}>
              <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>¿En qué va el proyecto?</h2>
              <p style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}>
                {v.fase?.estado === 'COMPLETADO' ? 'Proyecto completado' : v.fase?.nombre ? `Etapa actual: ${v.fase.nombre}` : 'En preparación'}
              </p>
              {pct !== null && (
                <>
                  <div style={{ height: 10, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: '#0ea5e9' }} /></div>
                  <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>{v.avance.hechas} de {v.avance.total} tareas de construcción terminadas ({pct}%)</p>
                </>
              )}
            </section>

            <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginTop: 16 }}>
              <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Entregas acordadas</h2>
              {v.hitos.length === 0 ? <p style={{ color: '#64748b', margin: 0 }}>Todavía no hay entregas registradas.</p> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead><tr style={{ textAlign: 'left', color: '#64748b', fontSize: 12 }}><th style={{ padding: '6px 8px' }}>Entrega</th><th style={{ padding: '6px 8px' }}>Fecha acordada</th><th style={{ padding: '6px 8px' }}>Estado</th><th style={{ padding: '6px 8px' }}>Aceptada</th></tr></thead>
                    <tbody>
                      {v.hitos.map((h, i) => {
                        const retraso = h.estado === 'PENDIENTE' && !!h.fechaComprometida && h.fechaComprometida.slice(0, 10) < hoy
                        return (
                          <tr key={i} style={{ borderTop: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                            <td style={{ padding: '8px' }}><b>{h.titulo}</b>{h.descripcion && <div style={{ color: '#64748b', fontSize: 12 }}>{h.descripcion}</div>}</td>
                            <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{f(h.fechaComprometida)}</td>
                            <td style={{ padding: '8px', color: h.estado === 'CUMPLIDO' ? '#047857' : retraso || h.estado === 'ATRASADO' ? '#b91c1c' : '#334155' }}>
                              {retraso ? 'Con retraso' : ESTADO_HITO[h.estado] ?? h.estado}{h.estado === 'CUMPLIDO' && h.fechaReal ? ` (${f(h.fechaReal)})` : ''}
                            </td>
                            <td style={{ padding: '8px' }}>{h.aceptadoEn ? `Sí, el ${f(h.aceptadoEn)}` : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {v.cambios.length > 0 && (
              <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginTop: 16 }}>
                <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Cambios acordados al alcance</h2>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                  {v.cambios.map((c, i) => <li key={i}>{c.titulo}{c.impactoDias ? <span style={{ color: '#64748b' }}> — {c.impactoDias > 0 ? '+' : ''}{c.impactoDias} día(s) de plazo</span> : null}</li>)}
                </ul>
              </section>
            )}
            <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 24 }}>Última actualización: {f(v.actualizado)}. Este enlace es personal; no lo compartas fuera de tu equipo.</p>
          </>
        )}
      </div>
    </main>
  )
}
