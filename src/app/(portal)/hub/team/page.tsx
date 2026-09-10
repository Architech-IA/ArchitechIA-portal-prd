'use client';

import { useEffect, useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  createdAt: string;
}

interface UserStats {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar: string | null;
    createdAt: string;
    updatedAt: string;
    _count: {
      leads: number;
      proposals: number;
      projects: number;
      activities: number;
    };
  };
  stats: {
    totalLeadValue: number;
    totalProposalAmount: number;
    acceptedProposals: number;
  };
  leads: Array<{
    id: string;
    companyName: string;
    contactName: string;
    status: string;
    estimatedValue: number;
    createdAt: string;
  }>;
  proposals: Array<{
    id: string;
    title: string;
    status: string;
    amount: number;
    createdAt: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    priority: string;
    progress: number;
    createdAt: string;
  }>;
}

export default function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ARQUITECTO_SOLUCIONES',
  });

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      });
  }, []);

  const handleUserClick = async (user: User) => {
    setSelectedUser(user);
    setShowUserDetails(true);
    setStatsLoading(true);

    try {
      const res = await fetch(`/api/user-stats?userId=${user.id}`);
      const data = await res.json();
      setUserStats(data);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      const newUser = await res.json();
      setUsers([...users, newUser]);
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', role: 'ARQUITECTO_SOLUCIONES' });
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: 'bg-red-900/30 text-red-400',
      GERENTE_COMERCIAL: 'bg-blue-900/30 text-blue-400',
      GERENTE_ADMINISTRATIVO: 'bg-emerald-900/30 text-emerald-400',
      GERENTE_OPERACIONES: 'bg-purple-900/30 text-purple-400',
      ARQUITECTO_SOLUCIONES: 'bg-cyan-900/30 text-cyan-400',
    };
    return colors[role] || 'bg-gray-800 text-gray-400';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      ADMIN: 'Administrador',
      GERENTE_COMERCIAL: 'Gerente Comercial',
      GERENTE_ADMINISTRATIVO: 'Gerente Administrativo',
      GERENTE_OPERACIONES: 'Gerente de Operaciones',
      ARQUITECTO_SOLUCIONES: 'Arquitecto de Soluciones',
    };
    return labels[role] || role;
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-gray-400 mt-1">Gestión de socios y colaboradores</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
          + Nuevo Miembro
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <div
            key={user.id}
            onClick={() => handleUserClick(user)}
            className="bg-gray-800 rounded-xl shadow border border-gray-700 p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-400 to-amber-500 flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name.split(' ').filter(w => w.length > 0).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{user.name}</h3>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Rol</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadge(user.role)}`}>
                  {getRoleLabel(user.role)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Registrado</span>
                <span className="text-sm text-white">{new Date(user.createdAt).toLocaleDateString('es-ES')}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500 text-center">Click para ver detalles →</p>
            </div>
          </div>
        ))}
      </div>

      {/* Popup de detalles del usuario */}
      {showUserDetails && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-6 text-white">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-xl font-bold overflow-hidden">
                    {selectedUser.avatar ? (
                      <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover" />
                    ) : (
                      selectedUser.name.split(' ').filter(w => w.length > 0).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedUser.name}</h2>
                    <p className="text-xs text-gray-500">{selectedUser.email}</p>
                    <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadge(selectedUser.role)}`}>
                      {getRoleLabel(selectedUser.role)}
                    </span>
                  </div>
                </div>
                <button onClick={() => setShowUserDetails(false)} className="text-white hover:text-gray-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
              {statsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                </div>
              ) : userStats ? (
                <div className="p-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-orange-900/20 rounded-lg p-4 border border-orange-800">
                      <p className="text-xs text-orange-400 mb-1">Leads</p>
                      <p className="text-2xl font-bold text-orange-300">{userStats.user._count.leads}</p>
                    </div>
                    <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-800">
                      <p className="text-xs text-amber-400 mb-1">Propuestas</p>
                      <p className="text-2xl font-bold text-amber-300">{userStats.user._count.proposals}</p>
                    </div>
                    <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-800">
                      <p className="text-xs text-yellow-400 mb-1">Proyectos</p>
                      <p className="text-2xl font-bold text-yellow-300">{userStats.user._count.projects}</p>
                    </div>
                    <div className="bg-red-900/20 rounded-lg p-4 border border-red-800">
                      <p className="text-xs text-red-400 mb-1">Actividades</p>
                      <p className="text-2xl font-bold text-red-300">{userStats.user._count.activities}</p>
                    </div>
                  </div>

                  {/* Financial Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <p className="text-xs text-gray-400 mb-1">Valor Total de Leads</p>
                      <p className="text-xl font-bold text-white">${userStats.stats.totalLeadValue.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <p className="text-xs text-gray-400 mb-1">Propuestas Aceptadas</p>
                      <p className="text-xl font-bold text-white">{userStats.stats.acceptedProposals}</p>
                    </div>
                  </div>

                  {/* Recent Leads */}
                  {userStats.leads.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-white mb-3">Leads Recientes</h3>
                      <div className="space-y-2">
                        {userStats.leads.map((lead) => (
                          <div key={lead.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                            <div>
                              <p className="font-medium text-white">{lead.companyName}</p>
                              <p className="text-sm text-gray-400">{lead.contactName}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-white">${lead.estimatedValue.toLocaleString()}</p>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                                {translateStatus(lead.status)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Proposals */}
                  {userStats.proposals.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-white mb-3">Propuestas Recientes</h3>
                      <div className="space-y-2">
                        {userStats.proposals.map((proposal) => (
                          <div key={proposal.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-white">{proposal.title}</p>
                              <p className="text-sm text-gray-400">{new Date(proposal.createdAt).toLocaleDateString('es-ES')}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-white">${proposal.amount.toLocaleString()}</p>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getProposalStatusColor(proposal.status)}`}>
                                {translateProposalStatus(proposal.status)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Projects */}
                  {userStats.projects.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Proyectos Recientes</h3>
                      <div className="space-y-2">
                        {userStats.projects.map((project) => (
                          <div key={project.id} className="p-3 bg-gray-700 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-white">{project.name}</p>
                              <div className="flex gap-2">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                                  {translateStatus(project.status)}
                                </span>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(project.priority)}`}>
                                  {translatePriority(project.priority)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-600 rounded-full h-2">
                                <div
                                  className="bg-orange-500 h-2 rounded-full"
                                  style={{ width: `${project.progress}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium text-gray-300 w-10 text-right">{project.progress}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Info */}
                  <div className="mt-6 pt-6 border-t border-gray-700">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Fecha de Registro</p>
                        <p className="font-medium text-white">{new Date(userStats.user.createdAt).toLocaleString('es-ES')}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Última Actualización</p>
                        <p className="font-medium text-white">{new Date(userStats.user.updatedAt).toLocaleString('es-ES')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  No se pudieron cargar las estadísticas
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar miembro */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Nuevo Miembro</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
                <input type="password" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Rol</label>
                <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-orange-500">
                  <option value="ARQUITECTO_SOLUCIONES">Arquitecto de Soluciones</option>
                  <option value="GERENTE_COMERCIAL">Gerente Comercial</option>
                  <option value="GERENTE_ADMINISTRATIVO">Gerente Administrativo</option>
                  <option value="GERENTE_OPERACIONES">Gerente de Operaciones</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-700 text-white">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NEW: 'bg-blue-900/30 text-blue-400',
    CONTACTED: 'bg-purple-900/30 text-purple-400',
    DIAGNOSIS: 'bg-cyan-900/30 text-cyan-400',
    DEMO_VALIDATION: 'bg-teal-900/30 text-teal-400',
    PROPOSAL_SENT: 'bg-indigo-900/30 text-indigo-400',
    NEGOTIATION: 'bg-orange-900/30 text-orange-400',
    RESULT: 'bg-green-900/30 text-green-400',
    PLANNING: 'bg-blue-900/30 text-blue-400',
    IN_PROGRESS: 'bg-green-900/30 text-green-400',
    ON_HOLD: 'bg-yellow-900/30 text-yellow-400',
    COMPLETED: 'bg-gray-800 text-gray-400',
    CANCELLED: 'bg-red-900/30 text-red-400',
  };
  return colors[status] || 'bg-gray-800 text-gray-400';
}

function getProposalStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-800 text-gray-400',
    SENT: 'bg-blue-900/30 text-blue-400',
    UNDER_REVIEW: 'bg-yellow-900/30 text-yellow-400',
    ACCEPTED: 'bg-green-900/30 text-green-400',
    REJECTED: 'bg-red-900/30 text-red-400',
  };
  return colors[status] || 'bg-gray-800 text-gray-400';
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    LOW: 'bg-gray-800 text-gray-400',
    MEDIUM: 'bg-yellow-900/30 text-yellow-400',
    HIGH: 'bg-orange-900/30 text-orange-400',
    CRITICAL: 'bg-red-900/30 text-red-400',
  };
  return colors[priority] || 'bg-gray-800 text-gray-400';
}

function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    NEW: 'Identificación',
    CONTACTED: 'Contacto',
    DIAGNOSIS: 'Diagnóstico',
    DEMO_VALIDATION: 'Demo',
    PROPOSAL_SENT: 'Propuesta',
    NEGOTIATION: 'Negociación',
    RESULT: 'Resultado',
    PLANNING: 'Planificación',
    IN_PROGRESS: 'En Progreso',
    ON_HOLD: 'En Pausa',
    COMPLETED: 'Completado',
    CANCELLED: 'Cancelado',
  };
  return translations[status] || status;
}

function translateProposalStatus(status: string): string {
  const translations: Record<string, string> = {
    DRAFT: 'Borrador',
    SENT: 'Enviado',
    UNDER_REVIEW: 'En Revisión',
    ACCEPTED: 'Aceptado',
    REJECTED: 'Rechazado',
  };
  return translations[status] || status;
}

function translatePriority(priority: string): string {
  const translations: Record<string, string> = {
    LOW: 'Baja',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    CRITICAL: 'Crítica',
  };
  return translations[priority] || priority;
}
