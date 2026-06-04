'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Producto {
  id: string;
  nombre: string;
  version: string;
  estado: string;
  descripcion: string;
  tecnologias: string[];
  caracteristicas: string[];
  icono: string;
  color: string;
}

const roadmap = [
  { fase: 'Investigación', icono: '🔬', estado: 'completado', descripcion: 'Análisis de mercado, definición de arquitectura y pruebas de concepto con modelos de IA.', items: ['Análisis de amenazas comunes', 'Selección de modelos LLM', 'Arquitectura base definida'], fecha: 'Ene – Feb 2025' },
  { fase: 'Beta', icono: '⚙️', estado: 'activo', descripcion: 'Desarrollo del core del agente, integración con n8n y primeras pruebas con clientes piloto.', items: ['Motor de detección v1', 'Dashboard de alertas', 'Integración n8n + Alibaba Cloud', 'Cliente piloto onboarding'], fecha: 'Mar – Jun 2025' },
  { fase: 'Lanzamiento', icono: '🚀', estado: 'pendiente', descripcion: 'Versión estable lista para producción, documentación completa y estrategia comercial activa.', items: ['Hardening de seguridad', 'Documentación técnica', 'Pricing y planes', 'Lanzamiento público'], fecha: 'Jul – Sep 2025' },
];

const changelog = [
  { version: 'v0.3.0', fecha: 'Abr 2025', tipo: 'feature', descripcion: 'Dashboard de alertas en tiempo real con categorización por severidad.' },
  { version: 'v0.2.1', fecha: 'Mar 2025', tipo: 'fix',     descripcion: 'Corrección en el módulo de análisis de logs — falsos positivos reducidos en 40%.' },
  { version: 'v0.2.0', fecha: 'Mar 2025', tipo: 'feature', descripcion: 'Integración con n8n para respuesta automatizada a incidentes críticos.' },
  { version: 'v0.1.0', fecha: 'Feb 2025', tipo: 'feature', descripcion: 'Motor de detección de amenazas base. Primera versión funcional del agente.' },
];

const TIPO_BADGE: Record<string, string> = {
  feature: 'bg-green-900/30 text-green-400 border-green-800',
  fix:     'bg-yellow-900/30 text-yellow-400 border-yellow-800',
  break:   'bg-red-900/30 text-red-400 border-red-800',
};

const ESTADO_STYLES: Record<string, { ring: string; dot: string; label: string }> = {
  completado: { ring: 'ring-green-500',  dot: 'bg-green-500',  label: 'Completado' },
  activo:     { ring: 'ring-orange-500', dot: 'bg-orange-500', label: 'En curso' },
  pendiente:  { ring: 'ring-gray-600',   dot: 'bg-gray-600',   label: 'Pendiente' },
};

const COLORES = [
  { label: 'Naranja → Rojo',   value: 'from-orange-500 to-red-600' },
  { label: 'Azul → Índigo',    value: 'from-blue-500 to-indigo-600' },
  { label: 'Verde → Teal',     value: 'from-green-500 to-teal-600' },
  { label: 'Violeta → Púrpura',value: 'from-violet-500 to-purple-600' },
  { label: 'Cyan → Azul',      value: 'from-cyan-500 to-blue-600' },
];

const EMPTY_FORM = { nombre: '', version: 'v1.0.0', estado: 'En Desarrollo', descripcion: '', tecnologias: '', caracteristicas: '', color: 'from-orange-500 to-red-600' };

function formFromProducto(p: Producto) {
  return {
    nombre: p.nombre, version: p.version, estado: p.estado, descripcion: p.descripcion,
    tecnologias: p.tecnologias.join(', '), caracteristicas: p.caracteristicas.join('\n'), color: p.color,
  };
}

