'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import CommentsSection from '@/components/CommentsSection';

interface Proposal {
  id: string; title: string; description: string; status: string;
  amount: number; sentDate: string | null; acceptedDate: string | null; createdAt: string;
  lead: { id: string; companyName: string; contactName: string; email: string; status: string; outcome: string | null } | null;
  user: { id: string; name: string; email: string };
  activities: Activity[];
  tasks: Task[];
  documents: Doc[];
}

interface Activity {
  id: string; type: string; description: string; entityType: string;
  createdAt: string; user: { name: string }; notes?: string;
}

interface Task {
  id: string; title: string; completed: boolean; createdAt: string;
}

interface Doc {
  id: string; name: string; url: string; type: string; createdAt: string;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Borrador', cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  { value: 'SENT', label: 'Enviado', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { value: 'UNDER_REVIEW', label: 'En Revisión', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'ACCEPTED', label: 'Aceptado', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'REJECTED', label: 'Rechazado', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
];

function translateStatus(s: string) {
  const t: Record<string, string> = { DRAFT: 'Borrador', SENT: 'Enviado', UNDER_REVIEW: 'En Revisión', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado' };
  return t[s] || s;
}

function translateActivityType(t: string) {
  const m: Record<string, string> = { CREATED: 'Creó', UPDATED: 'Actualizó', STATUS_CHANGED: 'Cambió estado', NOTE_ADDED: 'Agregó nota', PROPOSAL_SENT: 'Envió', MILESTONE_COMPLETED: 'Completó' };
  return m[t] || t;
}

const STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ['DRAFT', 'SENT'],
  SENT: ['SENT', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'],
  UNDER_REVIEW: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED'],
  ACCEPTED: ['ACCEPTED'],
  REJECTED: ['REJECTED', 'DRAFT'],
};

const LEAD_STAGES = [
  { key: 'NEW',             label: 'Identificación' },
  { key: 'CONTACTED',       label: 'Contacto' },
  { key: 'DIAGNOSIS',       label: 'Diagnóstico' },
  { key: 'DEMO_VALIDATION', label: 'Demo' },
  { key: 'PROPOSAL_SENT',   label: 'Propuesta' },
  { key: 'NEGOTIATION',     label: 'Negociación' },
  { key: 'RESULT',          label: 'Resultado' },
];

function getLeadStageIndex(status: string) {
  return LEAD_STAGES.findIndex(s => s.key === status);
}

export default function ProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const id = params.id as string;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'timeline' | 'tareas' | 'documentos' | 'comentarios'>('timeline');
  const [newTask, setNewTask] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [addingDoc, setAddingDoc] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [stageDocs, setStageDocs] = useState<Doc[]>([]);
  const [stageNewDocName, setStageNewDocName] = useState('');
  const [stageNewDocUrl, setStageNewDocUrl] = useState('');
  const [stageNewDocType, setStageNewDocType] = useState('acta');
  const [loadingStageDocs, setLoadingStageDocs] = useState(false);

  const fetchProposal = useCallback(async () => {
    const res = await fetch(`/api/proposals?id=${id}`);
    const data = await res.json();
    const [tasksRes, docsRes] = await Promise.all([
      fetch(`/api/proposals/${id}/tasks`),
      fetch(`/api/proposals/${id}/documents`),
    ]);
    data.tasks = await tasksRes.json();
    data.documents = await docsRes.json();
    setProposal(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchProposal(); }, [fetchProposal]);

  const handleStatusChange = async (newStatus: string) => {
    if (!proposal) return;
    setChangingStatus(true);
    await fetch(`/api/proposals/${proposal.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...proposal, status: newStatus, userId: proposal.user.id, amount: String(proposal.amount) }),
    });
    setChangingStatus(false);
    fetchProposal();
  };

  const handleAddTask = async () => {
    if (!newTask.trim() || !proposal) return;
    setAddingTask(true);
    await fetch(`/api/proposals/${proposal.id}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTask }),
    });
    setNewTask('');
    setAddingTask(false);
    fetchProposal();
  };

  const handleToggleTask = async (task: Task) => {
    await fetch(`/api/proposals/${proposal?.id}/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !task.completed }),
    });
    fetchProposal();
  };

  const handleDeleteTask = async (taskId: string) => {
    await fetch(`/api/proposals/${proposal?.id}/tasks/${taskId}`, { method: 'DELETE' });
    fetchProposal();
  };

  const handleStageClick = async (stageKey: string) => {
    if (selectedStage === stageKey) { setSelectedStage(null); return; }
    setSelectedStage(stageKey);
    setLoadingStageDocs(true);
    setStageNewDocName('');
    setStageNewDocUrl('');
    const res = await fetch(`/api/proposals/${id}/documents?stage=${stageKey}`);
    setStageDocs(await res.json());
    setLoadingStageDocs(false);
  };

  const handleStageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!stageNewDocName.trim()) setStageNewDocName(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = () => setStageNewDocUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleExportPDF = () => {
    if (!proposal) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Propuesta</title>
      <style>
        body { font-family: 'Poppins', Arial, sans-serif; padding: 48px; color: #111; max-width: 800px; margin: auto; }
        .logo { font-size: 28px; font-weight: 700; color: #f97316; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        .amount { font-size: 32px; font-weight: 700; color: #f97316; margin: 16px 0; }
        .section { margin: 24px 0; padding: 16px 0; border-top: 1px solid #e5e7eb; }
        .section h3 { font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .row { display: flex; gap: 16px; margin: 8px 0; }
        .row div { flex: 1; }
        .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; }
        .value { font-size: 14px; font-weight: 600; }
        .footer { margin-top: 48px; border-top: 2px solid #f97316; padding-top: 16px; font-size: 11px; color: #9ca3af; }
        @media print { body { padding: 24px; } }
      </style></head><body>
      <div class="logo">ArchiTechIA</div>
      <div class="title">${proposal.title}</div>
      <p>${proposal.description}</p>
      <div class="amount">$ ${proposal.amount.toLocaleString()}</div>
      <div class="section"><h3>Cliente</h3>
        <div class="value">${proposal.lead?.companyName || 'N/A'}</div>
        <div>Contacto: ${proposal.lead?.contactName || 'N/A'} · ${proposal.lead?.email || ''}</div>
        ${proposal.lead?.status ? `<div>Fase actual: ${proposal.lead.status}</div>` : ''}
      </div>
      <div class="section"><h3>Detalles</h3>
        <div class="row">
          <div><div class="label">Estado</div><div class="value">${translateStatus(proposal.status)}</div></div>
          <div><div class="label">Responsable</div><div class="value">${proposal.user.name}</div></div>
        </div>
        <div class="row">
          <div><div class="label">Fecha envío</div><div class="value">${proposal.sentDate ? new Date(proposal.sentDate).toLocaleDateString('es-ES') : '-'}</div></div>
          <div><div class="label">Fecha aceptación</div><div class="value">${proposal.acceptedDate ? new Date(proposal.acceptedDate).toLocaleDateString('es-ES') : '-'}</div></div>
        </div>
      </div>
      ${proposal.tasks?.length > 0 ? `<div class="section"><h3>Tareas (${proposal.tasks.filter(t => t.completed).length}/${proposal.tasks.length})</h3>
        ${proposal.tasks.map(t => `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
          <span>${t.completed ? '☑' : '☐'}</span>
          <span style="${t.completed ? 'text-decoration:line-through;color:#9ca3af' : ''}">${t.title}</span>
        </div>`).join('')}</div>` : ''}
      <div class="footer">
        <div>ArchiTechIA — Automatización IA & Agentic AI</div>
        <div>Documento generado el ${new Date().toLocaleDateString('es-ES')}</div>
      </div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const handleAddStageDoc = async () => {
    if (!stageNewDocName.trim() || !stageNewDocUrl.trim() || !proposal) return;
    setAddingDoc(true);
    await fetch(`/api/proposals/${proposal.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: stageNewDocName, url: stageNewDocUrl, type: stageNewDocType, stage: selectedStage }),
    });
    setStageNewDocName('');
    setStageNewDocUrl('');
    setAddingDoc(false);
    handleStageClick(selectedStage!);
  };

  const handleAddDocument = async () => {
    if (!newDocName.trim() || !newDocUrl.trim() || !proposal) return;
    setAddingDoc(true);
    await fetch(`/api/proposals/${proposal.id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDocName, url: newDocUrl, type: newDocUrl.startsWith('http') ? 'link' : 'file' }),
    });
    setNewDocName('');
    setNewDocUrl('');
    setAddingDoc(false);
    fetchProposal();
  };

  const handleDeleteDocument = async (docId: string) => {
    await fetch(`/api/proposals/${proposal?.id}/documents`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId }),
    });
    fetchProposal();
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !proposal) return;
    setAddingNote(true);
    const userId = (session?.user as { id?: string })?.id || '';
    await fetch('/api/activities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'NOTE_ADDED', description: noteText, entityType: 'proposal',
        entityId: proposal.id, userId, proposalId: proposal.id,
      }),
    });
    setNoteText('');
    setAddingNote(false);
    fetchProposal();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  if (!proposal) return (
    <div className="p-8 text-center text-gray-500">Propuesta no encontrada.</div>
  );

  const taskProgress = proposal.tasks.length > 0
    ? Math.round((proposal.tasks.filter(t => t.completed).length / proposal.tasks.length) * 100) : 0;

  return (
    <div className="p-8">
      {/* Header + back */}
      <button onClick={() => router.push('/proposals')} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Volver a Propuestas
      </button>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{proposal.title}</h1>
            <p className="text-gray-400 mt-2">{proposal.description}</p>
            <div className="flex items-center gap-4 mt-4 text-sm text-gray-400 flex-wrap">
              <span>💰 ${proposal.amount.toLocaleString()}</span>
              {proposal.lead && <span>🏢 {proposal.lead.companyName} — {proposal.lead.contactName}</span>}
              <span>👤 {proposal.user.name}</span>
              {proposal.sentDate && <span>📅 Enviado: {new Date(proposal.sentDate).toLocaleDateString('es-ES')}</span>}
              {proposal.acceptedDate && <span className="text-green-400">✅ Aceptado: {new Date(proposal.acceptedDate).toLocaleDateString('es-ES')}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExportPDF}
              className="px-3 py-1.5 text-sm rounded-lg font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              PDF
            </button>
            <span className={`px-3 py-1.5 text-sm font-semibold rounded-full border ${STATUS_OPTIONS.find(o => o.value === proposal.status)?.cls}`}>
              {translateStatus(proposal.status)}
            </span>
            {STATUS_FLOW[proposal.status]?.filter(s => s !== proposal.status).map(s => (
              <button key={s} onClick={() => handleStatusChange(s)} disabled={changingStatus}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  s === 'ACCEPTED' ? 'bg-green-600 hover:bg-green-700 text-white' :
                  s === 'REJECTED' ? 'bg-red-600 hover:bg-red-700 text-white' :
                  s === 'SENT' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                  'bg-gray-700 hover:bg-gray-600 text-white'
                } disabled:opacity-50`}>
                {s === 'DRAFT' ? '↩ Borrador' : s === 'SENT' ? '📤 Enviar' : s === 'UNDER_REVIEW' ? '🔍 Revisar' : s === 'ACCEPTED' ? '✅ Aceptar' : '❌ Rechazar'}
              </button>
            ))}
          </div>
        </div>

        {/* Task progress */}
        {proposal.tasks.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-800">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-400">Progreso de tareas</span>
              <span className="font-semibold text-white">{proposal.tasks.filter(t => t.completed).length}/{proposal.tasks.length} · {taskProgress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-orange-600 h-2 rounded-full transition-all" style={{ width: `${taskProgress}%` }} />
            </div>
          </div>
        )}
        {/* Lead Pipeline Timeline */}
        {proposal.lead && (() => {
          const lead = proposal.lead;
          const currentIdx = getLeadStageIndex(lead.status);
          return (
        <div className="mt-5 pt-4 border-t border-gray-800">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pipeline del Lead — {lead.companyName} <span className="text-gray-600 ml-1">(click en una fase)</span></p>
          <div className="flex items-center overflow-x-auto pb-2">
            {LEAD_STAGES.map((stage, i, arr) => {
              // WON/LOST ya no son fases separadas del enum — son el
              // desenlace (lead.outcome) de la fase RESULT. "Perdido" se
              // sigue pintando en la ultima casilla del stepper (donde antes
              // vivia la fase LOST), pero ahora depende de outcome, no de
              // otra fase distinta.
              const isLostOutcome = lead.status === 'RESULT' && lead.outcome === 'LOST';
              const isCompleted = currentIdx >= 0 && i <= currentIdx && !isLostOutcome;
              const isCurrent = i === currentIdx;
              const isLost = isLostOutcome && stage.key === 'RESULT';
              const isPastLost = isLostOutcome && i < arr.length - 1;
              const isSelected = selectedStage === stage.key;
              return (
                <div key={stage.key} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center flex-1">
                    <button
                      onClick={() => handleStageClick(stage.key)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                        isSelected ? 'ring-2 ring-white scale-110' : ''
                      } ${
                        isLost ? 'bg-red-600 text-white hover:bg-red-500' :
                        isCompleted ? 'bg-green-600 text-white hover:bg-green-500' :
                        isCurrent ? 'bg-orange-500 text-white ring-2 ring-orange-500/30 hover:bg-orange-400' :
                        'bg-gray-700 text-gray-500 hover:bg-gray-600 hover:text-white'
                      }`}
                      title={`${stage.label} — Click para ver/agregar documentos`}
                    >
                      {isCompleted && !isCurrent ? '✓' : isLost ? '✗' : i + 1}
                    </button>
                    <span className={`text-[10px] mt-1 text-center leading-tight ${
                      isLost ? 'text-red-400' :
                      isCompleted ? 'text-green-400' :
                      isCurrent ? 'text-orange-400 font-semibold' :
                      'text-gray-600'
                    }`}>{stage.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-0.5 ${
                      isPastLost ? 'bg-red-600/40' :
                      i < currentIdx ? 'bg-green-600' :
                      'bg-gray-700'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        );})()}
        {/* Stage Detail Panel */}
        {selectedStage && (
          <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">
                📋 Fase: <span className="text-orange-400">{LEAD_STAGES.find(s => s.key === selectedStage)?.label}</span>
              </h3>
              <button onClick={() => setSelectedStage(null)} className="text-gray-500 hover:text-white">×</button>
            </div>
            {/* Upload new doc to stage */}
            <div className="flex gap-2 flex-wrap mb-4">
              <input type="text" value={stageNewDocName} onChange={e => setStageNewDocName(e.target.value)}
                placeholder="Nombre del documento" className="flex-1 min-w-32 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-500 focus:ring-1 focus:ring-orange-500" />
              <div className="flex-[2] min-w-48 flex gap-1">
                <input type="text" value={stageNewDocUrl && !stageNewDocUrl.startsWith('data:') ? stageNewDocUrl : ''} onChange={e => setStageNewDocUrl(e.target.value)}
                  placeholder={stageNewDocUrl.startsWith('data:') ? 'Archivo adjunto ✓' : 'URL o pegar enlace'}
                  className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-500 focus:ring-1 focus:ring-orange-500" />
                <label className={`px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg cursor-pointer hover:border-orange-500/50 text-xs flex items-center gap-1 transition-colors ${
                  stageNewDocUrl.startsWith('data:') ? 'text-orange-400 border-orange-500/50' : 'text-gray-400'
                }`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <input type="file" accept=".pdf,.doc,.docx,.txt,.xlsx,.pptx,.png,.jpg,.jpeg,.zip" onChange={handleStageFileUpload} className="hidden" />
                </label>
              </div>
              <select value={stageNewDocType} onChange={e => setStageNewDocType(e.target.value)}
                className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-xs text-white focus:ring-1 focus:ring-orange-500">
                <option value="acta">Acta</option>
                <option value="presentacion">Presentación</option>
                <option value="correo">Correo</option>
                <option value="contrato">Contrato</option>
                <option value="documento">Documento</option>
                <option value="otro">Otro</option>
              </select>
              <button onClick={handleAddStageDoc} disabled={addingDoc || !stageNewDocName.trim() || !stageNewDocUrl.trim()}
                className="px-4 py-1.5 bg-orange-600 text-white rounded-lg text-xs hover:bg-orange-700 disabled:opacity-50">
                Agregar
              </button>
            </div>
            {/* Stage documents */}
            {loadingStageDocs ? (
              <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500" /></div>
            ) : stageDocs.length === 0 ? (
              <p className="text-gray-500 text-xs py-2">Sin documentos en esta fase. Agrega actas, presentaciones, correos, etc.</p>
            ) : (
              <div className="space-y-2">
                {stageDocs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      doc.type === 'acta' ? 'bg-blue-900/30 text-blue-400' :
                      doc.type === 'presentacion' ? 'bg-purple-900/30 text-purple-400' :
                      doc.type === 'correo' ? 'bg-yellow-900/30 text-yellow-400' :
                      doc.type === 'contrato' ? 'bg-green-900/30 text-green-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>{doc.type}</span>
                    <span className="flex-1 text-xs text-white truncate">{doc.name}</span>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300">Abrir</a>
                    <button onClick={() => { fetch(`/api/proposals/${proposal.id}/documents`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docId: doc.id }) }).then(() => handleStageClick(selectedStage)); }}
                      className="text-gray-600 hover:text-red-400 text-xs">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1 w-fit">
        {[
          { key: 'timeline' as const, label: 'Timeline' },
          { key: 'tareas' as const, label: `Tareas (${proposal.tasks.filter(t => !t.completed).length} pend.)` },
          { key: 'documentos' as const, label: `Documentos (${proposal.documents.length})` },
          { key: 'comentarios' as const, label: 'Comentarios' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {tab === 'timeline' && (
        <div className="space-y-4">
          {/* Add note */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3">
            <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddNote()}
              placeholder="Escribe una nota o actualización..."
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500" />
            <button onClick={handleAddNote} disabled={addingNote || !noteText.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">
              {addingNote ? '...' : 'Agregar'}
            </button>
          </div>

          {proposal.activities && proposal.activities.length > 0 ? (
            proposal.activities.map((a, i) => (
              <div key={a.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" />
                  {i < proposal.activities.length - 1 && <div className="w-0.5 flex-1 bg-gray-800 mt-1" />}
                </div>
                <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-orange-400">{translateActivityType(a.type)}</span>
                    <span className="text-xs text-gray-500">· {new Date(a.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-white">{a.description}</p>
                  <p className="text-xs text-gray-500 mt-1">{a.user.name}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-1">Sin actividad aún</p>
              <p className="text-sm">Agrega una nota para empezar el historial.</p>
            </div>
          )}
        </div>
      )}

      {/* Tareas */}
      {tab === 'tareas' && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3">
            <input type="text" value={newTask} onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
              placeholder="Nueva tarea..."
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500" />
            <button onClick={handleAddTask} disabled={addingTask || !newTask.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">
              {addingTask ? '...' : 'Agregar'}
            </button>
          </div>

          {proposal.tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-1">Sin tareas</p>
              <p className="text-sm">Agrega tareas para hacer seguimiento del avance.</p>
            </div>
          ) : (
            proposal.tasks.map(task => (
              <div key={task.id} className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-3 ${task.completed ? 'border-green-800/50 opacity-60' : 'border-gray-800'}`}>
                <button onClick={() => handleToggleTask(task)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    task.completed ? 'bg-green-600 border-green-600' : 'border-gray-600 hover:border-orange-500'
                  }`}>
                  {task.completed && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
                <span className={`flex-1 text-sm ${task.completed ? 'line-through text-gray-500' : 'text-white'}`}>{task.title}</span>
                <button onClick={() => handleDeleteTask(task.id)} className="text-gray-600 hover:text-red-400 transition-colors text-xs">×</button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Documentos */}
      {tab === 'documentos' && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3 flex-wrap">
            <input type="text" value={newDocName} onChange={e => setNewDocName(e.target.value)}
              placeholder="Nombre del documento"
              className="flex-1 min-w-32 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500" />
            <input type="url" value={newDocUrl} onChange={e => setNewDocUrl(e.target.value)}
              placeholder="URL o enlace"
              className="flex-[2] min-w-48 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500" />
            <button onClick={handleAddDocument} disabled={addingDoc || !newDocName.trim() || !newDocUrl.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50">
              {addingDoc ? '...' : 'Agregar'}
            </button>
          </div>

          {proposal.documents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-1">Sin documentos</p>
              <p className="text-sm">Agrega enlaces a documentos relacionados: propuestas PDF, contratos, specs técnicas, etc.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {proposal.documents.map(doc => (
                <div key={doc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
                  <svg className="w-8 h-8 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500 truncate">{doc.url}</p>
                  </div>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors">
                    Abrir
                  </a>
                  <button onClick={() => handleDeleteDocument(doc.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xs px-2">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'comentarios' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <CommentsSection entityType="proposal" entityId={proposal.id} />
        </div>
      )}
    </div>
  );
}
