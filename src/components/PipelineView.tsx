'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

type Etapa = 'Identificación' | 'Contacto' | 'Diagnóstico' | 'Demo' | 'Propuesta' | 'Negociación' | 'Resultado';

interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  status: string;
  outcome: string | null;
  source: string;
  tipo: string | null;
  scope: string | null;
  repository: string | null;
  estimatedValue: number;
  notes: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

// QUALIFIED se fusiono con DIAGNOSIS y WON/LOST ya no son estados del Lead
// — RESULT es la unica fase real; el desenlace (Ganado/Perdido) vive en
// Lead.outcome, no se distingue en esta vista (a diferencia del kanban de
// /pipeline, esta agrupa todo bajo una sola columna "Resultado").
const STATUS_TO_ETAPA: Record<string, Etapa> = {
  NEW:             'Identificación',
  CONTACTED:       'Contacto',
  DIAGNOSIS:       'Diagnóstico',
  DEMO_VALIDATION: 'Demo',
  PROPOSAL_SENT:   'Propuesta',
  NEGOTIATION:     'Negociación',
  RESULT:          'Resultado',
};

const ETAPA_TO_STATUS: Record<Etapa, string> = {
  Identificación: 'NEW',
  Contacto:       'CONTACTED',
  Diagnóstico:    'DIAGNOSIS',
  Demo:           'DEMO_VALIDATION',
  Propuesta:      'PROPOSAL_SENT',
  Negociación:    'NEGOTIATION',
  Resultado:      'RESULT',
};

const ETAPAS: Etapa[] = ['Identificación', 'Contacto', 'Diagnóstico', 'Demo', 'Propuesta', 'Negociación', 'Resultado'];

const ETAPA_COLORS: Record<Etapa, string> = {
  Identificación: 'border-blue-500/40 bg-blue-900/10',
  Contacto:       'border-purple-500/40 bg-purple-900/10',
  Diagnóstico:    'border-cyan-500/40 bg-cyan-900/10',
  Demo:           'border-teal-500/40 bg-teal-900/10',
  Propuesta:      'border-indigo-500/40 bg-indigo-900/10',
  Negociación:    'border-orange-500/40 bg-orange-900/10',
  Resultado:      'border-green-500/40 bg-green-900/10',
};

const ETAPA_HEADER: Record<Etapa, string> = {
  Identificación: 'bg-blue-900/30 text-blue-300',
  Contacto:       'bg-purple-900/30 text-purple-300',
  Diagnóstico:    'bg-cyan-900/30 text-cyan-300',
  Demo:           'bg-teal-900/30 text-teal-300',
  Propuesta:      'bg-indigo-900/30 text-indigo-300',
  Negociación:    'bg-orange-900/30 text-orange-300',
  Resultado:      'bg-green-900/30 text-green-300',
};

function getPrioridad(valor: number): { label: string; cls: string } {
  if (valor > 15000) return { label: 'Alta',  cls: 'bg-red-900/30 text-red-400' };
  if (valor > 5000)  return { label: 'Media', cls: 'bg-yellow-900/30 text-yellow-400' };
  return                     { label: 'Baja',  cls: 'bg-gray-700 text-gray-400' };
}

const EMPTY_FORM = { companyName: '', contactName: '', email: '', estimatedValue: '', source: '', etapa: 'Identificación' as Etapa };

interface PipelineViewProps {
  leads: Lead[];
  users: { id: string; name: string }[];
  onLeadsChange: (leads: Lead[]) => void;
}

