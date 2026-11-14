'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Inbox, RefreshCw, Search, Paperclip, Check, Undo2, AlertCircle, Plus, Trash2 } from 'lucide-react';

type Categoria = { id: string; nombre: string; color: string };
type Resumen = {
  id: string; provider: string; subject: string | null; sender: string | null; senderName: string | null;
  bodyPreview: string | null; receivedAt: string | null; isRead: boolean; hasAttachments: boolean;
  categoriaId: string | null; categoriaOrigen: string | null; confianza: string | null; motivo: string | null; revisado: boolean;
};
type Accion = { id: string; accion: string; antes: string | null; despues: string | null; revertida: boolean; createdAt: string };
type Detalle = Resumen & { bodyHtml: string | null; acciones: Accion[] };
type Regla = { id: string; tipo: string; patron: string; origen: string; aciertos: number; categoria: { nombre: string; color: string } };
type Cuenta = { usuario: string; proveedor: string; correo: string; ultimaSync: string | null; mensajes: number };

const COLOR: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  purple: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  teal: 'bg-teal-500/15 text-teal-300 border-teal-500/25',
  gray: 'bg-white/5 text-gray-400 border-white/10',
};
const campo = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-orange-500/40';

function fecha(s: string | null) {
  if (!s) return '';
  return new Date(s).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || 'Error');
  return j as T;
}

