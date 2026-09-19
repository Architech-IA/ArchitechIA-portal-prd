'use client';

import { useState, useEffect } from 'react';

interface Cuenta {
  nombre: string;
  categoria: string;
  descripcion: string;
  url: string;
  color: string;
  logo?: string;
}

const DEFAULT_ACCOUNTS: Cuenta[] = [
  {
    nombre: 'Zoho Mail', categoria: 'Correo',
    descripcion: 'Correo corporativo y colaboración',
    url: 'https://mail.zoho.com', color: 'from-red-500 to-red-700',
  },
  {
    nombre: 'n8n', categoria: 'Automatización',
    descripcion: 'Flujos de trabajo y automatización de procesos',
    url: 'https://n8n.io', color: 'from-orange-500 to-orange-700',
  },
  {
    nombre: 'GitHub', categoria: 'Desarrollo',
    descripcion: 'Repositorios de código y control de versiones',
    url: 'https://github.com', color: 'from-gray-600 to-gray-800',
  },
  {
    nombre: 'Slack', categoria: 'Comunicación',
    descripcion: 'Mensajería y comunicación del equipo',
    url: 'https://slack.com', color: 'from-purple-500 to-purple-700',
  },
  {
    nombre: 'Alibaba Cloud', categoria: 'Infraestructura',
    descripcion: 'Servicios cloud e infraestructura en la nube',
    url: 'https://www.alibabacloud.com', color: 'from-orange-400 to-yellow-500',
  },
  {
    nombre: 'OpenCode', categoria: 'Desarrollo',
    descripcion: 'Plataforma de desarrollo y colaboración de código abierto',
    url: 'https://opencode.ai', color: 'from-blue-500 to-blue-700',
  },
  {
    nombre: 'LinkedIn', categoria: 'Redes Sociales',
    descripcion: 'Red profesional y presencia de marca empresarial',
    url: 'https://linkedin.com', color: 'from-blue-600 to-blue-800',
  },
  {
    nombre: 'Gmail', categoria: 'Correo',
    descripcion: 'Correo electrónico personal y comunicaciones externas',
    url: 'https://mail.google.com', color: 'from-rose-500 to-red-600',
  },
  {
    nombre: 'OpenRouter', categoria: 'IA',
    descripcion: 'Acceso unificado a modelos de inteligencia artificial',
    url: 'https://openrouter.ai', color: 'from-violet-500 to-indigo-700',
  },
  {
    nombre: 'Instagram', categoria: 'Redes Sociales',
    descripcion: 'Presencia de marca y contenido visual en Instagram',
    url: 'https://instagram.com', color: 'from-pink-500 to-purple-600',
  },
  {
    nombre: 'Supabase', categoria: 'Infraestructura',
    descripcion: 'Base de datos PostgreSQL y backend como servicio',
    url: 'https://supabase.com', color: 'from-emerald-500 to-green-700',
  },
];

const COLORS = [
  'from-red-500 to-red-700',
  'from-orange-500 to-orange-700',
  'from-amber-500 to-amber-700',
  'from-yellow-400 to-yellow-600',
  'from-lime-500 to-lime-700',
  'from-emerald-500 to-green-700',
  'from-teal-500 to-teal-700',
  'from-cyan-500 to-cyan-700',
  'from-sky-500 to-sky-700',
  'from-blue-500 to-blue-700',
  'from-indigo-500 to-indigo-700',
  'from-violet-500 to-indigo-700',
  'from-purple-500 to-purple-700',
  'from-pink-500 to-purple-600',
  'from-rose-500 to-red-600',
  'from-gray-600 to-gray-800',
];

const CATEGORIAS = ['Correo', 'Automatización', 'Desarrollo', 'Comunicación', 'Infraestructura', 'Redes Sociales', 'IA', 'Cloud'];

const EMPTY_FORM: Cuenta = { nombre: '', categoria: '', descripcion: '', url: '', color: 'from-orange-500 to-orange-700', logo: '' };

