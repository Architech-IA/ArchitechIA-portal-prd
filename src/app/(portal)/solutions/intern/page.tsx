'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Building2, CheckCircle2, ArrowRight, Shield,
  Users, Rocket, Settings, Gauge, Plus, X, Loader2,
} from 'lucide-react'
import SolucionesList from '@/components/SolucionesList'

const features = [
  {
    icon: Shield,
    title: 'Uso interno',
    desc: 'Herramientas diseñadas para equipos ArchiTechIA: operaciones, comercial, delivery y administración.',
  },
  {
    icon: Users,
    title: 'Colaboración centralizada',
    desc: 'Un solo portal para gestionar leads, proyectos, propuestas, reuniones y conocimiento.',
  },
  {
    icon: Gauge,
    title: 'Productividad medida',
    desc: 'Dashboards personales y métricas de uso que ayudan a identificar cuellos de botella.',
  },
  {
    icon: Settings,
    title: 'Evolución continua',
    desc: 'Mejoras iterativas basadas en retroalimentación interna y necesidades del equipo.',
  },
]

const modules = [
  'Gestión de leads y pipeline comercial',
  'Backlog, sprints y tareas de delivery',
  'Calendario de reuniones integrado',
  'Propuestas y documentos centralizados',
  'Finanzas, reportes y trazabilidad',
]

const ESTADOS = ['ACTIVO', 'EN_DESARROLLO', 'PENDIENTE', 'PAUSADO', 'FINALIZADO']

interface FormState {
  nombre: string
  descripcion: string
  estado: string
  valorEstimado: string
}

const defaultForm: FormState = {
  nombre: '',
  descripcion: '',
  estado: 'ACTIVO',
  valorEstimado: '0',
}

export default function InternSolutionPage() {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  function openModal() {
    setForm(defaultForm)
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    if (saving) return
    setShowModal(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/soluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          tipo: 'INTERN',
          estado: form.estado,
          valorEstimado: parseFloat(form.valorEstimado) || 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Error al crear la solución.')
      }
      setRefreshKey(k => k + 1)
      setShowModal(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setSaving(false)
    }
  }

  const addButton = (
    <button
      onClick={openModal}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
    >
      <Plus size={14} />
      Nueva solución
    </button>
  )

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 p-8 md:p-10">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-4">
            <Building2 size={14} />
            Solución interna
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Intern</h1>
          <p className="text-white/90 text-lg leading-relaxed max-w-2xl">
            Soluciones, herramientas y plataformas que potencian el día a día de ArchiTechIA.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/backlog"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-700 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              <Rocket size={16} />
              Ver backlog
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/15 text-white rounded-lg text-sm font-medium hover:bg-white/25 transition-colors"
            >
              <Gauge size={16} />
              Dashboard
            </Link>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map(f => (
          <div
            key={f.title}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/30 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/15 flex items-center justify-center flex-shrink-0">
                <f.icon className="text-emerald-400" size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modules */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8">
        <h2 className="text-xl font-bold text-white mb-6">Módulos del Portal Interno</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(item => (
            <div key={item} className="flex items-center gap-3 bg-gray-950 border border-gray-800 rounded-xl p-4">
              <CheckCircle2 className="text-emerald-400 flex-shrink-0" size={18} />
              <span className="text-gray-300 text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Soluciones asociadas */}
      <SolucionesList
        tipo="INTERN"
        color="emerald"
        title="Soluciones internas"
        refreshKey={refreshKey}
        headerAction={addButton}
      />

      {/* CTA */}
      <div className="card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Rocket className="text-emerald-400" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">¿Necesitas una mejora interna?</h2>
            <p className="text-gray-400 text-sm">Registra una tarea en el backlog y asígnala al equipo correspondiente.</p>
          </div>
        </div>
        <Link
          href="/backlog"
          className="btn flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: 'white', borderColor: 'rgba(16,185,129,0.5)' }}
        >
          Ir al backlog
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Modal: Nueva solución */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header del modal */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-gradient-to-r from-emerald-900/40 to-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                  <Plus className="text-emerald-400" size={18} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg leading-none">Nueva solución</h2>
                  <p className="text-emerald-400/70 text-xs mt-0.5">Tipo: INTERN</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                disabled={saving}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Nombre <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej. Módulo de reportes avanzados"
                  disabled={saving}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition-colors disabled:opacity-60"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Descripción <span className="text-gray-600 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Describe el propósito o alcance de esta solución..."
                  rows={3}
                  disabled={saving}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition-colors disabled:opacity-60"
                />
              </div>

              {/* Estado + Valor en fila */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Estado</label>
                  <select
                    value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    disabled={saving}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition-colors disabled:opacity-60 appearance-none cursor-pointer"
                  >
                    {ESTADOS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Valor estimado ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.valorEstimado}
                    onChange={e => setForm(f => ({ ...f, valorEstimado: e.target.value }))}
                    disabled={saving}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition-colors disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-800/50 rounded-xl px-4 py-3">
                  <X size={14} className="text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Acciones */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      Crear solución
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