export default function CorreoCentral() {
  const { data: session } = useSession();
  const admin = ['ADMIN', 'SUPERADMIN'].includes((session?.user as { role?: string })?.role ?? '');
  const [vista, setVista] = useState<'bandeja' | 'reglas' | 'cuentas'>('bandeja');
  const [cats, setCats] = useState<Categoria[]>([]);
  const [filtro, setFiltro] = useState<string>('todos');
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<Resumen[]>([]);
  const [conteos, setConteos] = useState<Record<string, number>>({});
  const [sinRevisar, setSinRevisar] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [det, setDet] = useState<Detalle | null>(null);
  const [aviso, setAviso] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const catPorId = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const decir = (t: 'ok' | 'err', m: string) => { setAviso({ t, m }); setTimeout(() => setAviso(null), 5000); };

  const cargar = useCallback(async () => {
    const sp = new URLSearchParams();
    if (filtro !== 'todos') sp.set('categoria', filtro);
    if (q.trim()) sp.set('q', q.trim());
    try {
      const d = await api<{ mensajes: Resumen[]; conteos: Record<string, number>; sinRevisar: number }>('/api/correo/mensajes?' + sp);
      setLista(d.mensajes); setConteos(d.conteos); setSinRevisar(d.sinRevisar);
    } catch (e) { decir('err', e instanceof Error ? e.message : 'No se pudo cargar'); }
  }, [filtro, q]);

  useEffect(() => { api<Categoria[]>('/api/correo/categorias').then(setCats).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(cargar, q ? 300 : 0); return () => clearTimeout(t); }, [cargar, q]);
  useEffect(() => {
    if (!sel) { setDet(null); return; }
    api<Detalle>('/api/correo/mensajes/' + sel).then(setDet).catch(() => setDet(null));
  }, [sel]);

  const recargarDetalle = () => { if (sel) api<Detalle>('/api/correo/mensajes/' + sel).then(setDet).catch(() => {}); };

  async function sincronizar() {
    setSincronizando(true);
    try {
      const r = await api<{ sincronizados: number; clasificados: number; evaluados: number; aviso: string | null }>('/api/correo/sync', { method: 'POST' });
      decir(r.aviso ? 'err' : 'ok', r.aviso ?? `${r.sincronizados} correos traídos, ${r.clasificados} clasificados`);
      await cargar();
    } catch (e) { decir('err', e instanceof Error ? e.message : 'Error'); }
    setSincronizando(false);
  }
  async function cambiar(cat: string | null) {
    if (!sel) return;
    try { await api('/api/correo/mensajes/' + sel, { method: 'PATCH', body: JSON.stringify({ categoriaId: cat }) }); decir('ok', 'Categoría guardada. Se aprende para este remitente.'); recargarDetalle(); cargar(); }
    catch (e) { decir('err', e instanceof Error ? e.message : 'Error'); }
  }
  async function revisado(v: boolean) {
    if (!sel) return;
    try { await api('/api/correo/mensajes/' + sel, { method: 'PATCH', body: JSON.stringify({ revisado: v }) }); recargarDetalle(); cargar(); }
    catch (e) { decir('err', e instanceof Error ? e.message : 'Error'); }
  }
  async function revertir(id: string) {
    try { await api(`/api/correo/acciones/${id}/revertir`, { method: 'POST' }); decir('ok', 'Acción revertida'); recargarDetalle(); cargar(); }
    catch (e) { decir('err', e instanceof Error ? e.message : 'Error'); }
  }

  const chip = (id: string, texto: string, n: number) => (
    <button key={id} onClick={() => { setFiltro(id); setSel(null); }}
      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${filtro === id ? 'bg-white/10 border-white/25 text-white' : 'bg-white/[0.03] border-white/10 text-gray-400 hover:bg-white/[0.06]'}`}>
      {texto} <span className="opacity-60">{n}</span>
    </button>
  );
  const total = Object.values(conteos).reduce((a, b) => a + b, 0);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center"><Inbox className="w-4 h-4 text-orange-400" /></div>
          <div>
            <h1 className="text-base font-semibold text-white">Correo</h1>
            <p className="text-xs text-[#7f8a9c]">Buzones en un solo lugar, clasificados por reglas. Solo lectura.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline px-2 py-1 rounded-md bg-white/5 border border-white/5 text-xs text-gray-400">{sinRevisar} por revisar</span>
          <button onClick={sincronizar} disabled={sincronizando} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-200 hover:bg-white/10 disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${sincronizando ? 'animate-spin' : ''}`} />{sincronizando ? 'Sincronizando…' : 'Sincronizar'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-5 pt-3">
        {(['bandeja', 'reglas', 'cuentas'] as const).map((v) => (
          <button key={v} onClick={() => setVista(v)} className={`px-3 py-1.5 rounded-lg text-xs capitalize ${vista === v ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200'}`}>{v}</button>
        ))}
        {aviso && <span role="status" className={`ml-3 text-xs ${aviso.t === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{aviso.m}</span>}
      </div>

      {vista === 'bandeja' && (
        <>
          <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-white/5">
            {chip('todos', 'Todos', total)}
            {cats.map((c) => chip(c.id, c.nombre, conteos[c.id] ?? 0))}
            {chip('sin', 'Sin clasificar', conteos['sin'] ?? 0)}
            <div className="relative ml-auto min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7f8a9c]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar correos" className={`${campo} w-full pl-8`} />
            </div>
          </div>
          <div className="flex-1 flex overflow-hidden">
            <div className={`w-full lg:w-[42%] border-r border-white/5 overflow-y-auto ${sel ? 'hidden lg:block' : ''}`}>
              {lista.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[#7f8a9c] gap-2 p-8 text-center">
                  <Inbox className="w-10 h-10 opacity-20" />
                  <p className="text-sm">No hay correos en esta vista.</p>
                  <p className="text-xs">Conecta un buzón en la pestaña Cuentas y pulsa Sincronizar.</p>
                </div>
              ) : lista.map((m) => {
                const c = m.categoriaId ? catPorId.get(m.categoriaId) : null;
                return (
                  <button key={m.id} onClick={() => setSel(m.id)} className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] ${sel === m.id ? 'bg-white/[0.06]' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${m.revisado ? 'text-gray-400' : 'text-white font-medium'}`}>{m.senderName || m.sender}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded border whitespace-nowrap ${COLOR[c?.color ?? 'gray']}`}>{c?.nombre ?? 'Sin clasificar'}</span>
                    </div>
                    <div className="text-[13px] text-gray-300 truncate">{m.subject}</div>
                    <div className="text-xs text-[#7f8a9c] truncate flex items-center gap-1.5">
                      {m.hasAttachments && <Paperclip className="w-3 h-3" />}{fecha(m.receivedAt)} · {m.bodyPreview}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className={`flex-1 overflow-y-auto p-5 ${sel ? '' : 'hidden lg:block'}`}>
              {!det ? <p className="text-sm text-[#7f8a9c]">Elige un correo para ver el detalle.</p> : (
                <div className="max-w-3xl">
                  <button onClick={() => setSel(null)} className="lg:hidden text-xs text-orange-400 mb-3">Volver a la lista</button>
                  <h2 className="text-white text-base font-semibold">{det.subject}</h2>
                  <p className="text-xs text-[#7f8a9c] mb-3">De {det.senderName ? `${det.senderName} <${det.sender}>` : det.sender} · {fecha(det.receivedAt)}</p>
                  <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3 text-xs text-gray-300 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 mb-3">
                    <span className="text-[#7f8a9c]">Categoría</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={det.categoriaId ?? ''} onChange={(e) => cambiar(e.target.value || null)} aria-label="Categoría" className={`${campo} py-1`}>
                        <option value="">Sin clasificar</option>
                        {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                      <span className="text-[#7f8a9c]">Confianza {det.confianza ?? 'Baja'}</span>
                    </div>
                    <span className="text-[#7f8a9c]">Por qué</span><span>{det.motivo ?? 'Sin evaluar'}</span>
                    <span className="text-[#7f8a9c]">Estado</span><span>{det.revisado ? 'Revisado' : 'Pendiente de revisar'}</span>
                  </div>
                  <div className="flex gap-2 mb-4">
                    <button onClick={() => revisado(!det.revisado)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-200 hover:bg-white/10">
                      <Check className="w-3.5 h-3.5" />{det.revisado ? 'Marcar como pendiente' : 'Marcar revisado'}
                    </button>
                  </div>
                  {det.bodyHtml ? (
                    <iframe title="Contenido del correo" sandbox="" srcDoc={`<base target="_blank"><style>body{font:14px system-ui;color:#222;margin:12px}</style>${det.bodyHtml}`} className="w-full h-72 rounded-lg bg-white border border-white/10" />
                  ) : <p className="text-sm text-gray-300 whitespace-pre-wrap">{det.bodyPreview}</p>}
                  {det.acciones.length > 0 && (
                    <div className="mt-5">
                      <p className="text-xs font-medium text-[#7f8a9c] mb-2">Historial</p>
                      {det.acciones.map((a) => (
                        <div key={a.id} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 text-gray-300">
                          <span className={a.revertida ? 'line-through opacity-50' : ''}>{a.accion === 'CATEGORIA' ? 'Cambio de categoría' : 'Revisión'} · {fecha(a.createdAt)}</span>
                          {!a.revertida && <button onClick={() => revertir(a.id)} className="flex items-center gap-1 text-orange-400 hover:text-orange-300"><Undo2 className="w-3 h-3" />Revertir</button>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {vista === 'reglas' && <Reglas cats={cats} admin={admin} decir={decir} />}
      {vista === 'cuentas' && <Cuentas />}
    </div>
  );
}

function Reglas({ cats, admin, decir }: { cats: Categoria[]; admin: boolean; decir: (t: 'ok' | 'err', m: string) => void }) {
  const [rs, setRs] = useState<Regla[]>([]);
  const [tipo, setTipo] = useState('REMITENTE');
  const [patron, setPatron] = useState('');
  const [cat, setCat] = useState('');
  const cargar = () => api<Regla[]>('/api/correo/reglas').then(setRs).catch(() => {});
  useEffect(() => { cargar(); }, []);
  async function crear() {
    if (patron.trim().length < 3) { decir('err', 'Escribe al menos 3 caracteres'); return; }
    if (!cat) { decir('err', 'Elige una categoría'); return; }
    try { await api('/api/correo/reglas', { method: 'POST', body: JSON.stringify({ tipo, patron, categoriaId: cat }) }); setPatron(''); decir('ok', 'Regla creada'); cargar(); }
    catch (e) { decir('err', e instanceof Error ? e.message : 'Error'); }
  }
  async function quitar(id: string) {
    try { await api('/api/correo/reglas/' + id, { method: 'DELETE' }); cargar(); } catch (e) { decir('err', e instanceof Error ? e.message : 'Error'); }
  }
  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-4xl">
      <p className="text-xs text-[#7f8a9c] mb-4">Orden de decisión: 1) remitente o dominio fijado a mano, 2) palabras y adjuntos, 3) lo aprendido de tus correcciones. Si nada decide con confianza, el correo queda sin clasificar para revisión.</p>
      {admin && (
        <div className="flex flex-wrap gap-2 mb-5">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de regla" className={campo}>
            <option value="REMITENTE">Remitente</option><option value="DOMINIO">Dominio</option><option value="TEXTO">Texto</option>
          </select>
          <input value={patron} onChange={(e) => setPatron(e.target.value)} placeholder={tipo === 'TEXTO' ? 'frase en el asunto o cuerpo' : tipo === 'DOMINIO' ? 'empresa.com' : 'persona@empresa.com'} aria-label="Patrón" className={`${campo} flex-1 min-w-[200px]`} />
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría de la regla" className={campo}>
            <option value="">Categoría</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <button onClick={crear} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/20 border border-orange-500/30 text-xs text-orange-200 hover:bg-orange-500/30"><Plus className="w-3.5 h-3.5" />Agregar</button>
        </div>
      )}
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-xs text-[#7f8a9c]"><th className="py-2 font-normal">Regla</th><th className="font-normal">Categoría</th><th className="font-normal">Origen</th><th className="font-normal">Usos</th><th /></tr></thead>
        <tbody>
          {rs.filter((r) => !r.patron.includes('#off-')).map((r) => (
            <tr key={r.id} className="border-t border-white/5 text-gray-300">
              <td className="py-2"><span className="text-[#7f8a9c] text-xs mr-2">{r.tipo.toLowerCase()}</span>{r.patron}</td>
              <td><span className={`text-[11px] px-2 py-0.5 rounded border ${COLOR[r.categoria.color] ?? COLOR.gray}`}>{r.categoria.nombre}</span></td>
              <td>{r.origen === 'APRENDIDA' ? 'Aprendida' : 'Manual'}</td><td>{r.aciertos}</td>
              <td className="text-right">{admin && <button onClick={() => quitar(r.id)} aria-label="Desactivar regla" className="text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
            </tr>
          ))}
          {rs.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-[#7f8a9c] text-xs">Aún no hay reglas. Cada vez que cambies una categoría se aprende una.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Cuentas() {
  const [d, setD] = useState<{ cuentas: Cuenta[]; microsoftConfigurado: boolean } | null>(null);
  useEffect(() => { api<{ cuentas: Cuenta[]; microsoftConfigurado: boolean }>('/api/correo/cuentas').then(setD).catch(() => {}); }, []);
  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-4xl">
      {d && !d.microsoftConfigurado && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-2 text-xs text-blue-300">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>La conexión con Microsoft 365 aún no está configurada en el servidor (falta registrar la aplicación en Azure y cargar sus claves). Mientras tanto, un administrador puede importar correos a mano para probar la clasificación.</span>
        </div>
      )}
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-xs text-[#7f8a9c]"><th className="py-2 font-normal">Buzón</th><th className="font-normal">Proveedor</th><th className="font-normal">Usuario</th><th className="font-normal">Última sincronización</th><th className="font-normal">Correos</th></tr></thead>
        <tbody>
          {(d?.cuentas ?? []).map((c, i) => (
            <tr key={i} className="border-t border-white/5 text-gray-300"><td className="py-2">{c.correo}</td><td>{c.proveedor === 'MICROSOFT' ? 'Microsoft 365' : c.proveedor}</td><td>{c.usuario}</td><td>{c.ultimaSync ? fecha(c.ultimaSync) : 'Nunca'}</td><td>{c.mensajes}</td></tr>
          ))}
          {d && d.cuentas.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-[#7f8a9c] text-xs">Ningún buzón conectado todavía.</td></tr>}
        </tbody>
      </table>
      <p className="text-xs text-[#7f8a9c] mt-4">El acceso es solo de lectura: el portal no envía, borra ni mueve correos.</p>
    </div>
  );
}