export default function ProductosPage() {
  const { data: session } = useSession();
  const isAdmin = ['ADMIN','SUPERADMIN'].includes((session?.user as { role?: string })?.role ?? '');

  const [productos, setProductos]   = useState<Producto[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<Producto | null>(null);
  const [tab, setTab]               = useState<'info' | 'roadmap' | 'changelog'>('info');
  const [showModal, setShowModal]   = useState(false);
  const [editProducto, setEditProducto] = useState<Producto | null>(null);
  const [confirmDel, setConfirmDel] = useState<Producto | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [formData, setFormData]     = useState(EMPTY_FORM);

  const fetchProductos = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/productos');
    setProductos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchProductos(); }, [fetchProductos]);

  const openNew = () => { setEditProducto(null); setFormData(EMPTY_FORM); setShowModal(true); };
  const openEdit = (p: Producto) => { setEditProducto(p); setFormData(formFromProducto(p)); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      nombre: formData.nombre, version: formData.version, estado: formData.estado,
      descripcion: formData.descripcion, color: formData.color,
      icono: editProducto?.icono || 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      tecnologias: formData.tecnologias.split(',').map(t => t.trim()).filter(Boolean),
      caracteristicas: formData.caracteristicas.split('\n').map(c => c.trim()).filter(Boolean),
    };
    if (editProducto) {
      await fetch(`/api/productos/${editProducto.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetch('/api/productos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    setShowModal(false);
    setEditProducto(null);
    fetchProductos();
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    await fetch(`/api/productos/${confirmDel.id}`, { method: 'DELETE' });
    setDeleting(false);
    setConfirmDel(null);
    if (selected?.id === confirmDel.id) setSelected(null);
    fetchProductos();
  };

  // Vista detalle de un producto
  if (selected) {
    return (
      <div className="p-4 md:p-8">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors mb-6 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Productos
        </button>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
          <div className={`bg-gradient-to-r ${selected.color} p-6 md:p-8 relative`}>
            {isAdmin && (
              <div className="absolute top-4 right-4 flex gap-2">
                <button onClick={() => openEdit(selected)} className="px-3 py-1 text-xs bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors">Editar</button>
                <button onClick={() => setConfirmDel(selected)} className="px-3 py-1 text-xs bg-red-900/50 hover:bg-red-800/70 text-red-200 rounded-lg transition-colors">Eliminar</button>
              </div>
            )}
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4 md:gap-5">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-8 h-8 md:w-9 md:h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={selected.icono} />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">{selected.nombre}</h2>
                  <span className="text-sm text-white/70">{selected.version} · {selected.estado}</span>
                </div>
              </div>
              <span className="px-3 py-1 bg-white/20 text-white text-sm font-medium rounded-full">{selected.estado}</span>
            </div>
          </div>

          <div className="flex border-b border-gray-700 overflow-x-auto">
            {(['info', 'roadmap', 'changelog'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'text-orange-400 border-b-2 border-orange-500' : 'text-gray-400 hover:text-white'}`}>
                {t === 'info' ? 'Información' : t === 'roadmap' ? 'Roadmap' : 'Changelog'}
              </button>
            ))}
          </div>

          {tab === 'info' && (
            <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">Descripción</h3>
                  <p className="text-gray-300 leading-relaxed">{selected.descripcion}</p>
                </div>
                {selected.caracteristicas.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">Características</h3>
                    <ul className="space-y-2">
                      {selected.caracteristicas.map(c => (
                        <li key={c} className="flex items-center gap-3 text-gray-300">
                          <span className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">Tecnologías</h3>
                <div className="flex flex-wrap gap-2">
                  {selected.tecnologias.map(t => (
                    <span key={t} className="px-3 py-1 bg-orange-900/30 text-orange-400 text-sm rounded-full border border-orange-800">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'roadmap' && (
            <div className="p-6 md:p-8">
              <div className="relative">
                <div className="absolute top-8 left-8 right-8 h-0.5 bg-gray-700 hidden lg:block">
                  <div className="h-full bg-gradient-to-r from-green-500 via-orange-500 to-gray-700 w-2/3" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
                  {roadmap.map(fase => {
                    const s = ESTADO_STYLES[fase.estado];
                    return (
                      <div key={fase.fase} className={`bg-gray-700/40 border border-gray-600 rounded-xl p-5 ring-1 ${s.ring}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-8 h-8 rounded-full ring-2 ${s.ring} flex items-center justify-center text-base`}>{fase.icono}</div>
                          <div>
                            <p className="font-semibold text-white">{fase.fase}</p>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                              <span className="text-xs text-gray-400">{s.label} · {fase.fecha}</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 mb-3 leading-relaxed">{fase.descripcion}</p>
                        <ul className="space-y-1.5">
                          {fase.items.map(item => (
                            <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${fase.estado === 'completado' ? 'bg-green-400' : fase.estado === 'activo' ? 'bg-orange-400' : 'bg-gray-600'}`} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'changelog' && (
            <div className="p-6 md:p-8">
              <div className="space-y-4">
                {changelog.map(entry => (
                  <div key={entry.version} className="flex gap-4 items-start">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5" />
                      <div className="w-0.5 h-full bg-gray-700 mt-1" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="font-mono text-sm font-bold text-white">{entry.version}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${TIPO_BADGE[entry.tipo]}`}>
                          {entry.tipo === 'feature' ? '✨ feature' : '🔧 fix'}
                        </span>
                        <span className="text-xs text-gray-500">{entry.fecha}</span>
                      </div>
                      <p className="text-gray-300 text-sm">{entry.descripcion}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista lista de productos
  if (loading) return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <div className="h-9 w-48 bg-gray-700 rounded animate-pulse mb-2" />
        <div className="h-4 w-72 bg-gray-700/50 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden animate-pulse">
            <div className="h-24 bg-gray-700" />
            <div className="p-5 space-y-3">
              <div className="h-4 bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-700/50 rounded w-full" />
              <div className="h-3 bg-gray-700/50 rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Solutions</h1>
          <p className="text-gray-400 mt-1">Soluciones desarrolladas por ArchiTechIA</p>
        </div>
        {isAdmin && (
          <button onClick={openNew} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-sm font-medium">
            + Nuevo Producto
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {productos.map(p => (
          <div
            key={p.id}
            onClick={() => { setSelected(p); setTab('info'); }}
            className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden cursor-pointer hover:border-orange-500/40 transition-all hover:shadow-lg hover:shadow-orange-900/10 group"
          >
            <div className={`bg-gradient-to-r ${p.color} p-6`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={p.icono} />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-white text-lg leading-tight">{p.nombre}</h2>
                  <span className="text-white/70 text-sm">{p.version}</span>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full">{p.estado}</span>
                <span className="text-xs text-gray-500">{p.tecnologias.length} tecnologías</span>
              </div>
              <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">{p.descripcion}</p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {p.tecnologias.slice(0, 3).map(t => (
                  <span key={t} className="px-2 py-0.5 bg-orange-900/20 text-orange-400 text-xs rounded-full border border-orange-900/40">{t}</span>
                ))}
                {p.tecnologias.length > 3 && (
                  <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-full">+{p.tecnologias.length - 3}</span>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between">
                <span className="text-xs text-gray-500">Ver detalles</span>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <>
                      <button onClick={e => { e.stopPropagation(); openEdit(p); }} className="text-xs text-gray-400 hover:text-orange-400 transition-colors px-1">Editar</button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDel(p); }} className="text-xs text-gray-400 hover:text-red-400 transition-colors px-1">Eliminar</button>
                    </>
                  )}
                  <svg className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal confirmar eliminación */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-2">Eliminar producto</h3>
            <p className="text-gray-400 text-sm mb-6">¿Seguro que deseas eliminar <span className="text-white font-medium">{confirmDel.nombre}</span>? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 text-sm">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-60 flex items-center gap-2">
                {deleting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar producto — solo admin */}
      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editProducto ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                  <input required type="text" value={formData.nombre}
                    onChange={e => setFormData({...formData, nombre: e.target.value})}
                    placeholder="Ej: Agente de Ventas AI"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Versión</label>
                  <input required type="text" value={formData.version}
                    onChange={e => setFormData({...formData, version: e.target.value})}
                    placeholder="v1.0.0"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Estado</label>
                <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
                  <option>En Desarrollo</option>
                  <option>Beta</option>
                  <option>Estable</option>
                  <option>Deprecado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
                <textarea required value={formData.descripcion} rows={3}
                  onChange={e => setFormData({...formData, descripcion: e.target.value})}
                  placeholder="Descripción del producto..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tecnologías <span className="text-gray-500 font-normal">(separadas por coma)</span>
                </label>
                <input type="text" value={formData.tecnologias}
                  onChange={e => setFormData({...formData, tecnologias: e.target.value})}
                  placeholder="IA Generativa, n8n, Cloud, Python"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Características <span className="text-gray-500 font-normal">(una por línea)</span>
                </label>
                <textarea value={formData.caracteristicas} rows={4}
                  onChange={e => setFormData({...formData, caracteristicas: e.target.value})}
                  placeholder={"Monitoreo 24/7\nDetección en tiempo real\nReportes automáticos"}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Color de tarjeta</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORES.map(c => (
                    <button key={c.value} type="button"
                      onClick={() => setFormData({...formData, color: c.value})}
                      className={`w-8 h-8 rounded-lg bg-gradient-to-r ${c.value} border-2 transition-all ${formData.color === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 text-sm">
                  Cancelar
                </button>
                <button type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium">
                  {editProducto ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
