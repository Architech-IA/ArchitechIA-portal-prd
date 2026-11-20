'use client'
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api, post } from '../proyectos/api'
import { campo, borde, tarjeta, etiqueta, boton, botonBorde } from './tipos'

// Identidades: quién habla con los agentes y por qué canal. Un administrador une un Telegram o un correo con su usuario del portal.
interface Persona { personaId: string; nombre: string; tipo: string; userId: string | null; usuario: string | null; identidades: { canal: string; externoId: string; verificada: boolean }[]; hilos: number }
interface Datos { personas: Persona[]; usuarios: { id: string; nombre: string; rol: string }[] }

export default function AgIdentidades() {
  const [d, setD] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [userId, setUserId] = useState(''); const [canal, setCanal] = useState('TELEGRAM'); const [externoId, setExternoId] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    setError(null)
    try { setD(await api<Datos>('/api/gateway/identidades')) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  async function vincular() {
    setEnviando(true); setError(null); setAviso(null)
    try {
      await post('/api/gateway/personas/vincular', { userId, canal, externoId })
      setAviso('Identidad vinculada: esa persona ahora es del equipo.'); setExternoId(''); await cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo vincular') } finally { setEnviando(false) }
  }

  const sinVincular = d?.personas.filter(p => !p.userId) ?? []
  return (
    <div className="p-4 space-y-4 overflow-y-auto max-w-3xl">
      <h2 className="text-[13px] font-semibold text-gray-100">Identidades por canal</h2>
      <p className="text-[11px] text-[#9aa6b8]">Quien escribe por Telegram o correo entra como externo hasta que se vincule a un usuario del portal. Una persona vinculada pasa a ser del equipo y los agentes que atienden al equipo le responden.</p>
      {error && <p role="alert" className="text-[11px] text-red-300">{error}</p>}
      {aviso && <p role="status" className="text-[11px] text-emerald-300">{aviso}</p>}
      <section className="rounded-lg p-3 space-y-2" style={tarjeta} aria-label="Vincular">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-purple-300">Vincular una identidad</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <label><span className={etiqueta}>Usuario del portal</span>
            <select className={campo} style={borde} value={userId} onChange={e => setUserId(e.target.value)}>
              <option value="" style={{ color: '#111' }}>— elige —</option>
              {d?.usuarios.map(u => <option key={u.id} value={u.id} style={{ color: '#111' }}>{u.nombre}</option>)}</select></label>
          <label><span className={etiqueta}>Canal</span>
            <select className={campo} style={borde} value={canal} onChange={e => setCanal(e.target.value)}><option value="TELEGRAM" style={{ color: '#111' }}>Telegram</option><option value="CORREO" style={{ color: '#111' }}>Correo</option></select></label>
          <label><span className={etiqueta}>{canal === 'TELEGRAM' ? 'Id de Telegram' : 'Correo'}</span><input className={campo} style={borde} value={externoId} onChange={e => setExternoId(e.target.value)} placeholder={canal === 'TELEGRAM' ? '123456789' : 'nombre@empresa.com'} /></label>
        </div>
        <button onClick={() => void vincular()} disabled={enviando || !userId || !externoId.trim()} className={boton} style={botonBorde}>{enviando ? 'Vinculando…' : 'Vincular'}</button>
      </section>
      {!d ? <div className="flex justify-center py-6 text-[#7f8a9c]"><Loader2 className="animate-spin" size={16} /></div> : (
        <>
          {sinVincular.length > 0 && (
            <section aria-label="Sin vincular"><h3 className={etiqueta}>Sin vincular ({sinVincular.length})</h3>
              <ul className="space-y-1">{sinVincular.map(p => (
                <li key={p.personaId} className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-[11.5px]" style={tarjeta}>
                  <span className="text-gray-200 truncate">{p.nombre} <span className="text-[#7f8a9c]">· {p.identidades.map(i => `${i.canal.toLowerCase()} ${i.externoId}`).join(', ')} · {p.hilos} hilo(s)</span></span>
                  {p.identidades[0] && <button className="text-purple-300 hover:underline flex-shrink-0" onClick={() => { setCanal(p.identidades[0].canal === 'CORREO' ? 'CORREO' : 'TELEGRAM'); setExternoId(p.identidades[0].externoId) }}>Usar este id</button>}
                </li>))}</ul></section>)}
          <section aria-label="Vinculadas"><h3 className={etiqueta}>Personas del equipo</h3>
            {d.personas.filter(p => p.userId).length === 0 ? <p className="text-[11px] text-[#9aa6b8]">Nadie ha escrito todavía por el gateway.</p> : (
              <ul className="space-y-1">{d.personas.filter(p => p.userId).map(p => (
                <li key={p.personaId} className="rounded-md px-3 py-2 text-[11.5px] text-gray-200" style={tarjeta}>{p.usuario ?? p.nombre} <span className="text-[#7f8a9c]">· {p.identidades.map(i => `${i.canal.toLowerCase()}${i.verificada ? '' : ' (sin verificar)'}`).join(', ')} · {p.hilos} hilo(s)</span></li>))}</ul>)}
          </section>
        </>)}
    </div>
  )
}
