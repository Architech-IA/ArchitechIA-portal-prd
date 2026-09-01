'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';

interface ProfileData {
  user: { id: string; name: string; email: string; role: string; avatar: string | null; createdAt: string; googleConnected: boolean; microsoftConnected: boolean };
  stats: { leads: number; proposals: number; projects: number; pipelineValue: number; leadsGanados: number };
  recentActivity: { id: string; type: string; description: string; entityType: string; createdAt: string }[];
}

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  SUPERADMIN:             { label: 'Super Admin',          cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  ADMIN:                  { label: 'Admin',                cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  GERENTE_COMERCIAL:      { label: 'Gerente Comercial',    cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30'       },
  GERENTE_ADMINISTRATIVO: { label: 'Gerente Administrativo', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  GERENTE_OPERACIONES:    { label: 'Gerente Operaciones',  cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  ARQUITECTO_SOLUCIONES:  { label: 'Arquitecto Soluciones', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'     },
  PARTNER:                { label: 'Socio',                cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30'       },
  COLLABORATOR:           { label: 'Colaborador',          cls: 'bg-gray-700 text-gray-400 border-gray-600'             },
};

const ACTIVITY_ICONS: Record<string, string> = {
  CREATED: '➕', UPDATED: '✏️', STATUS_CHANGED: '🔄',
  NOTE_ADDED: '📝', PROPOSAL_SENT: '📤', MILESTONE_COMPLETED: '✅',
};

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Edit profile form ──
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Change password form ──
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [changing, setChanging] = useState(false);

  // ── Admin: gestionar equipo ──
  const currentRole  = (session?.user as { role?: string })?.role ?? ''
  const isAdmin      = ['ADMIN', 'SUPERADMIN'].includes(currentRole)
  const isSuperAdmin = currentRole === 'SUPERADMIN'
  const [tab, setTab] = useState<'perfil' | 'equipo'>('perfil');
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string; role: string; avatar: string | null }[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'ARQUITECTO_SOLUCIONES' });
  const [userFormError, setUserFormError] = useState('');
  const [userSaving, setUserSaving] = useState(false);

  const fetchUsers = () => {
    fetch('/api/users').then(r => r.json()).then(setAllUsers);
  };

  const fetchProfile = () => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        setProfile(d);
        setEditName(d.user?.name || '');
        setEditEmail(d.user?.email || '');
        setEditAvatar(d.user?.avatar || '');
        setLoading(false);
      });
  };

  useEffect(() => { fetchProfile(); }, []);

  const openEdit = () => {
    if (profile?.user) {
      setEditName(profile.user.name);
      setEditEmail(profile.user.email);
      setEditAvatar(profile.user.avatar || '');
    }
    setEditError('');
    setEditSuccess('');
    setEditing(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setEditError('');
    setEditSuccess('');

    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateProfile', name: editName, email: editEmail, avatar: editAvatar }),
    });

    const data = await res.json();

    if (!res.ok) {
      setEditError(data.error || 'Error al guardar');
    } else {
      setEditSuccess('Perfil actualizado correctamente');
      setEditing(false);
      updateSession();
      fetchProfile();
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');

    if (newPassword !== confirmPassword) {
      setPwError('Las contraseñas nuevas no coinciden');
      return;
    }

    setChanging(true);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'changePassword', currentPassword, newPassword }),
    });

    const data = await res.json();

    if (!res.ok) {
      setPwError(data.error || 'Error al cambiar contraseña');
    } else {
      setPwSuccess('Contraseña cambiada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangingPassword(false);
    }
    setChanging(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  if (!profile?.user) return null;

  const { user, stats, recentActivity } = profile;
  const role = ROLE_LABELS[user.role] || ROLE_LABELS.COLLABORATOR;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const tasaConversion = stats.leads > 0 ? Math.round((stats.leadsGanados / stats.leads) * 100) : 0;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        {isAdmin && (
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <button onClick={() => setTab('perfil')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'perfil' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>Mi Perfil</button>
            <button onClick={() => { setTab('equipo'); fetchUsers(); }} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'equipo' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>Gestionar Equipo</button>
          </div>
        )}
      </div>

      {tab === 'equipo' && isAdmin ? (
        <div className="space-y-4">
          {allUsers.filter(u => u.role !== 'SUPERADMIN').map(u => (
            <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {u.avatar ? (
                  <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-semibold text-black text-xs">{u.name.split(' ').filter(w => w.length > 0).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {editingUser === u.id ? (
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})}
                      className="px-2 py-1 bg-gray-800 border border-gray-600 text-white rounded text-xs focus:ring-1 focus:ring-orange-500" placeholder="Nombre" />
                    <input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})}
                      className="px-2 py-1 bg-gray-800 border border-gray-600 text-white rounded text-xs focus:ring-1 focus:ring-orange-500" placeholder="Email" />
                    <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}
                      className="px-2 py-1 bg-gray-800 border border-gray-600 text-white rounded text-xs focus:ring-1 focus:ring-orange-500">
                      <option value="ADMIN">Admin</option>
                      <option value="GERENTE_COMERCIAL">Gerente Comercial</option>
                      <option value="GERENTE_ADMINISTRATIVO">Gerente Administrativo</option>
                      <option value="GERENTE_OPERACIONES">Gerente Operaciones</option>
                      <option value="ARQUITECTO_SOLUCIONES">Arquitecto Soluciones</option>
                      <option value="PARTNER">Socio</option>
                      <option value="COLLABORATOR">Colaborador</option>
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{u.name}</p>
                      {u.role === 'SUPERADMIN' && (
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">★ Super Admin</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {u.email} · <span className={ROLE_LABELS[u.role]?.cls?.split(' ')[1] ?? 'text-gray-500'}>{ROLE_LABELS[u.role]?.label || u.role}</span>
                    </p>
                  </>
                )}
                {userFormError && editingUser === u.id && <p className="text-xs text-red-400 mt-1">{userFormError}</p>}
              </div>
              <div className="flex gap-1">
                {u.role === 'SUPERADMIN' ? (
                  // SUPERADMIN no se puede editar ni eliminar desde aquí
                  <span className="text-[10px] text-gray-600 px-3 py-1">Protegido</span>
                ) : editingUser === u.id ? (
                  <>
                    <button onClick={async () => {
                      if (!userForm.name.trim() || !userForm.email.trim()) { setUserFormError('Nombre y email requeridos'); return; }
                      setUserSaving(true); setUserFormError('');
                      const res = await fetch(`/api/users`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, ...userForm }) });
                      if (res.ok) { setEditingUser(null); fetchUsers(); } else { const d = await res.json(); setUserFormError(d.error || 'Error'); }
                      setUserSaving(false);
                    }} disabled={userSaving}
                      className="px-3 py-1 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">Guardar</button>
                    <button onClick={() => setEditingUser(null)}
                      className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600">Cancelar</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingUser(u.id); setUserForm({ name: u.name, email: u.email, role: u.role }); setUserFormError(''); }}
                      className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg">Editar</button>
                    {!['ADMIN', 'SUPERADMIN'].includes(u.role) || isSuperAdmin ? (
                      <button onClick={async () => { await fetch(`/api/users`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id }) }); fetchUsers(); }}
                        className="px-3 py-1 text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 rounded-lg">Eliminar</button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <>
        {/* ── Perfil card ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 flex items-center gap-6">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 border-2 border-orange-500/30"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
            <span className="text-3xl font-black text-black">{initials}</span>
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">{user.name}</h2>
          <p className="text-gray-400 mt-0.5">{user.email}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${role.cls}`}>{role.label}</span>
            <span className="text-xs text-gray-500">Miembro desde {new Date(user.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* ── Editar perfil + Cambiar contraseña ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* ── Editar Perfil ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Editar Perfil</h3>
            {!editing && (
              <button onClick={openEdit} className="text-xs text-gray-400 hover:text-orange-400 transition-colors flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Editar
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nombre</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Avatar (URL de imagen)</label>
                <input
                  type="url"
                  value={editAvatar}
                  onChange={e => setEditAvatar(e.target.value)}
                  placeholder="https://ejemplo.com/foto.jpg"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
                {editAvatar && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={editAvatar} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-gray-700" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span className="text-xs text-gray-500">Vista previa</span>
                  </div>
                )}
              </div>

              {editError && (
                <div className="flex items-center gap-2 bg-red-900/20 border border-red-800 text-red-400 text-xs px-3 py-2 rounded-lg">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="flex items-center gap-2 bg-green-900/20 border border-green-800 text-green-400 text-xs px-3 py-2 rounded-lg">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {editSuccess}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex-1 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : 'Guardar cambios'}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditError(''); }}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-400 text-sm rounded-lg hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Nombre</span>
                <span className="text-gray-200">{user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="text-gray-200">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Avatar</span>
                <span className="text-gray-400 text-xs max-w-[180px] truncate">{user.avatar || 'No configurado'}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Cambiar Contraseña ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Cambiar Contraseña</h3>
            {!changingPassword && (
              <button onClick={() => setChangingPassword(true)} className="text-xs text-gray-400 hover:text-orange-400 transition-colors flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Cambiar
              </button>
            )}
          </div>

          {changingPassword ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Contraseña actual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nueva contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repetir contraseña"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              {pwError && (
                <div className="flex items-center gap-2 bg-red-900/20 border border-red-800 text-red-400 text-xs px-3 py-2 rounded-lg">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="flex items-center gap-2 bg-green-900/20 border border-green-800 text-green-400 text-xs px-3 py-2 rounded-lg">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {pwSuccess}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleChangePassword}
                  disabled={changing}
                  className="flex-1 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {changing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Cambiando...
                    </>
                  ) : 'Cambiar contraseña'}
                </button>
                <button
                  onClick={() => { setChangingPassword(false); setPwError(''); }}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-400 text-sm rounded-lg hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Contraseña</span>
                <span className="text-gray-400">••••••••</span>
              </div>
              <p className="text-xs text-gray-600">La contraseña se almacena encriptada con bcrypt.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Google Calendar ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profile.user.googleConnected ? 'bg-green-900/30' : 'bg-gray-800'}`}>
              <svg className={`w-5 h-5 ${profile.user.googleConnected ? 'text-green-400' : 'text-gray-500'}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 16.656a6.04 6.04 0 01-1.76 4.24 6.04 6.04 0 01-4.24 1.76H4.44a6.04 6.04 0 01-4.24-1.76A6.04 6.04 0 01-1.56 16.656V4.44a6.04 6.04 0 011.76-4.24A6.04 6.04 0 014.44-1.56H16.8a6.04 6.04 0 014.24 1.76 6.04 6.04 0 011.76 4.24v12.216z" transform="translate(1.56 1.56) scale(0.87)"/>
                <path d="M6.5 2.5V5M16.5 2.5V5M2.5 9.5h18M7 13.5l1.5 1.5 3-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Google Calendar</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {profile.user.googleConnected
                  ? 'Conectado — las reuniones se sincronizan automáticamente'
                  : 'Conecta tu cuenta de Google para sincronizar reuniones'}
              </p>
            </div>
          </div>
          {profile.user.googleConnected ? (
            <button
              onClick={async () => {
                await fetch('/api/profile', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'disconnectGoogle' }),
                });
                fetchProfile();
                updateSession();
              }}
              className="px-4 py-2 bg-red-900/30 border border-red-800/50 text-red-400 text-sm rounded-lg hover:bg-red-800/40 transition-colors"
            >
              Desconectar
            </button>
          ) : (
            <button
              onClick={() => signIn('google', { callbackUrl: '/profile' })}
              className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Conectar Google Calendar
            </button>
          )}
        </div>
      </div>

      {/* ── Microsoft 365 ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profile.user.microsoftConnected ? 'bg-blue-900/30' : 'bg-gray-800'}`}>
              <svg className={`w-5 h-5 ${profile.user.microsoftConnected ? 'text-blue-400' : 'text-gray-500'}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Microsoft 365</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {profile.user.microsoftConnected
                  ? 'Conectado — correo y calendario de Microsoft disponibles'
                  : 'Conecta tu cuenta de Microsoft 365 para correo y calendario'}
              </p>
            </div>
          </div>
          {profile.user.microsoftConnected ? (
            <button
              onClick={async () => {
                await fetch('/api/profile', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'disconnectMicrosoft' }),
                });
                fetchProfile();
                updateSession();
              }}
              className="px-4 py-2 bg-red-900/30 border border-red-800/50 text-red-400 text-sm rounded-lg hover:bg-red-800/40 transition-colors"
            >
              Desconectar
            </button>
          ) : (
            <a
              href="/api/auth/microsoft"
              className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              Conectar Microsoft 365
            </a>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Leads',          value: stats.leads,                                  color: 'text-white' },
          { label: 'Propuestas',     value: stats.proposals,                               color: 'text-blue-400' },
          { label: 'Proyectos',      value: stats.projects,                                color: 'text-green-400' },
          { label: 'Pipeline',       value: `$${stats.pipelineValue.toLocaleString()}`,    color: 'text-orange-400' },
          { label: 'Tasa Conv.',     value: `${tasaConversion}%`,                          color: 'text-purple-400' },
        ].map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Actividad reciente ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-4">Mi Actividad Reciente</h3>
        {recentActivity.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin actividad registrada aún.</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-800">
                <span className="text-lg flex-shrink-0">{ACTIVITY_ICONS[a.type] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300">{a.description}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(a.createdAt).toLocaleString('es-ES')} ·{' '}
                    <span className="text-orange-500 capitalize">{a.entityType}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