function getIconForName(nombre: string) {
  const icons: Record<string, React.ReactNode> = {
    email:   <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    auto:    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    code:    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    globe:   <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>,
    chat:    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    cloud:   <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>,
    social:  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    brain:   <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    db:      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>,
  };

  const n = nombre.toLowerCase();
  if (n.includes('mail') || n.includes('gmail') || n.includes('zoho')) return icons.email;
  if (n.includes('n8n') || n.includes('auto')) return icons.auto;
  if (n.includes('git') || n.includes('code') || n.includes('open')) return icons.code;
  if (n.includes('slack') || n.includes('chat')) return icons.chat;
  if (n.includes('cloud') || n.includes('alibaba') || n.includes('supabase') || n.includes('infra')) return icons.cloud;
  if (n.includes('linkedin') || n.includes('instagram') || n.includes('social')) return icons.social;
  if (n.includes('ai') || n.includes('router') || n.includes('brain')) return icons.brain;
  if (n.includes('data') || n.includes('base')) return icons.db;
  return icons.globe;
}

export default function CuentasPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('cuentas');
    setCuentas(saved ? JSON.parse(saved) : DEFAULT_ACCOUNTS);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem('cuentas', JSON.stringify(cuentas));
  }, [cuentas, loaded]);

  const handleAdd = () => {
    if (!form.nombre || !form.url || !form.categoria) return;
    setCuentas(prev => [{ ...form }, ...prev]);
    setForm(EMPTY_FORM);
    setShowModal(false);
  };

  const handleDelete = (nombre: string) => {
    setCuentas(prev => prev.filter(c => c.nombre !== nombre));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, logo: reader.result as string });
    reader.readAsDataURL(file);
  };

  const categorias = [...new Set(cuentas.map(c => c.categoria))];

  if (!loaded) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-gray-400 mt-1">Plataformas y servicios activos de ArchiTechIA</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
        >
          + Nueva Cuenta
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total cuentas</p>
          <p className="text-2xl font-bold text-white">{cuentas.length}</p>
        </div>
        {categorias.slice(0, 3).map(cat => (
          <div key={cat} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{cat}</p>
            <p className="text-2xl font-bold text-white">{cuentas.filter(c => c.categoria === cat).length}</p>
          </div>
        ))}
      </div>

      {/* Grid de cuentas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cuentas.map((cuenta) => (
          <div
            key={cuenta.nombre + cuenta.url}
            className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-orange-500/50 transition-colors group relative"
          >
            {/* Delete button */}
            <button
              onClick={() => handleDelete(cuenta.nombre)}
              className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-black/40 text-white/60 hover:text-red-400 hover:bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Eliminar cuenta"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header con color */}
            <div className={`bg-gradient-to-r ${cuenta.color} p-5 flex items-center gap-4`}>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center overflow-hidden">
                {cuenta.logo ? (
                  <img src={cuenta.logo} alt={cuenta.nombre} className="w-full h-full object-cover" />
                ) : (
                  getIconForName(cuenta.nombre)
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{cuenta.nombre}</h3>
                <span className="text-xs text-white/70 bg-white/20 px-2 py-0.5 rounded-full">
                  {cuenta.categoria}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="p-5">
              <p className="text-gray-400 text-sm mb-4">{cuenta.descripcion}</p>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                  Activa
                </span>
                <a
                  href={cuenta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors"
                >
                  Abrir
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal nueva cuenta */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-lg border border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Nueva Cuenta</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                  <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value, color: form.color === EMPTY_FORM.color ? 'from-orange-500 to-orange-700' : form.color})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                    <option value="">Seleccionar...</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL</label>
                <input type="url" value={form.url} onChange={e => setForm({...form, url: e.target.value})} placeholder="https://..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Descripción</label>
                <input type="text" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Logo / Imagen</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 text-gray-400 rounded-lg cursor-pointer hover:border-gray-500 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {form.logo ? 'Cambiar imagen' : 'Seleccionar archivo...'}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {form.logo && (
                    <button onClick={() => setForm({...form, logo: ''})}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Quitar</button>
                  )}
                </div>
                {form.logo && (
                  <div className="mt-2 w-12 h-12 rounded-lg overflow-hidden border border-gray-600">
                    <img src={form.logo} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Color</label>
                <div className="grid grid-cols-8 gap-2">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm({...form, color: c})}
                      className={`h-8 rounded-lg bg-gradient-to-r ${c} border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                      title={c} />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">Cancelar</button>
                <button onClick={handleAdd} disabled={!form.nombre || !form.url || !form.categoria}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium disabled:opacity-50">
                  Agregar Cuenta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
