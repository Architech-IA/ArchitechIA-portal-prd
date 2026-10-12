'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api, post } from './api'

// Punto de entrada para empezar un proyecto comercial desde Proyectos: con estos pocos datos se registra el lead (y su empresa), se crea el proyecto y arranca el motor en la fase 1.
interface Usuario { id: string; name: string; email?: string }
interface Parecida { id: string; nombre: string; razonSocial: string | null; nit: string | null }
const FUENTES = ['Referido', 'Sitio web', 'LinkedIn', 'Evento', 'Llamada en frío', 'Alianza', 'Cliente existente', 'Otro']
const TIPOS = [['Project', 'Proyecto'], ['Presales', 'Preventa'], ['Demo', 'Demo'], ['Partnership', 'Alianza']] as const
const etiq: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }
const campo: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#f1f5f9', outline: 'none', width: '100%', padding: '8px 12px', fontSize: 11 }
const opcion: React.CSSProperties = { background: '#0f172a' }

export default function NuevoProyecto({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (solucionId: string) => void }) {
  const [f, setF] = useState({ companyName: '', contactName: '', email: '', phone: '', source: '', userId: '', estimatedValue: '', scope: '', solucionAsociada: 'Project' })
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [parecidas, setParecidas] = useState<Parecida[]>([])
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    Promise.all([api<Usuario[]>('/api/users').catch(() => []), fetch('/api/auth/session').then(r => r.json()).catch(() => null)]).then(([u, s]) => {
      const lista = Array.isArray(u) ? u : []; setUsuarios(lista)
      const yo = lista.find(x => x.email && s?.user?.email && x.email.toLowerCase() === String(s.user.email).toLowerCase())
      if (yo) setF(p => ({ ...p, userId: yo.id }))
    })
  }, [])

  const cambiar = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }))
  function nombre(v: string) {
    cambiar({ companyName: v })
    if (t.current) clearTimeout(t.current)
    if (v.trim().length < 3) { setParecidas([]); return }
    t.current = setTimeout(() => { api<Parecida[]>(`/api/fases/clientes?q=${encodeURIComponent(v.trim())}`).then(setParecidas).catch(() => setParecidas([])) }, 300)
  }
  const exacta = parecidas.find(p => p.nombre.trim().toLowerCase() === f.companyName.trim().toLowerCase())
  const completo = f.companyName.trim() && f.contactName.trim() && /^\S+@\S+\.\S+$/.test(f.email.trim()) && f.source && f.userId

  async function crear() {
    if (!completo) return
    setCreando(true); setError('')
    try {
      const valor = Number(f.estimatedValue.replace(/[^\d]/g, '')) || 0
      const r = await post<{ solucionId?: string }>('/api/leads', { companyName: f.companyName.trim(), contactName: f.contactName.trim(), email: f.email.trim(), phone: f.phone.trim() || null, source: f.source, userId: f.userId, estimatedValue: valor, scope: f.scope.trim() || null, solucionAsociada: f.solucionAsociada, status: 'NEW' })
      if (!r.solucionId) { setError('Se registró el lead, pero no se pudo crear el proyecto. Un administrador puede iniciarlo desde Oficina › Motor.'); setCreando(false); return }
      onCreado(r.solucionId)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el proyecto'); setCreando(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(20px)', padding: 16 }}>
      <div style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)', padding: 28, width: '100%', maxWidth: 760, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', margin: '-28px -28px 24px -28px', padding: '20px 28px', borderRadius: '24px 24px 0 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.01em' }}>Nuevo proyecto</h2>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 15, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 }}>Con estos datos se registra el lead y su empresa, se crea el proyecto y arranca el motor en la fase 1. La ficha del cliente queda llena con lo que escribas aquí para completarla después.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={etiq}>Empresa <span style={{ color: '#f87171' }}>*</span></label>
            <input value={f.companyName} onChange={e => nombre(e.target.value)} style={campo} autoFocus />
            {exacta && <p style={{ fontSize: 10, color: '#fcd34d', margin: '4px 0 0' }}>Ya existe la empresa «{exacta.nombre}»: se reutiliza, no se duplica.</p>}
            {!exacta && parecidas.length > 0 && <p style={{ fontSize: 10, color: '#94a3b8', margin: '4px 0 0' }}>Empresas parecidas: {parecidas.slice(0, 3).map(p => p.nombre).join(' · ')}. Si es una de ellas, escribe su nombre exacto para reutilizarla.</p>}
          </div>
          <div><label style={etiq}>Tipo</label>
            <select value={f.solucionAsociada} onChange={e => cambiar({ solucionAsociada: e.target.value })} style={campo}>{TIPOS.map(([v, l]) => <option key={v} value={v} style={opcion}>{l}</option>)}</select></div>
          <div><label style={etiq}>Contacto <span style={{ color: '#f87171' }}>*</span></label><input value={f.contactName} onChange={e => cambiar({ contactName: e.target.value })} style={campo} /></div>
          <div><label style={etiq}>Correo <span style={{ color: '#f87171' }}>*</span></label><input type="email" value={f.email} onChange={e => cambiar({ email: e.target.value })} style={campo} /></div>
          <div><label style={etiq}>Teléfono</label><input value={f.phone} onChange={e => cambiar({ phone: e.target.value })} style={campo} /></div>
          <div><label style={etiq}>Fuente <span style={{ color: '#f87171' }}>*</span></label>
            <select value={f.source} onChange={e => cambiar({ source: e.target.value })} style={campo}><option value="" style={opcion}>Elige…</option>{FUENTES.map(x => <option key={x} value={x} style={opcion}>{x}</option>)}</select></div>
          <div><label style={etiq}>Responsable <span style={{ color: '#f87171' }}>*</span></label>
            <select value={f.userId} onChange={e => cambiar({ userId: e.target.value })} style={campo}><option value="" style={opcion}>Elige…</option>{usuarios.map(u => <option key={u.id} value={u.id} style={opcion}>{u.name}</option>)}</select></div>
          <div><label style={etiq}>Valor estimado (COP)</label><input value={f.estimatedValue} onChange={e => cambiar({ estimatedValue: (Number(e.target.value.replace(/[^\d]/g, '')) || 0) ? Number(e.target.value.replace(/[^\d]/g, '')).toLocaleString('es-CO') : '' })} style={campo} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={etiq}>Qué quiere resolver</label><textarea value={f.scope} onChange={e => cambiar({ scope: e.target.value })} rows={2} style={{ ...campo, resize: 'vertical' }} /></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
          {error && <span style={{ fontSize: 11, color: '#fca5a5', flex: 1 }}>{error}</span>}
          <button onClick={onCerrar} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}>Cancelar</button>
          <button onClick={() => void crear()} disabled={!completo || creando} style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, opacity: !completo || creando ? 0.5 : 1 }}>
            {creando && <Loader2 size={13} className="animate-spin" />}Crear proyecto</button>
        </div>
      </div>
    </div>
  )
}