export default function PipelineView({ leads, users, onLeadsChange }: PipelineViewProps) {
  const { data: session } = useSession();
  const [dragging, setDragging] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);

  const leadsEnEtapa = (etapa: Etapa) =>
    leads.filter(l => STATUS_TO_ETAPA[l.status] === etapa);

  const valorEtapa = (etapa: Etapa) =>
    leadsEnEtapa(etapa).reduce((a, l) => a + l.estimatedValue, 0);

  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver  = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (etapa: Etapa) => {
    if (!dragging) return;
    const newStatus = ETAPA_TO_STATUS[etapa];
    const prevLeads = leads;
    onLeadsChange(leads.map(l => l.id === dragging ? { ...l, status: newStatus, outcome: newStatus === 'RESULT' ? l.outcome : null } : l));
    setDragging(null);
    try {
      await fetch(`/api/pipeline/${dragging}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      onLeadsChange(prevLeads);
    }
  };

  const handleAddLead = async () => {
    if (!form.companyName || !form.contactName || !form.email || !form.estimatedValue) return;
    setSaving(true);
    const userId = (session?.user as { id?: string })?.id || users[0]?.id || '';
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName:    form.companyName,
        contactName:    form.contactName,
        email:          form.email,
        estimatedValue: form.estimatedValue,
        source:         form.source || 'Pipeline',
        status:         ETAPA_TO_STATUS[form.etapa],
        userId,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const newLead = await res.json();
      onLeadsChange([newLead, ...leads]);
      setForm(EMPTY_FORM);
      setShowModal(false);
    }
  };

  const totalPipeline = leads.filter(l => !(l.status === 'RESULT' && l.outcome === 'LOST')).reduce((a, l) => a + l.estimatedValue, 0);
  const totalGanado   = leads.filter(l => l.status === 'RESULT' && l.outcome === 'WON').reduce((a, l) => a + l.estimatedValue, 0);
  const activos       = leads.filter(l => l.status !== 'RESULT').length;

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total Pipeline</p>
          <p className="text-xl font-bold text-white">${totalPipeline.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Resultado</p>
          <p className="text-xl font-bold text-green-400">${totalGanado.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Leads Activos</p>
          <p className="text-xl font-bold text-orange-400">{activos}</p>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {ETAPAS.map((etapa) => (
          <div
            key={etapa}
            className={`flex-shrink-0 w-52 rounded-xl border ${ETAPA_COLORS[etapa]} flex flex-col`}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(etapa)}
          >
            <div className={`px-3 py-2 rounded-t-xl flex items-center justify-between ${ETAPA_HEADER[etapa]}`}>
              <span className="text-xs font-semibold">{etapa}</span>
              <span className="text-xs opacity-70">{leadsEnEtapa(etapa).length}</span>
            </div>
            <p className="px-3 py-1 text-xs text-gray-500 border-b border-gray-700/50">
              ${valorEtapa(etapa).toLocaleString()}
            </p>
            <div className="flex-1 p-2 space-y-2 min-h-24">
              {leadsEnEtapa(etapa).map((lead) => {
                const p = getPrioridad(lead.estimatedValue);
                return (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => handleDragStart(lead.id)}
                    className={`bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-orange-500/40 transition-colors ${dragging === lead.id ? 'opacity-50' : ''}`}
                  >
                    <p className="text-xs font-semibold text-white leading-tight mb-1">{lead.companyName}</p>
                    <p className="text-xs text-gray-500 mb-2">{lead.contactName}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-orange-400">${lead.estimatedValue.toLocaleString()}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.cls}`}>{p.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal nuevo lead */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Nuevo Lead</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Empresa',          key: 'companyName',    type: 'text' },
                { label: 'Contacto',         key: 'contactName',    type: 'text' },
                { label: 'Email',            key: 'email',          type: 'email' },
                { label: 'Valor estimado ($)', key: 'estimatedValue', type: 'number' },
                { label: 'Fuente',           key: 'source',         type: 'text' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-sm text-gray-400 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(form as Record<string, string>)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Etapa inicial</label>
                <select
                  value={form.etapa}
                  onChange={(e) => setForm({ ...form, etapa: e.target.value as Etapa })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm"
                >
                  {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">Cancelar</button>
                <button onClick={handleAddLead} disabled={saving} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
