'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

type Etapa = 'Nuevo' | 'Contactado' | 'Calificado' | 'Propuesta' | 'Negociación' | 'Ganado' | 'Perdido';

interface DBLead {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  status: string;
  outcome: string | null;
  estimatedValue: number;
  source: string;
  notes: string | null;
  user: { id: string; name: string; email: string };
}

// QUALIFIED se fusiono con DIAGNOSIS y WON/LOST ya no son estados del Lead
// — RESULT es la unica fase real, y el desenlace (Ganado/Perdido) viaja en
// Lead.outcome. Esta pagina sigue mostrando "Ganado"/"Perdido" como
// columnas separadas del kanban (es una comodidad visual de esta vista, no
// del modelo de datos), asi que la clasificacion ahora depende de status +
// outcome, no solo de status.
const STATUS_TO_ETAPA: Record<string, Etapa> = {
  NEW:             'Nuevo',
  CONTACTED:       'Contactado',
  DIAGNOSIS:       'Calificado',
  DEMO_VALIDATION: 'Propuesta',
  PROPOSAL_SENT:   'Propuesta',
  NEGOTIATION:     'Negociación',
};

function leadToEtapa(l: DBLead): Etapa {
  if (l.status === 'RESULT') return l.outcome === 'LOST' ? 'Perdido' : 'Ganado';
  return STATUS_TO_ETAPA[l.status] ?? 'Nuevo';
}

const ETAPA_TO_STATUS: Record<Etapa, string> = {
  Nuevo:       'NEW',
  Contactado:  'CONTACTED',
  Calificado:  'DIAGNOSIS',
  Propuesta:   'PROPOSAL_SENT',
  Negociación: 'NEGOTIATION',
  Ganado:      'RESULT',
  Perdido:     'RESULT',
};

// Solo relevante cuando la etapa destino es Ganado/Perdido — el resto de
// las columnas no tienen desenlace (outcome queda null).
const ETAPA_TO_OUTCOME: Partial<Record<Etapa, string>> = {
  Ganado:  'WON',
  Perdido: 'LOST',
};

const ETAPAS: Etapa[] = ['Nuevo', 'Contactado', 'Calificado', 'Propuesta', 'Negociación', 'Ganado', 'Perdido'];

const ETAPA_COLORS: Record<Etapa, string> = {
  Nuevo:       'border-blue-500/40 bg-blue-900/10',
  Contactado:  'border-purple-500/40 bg-purple-900/10',
  Calificado:  'border-yellow-500/40 bg-yellow-900/10',
  Propuesta:   'border-indigo-500/40 bg-indigo-900/10',
  Negociación: 'border-orange-500/40 bg-orange-900/10',
  Ganado:      'border-green-500/40 bg-green-900/10',
  Perdido:     'border-red-500/40 bg-red-900/10',
};

const ETAPA_HEADER: Record<Etapa, string> = {
  Nuevo:       'bg-blue-900/30 text-blue-300',
  Contactado:  'bg-purple-900/30 text-purple-300',
  Calificado:  'bg-yellow-900/30 text-yellow-300',
  Propuesta:   'bg-indigo-900/30 text-indigo-300',
  Negociación: 'bg-orange-900/30 text-orange-300',
  Ganado:      'bg-green-900/30 text-green-300',
  Perdido:     'bg-red-900/30 text-red-300',
};

function getPrioridad(valor: number): { label: string; cls: string } {
  if (valor > 15000) return { label: 'Alta',  cls: 'bg-red-900/30 text-red-400' };
  if (valor > 5000)  return { label: 'Media', cls: 'bg-yellow-900/30 text-yellow-400' };
  return                     { label: 'Baja',  cls: 'bg-gray-700 text-gray-400' };
}

const EMPTY_FORM = { companyName: '', contactName: '', email: '', estimatedValue: '', source: '', etapa: 'Nuevo' as Etapa };

export default function PipelinePage() {
  const { data: session } = useSession();
  const [leads, setLeads]       = useState<DBLead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [users, setUsers]       = useState<{ id: string; name: string }[]>([]);

  const fetchLeads = useCallback(() => {
    Promise.all([
      fetch('/api/leads').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([l, u]) => { setLeads(l); setUsers(u); setLoading(false); });
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const leadsEnEtapa = (etapa: Etapa) =>
    leads.filter(l => leadToEtapa(l) === etapa);

  const valorEtapa = (etapa: Etapa) =>
    leadsEnEtapa(etapa).reduce((a, l) => a + l.estimatedValue, 0);

  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver  = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (etapa: Etapa) => {
    if (!dragging) return;
    const newStatus = ETAPA_TO_STATUS[etapa];
    const newOutcome = ETAPA_TO_OUTCOME[etapa] ?? null;
    const prevLeads = leads;
    setLeads(prev => prev.map(l => l.id === dragging ? { ...l, status: newStatus, outcome: newOutcome } : l));
    setDragging(null);
    try {
      await fetch(`/api/pipeline/${dragging}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, outcome: newOutcome }),
      });
    } catch {
      setLeads(prevLeads);
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
        outcome:        ETAPA_TO_OUTCOME[form.etapa] ?? null,
        userId,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const newLead = await res.json();
      setLeads(prev => [newLead, ...prev]);
      setForm(EMPTY_FORM);
      setShowModal(false);
    }
  };

  const totalPipeline = leads.filter(l => !(l.status === 'RESULT' && l.outcome === 'LOST')).reduce((a, l) => a + l.estimatedValue, 0);
  const totalGanado   = leads.filter(l => l.status === 'RESULT' && l.outcome === 'WON').reduce((a, l) => a + l.estimatedValue, 0);
  const activos       = leads.filter(l => l.status !== 'RESULT').length;

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-400 mt-1">Vista Kanban — arrastra las tarjetas entre etapas</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
        >
          + Nuevo Lead
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total Pipeline</p>
          <p className="text-xl font-bold text-white">${totalPipeline.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Ganado</p>
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
