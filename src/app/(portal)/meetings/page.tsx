'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { toDatetimeLocalInput, getDateStrUTC5, getTodayStrUTC5, getTimeStrUTC5, getDateFullUTC5, getDayUTC5, getWeekdayDateUTC5 } from '@/lib/timezone';

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  type: string;
  date: string;
  endDate: string | null;
  location: string | null;
  link: string | null;
  attendees: string | null;
  status: string;
  notes: string | null;
  actaFile: string | null;
  actaFileName: string | null;
  userId: string;
  user: { id: string; name: string; email: string };
  createdAt: string;
}

const EMPTY_FORM = {
  title: '', description: '', type: 'INTERNAL_DAILY',
  date: '', endDate: '', location: '', link: '',
  attendees: '', status: 'SCHEDULED', notes: '', userId: '',
};

const TYPE_COLORS: Record<string, string> = {
  INTERNAL_DAILY:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  INTERNAL_WORKSHOP: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  COMMERCIAL:        'bg-orange-500/20 text-orange-400 border-orange-500/30',
  ADVISORY:          'bg-purple-500/20 text-purple-400 border-purple-500/30',
  PROVIDER:          'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const TYPE_LABELS: Record<string, string> = {
  INTERNAL_DAILY: 'Reunión Interna - Daily',
  INTERNAL_WORKSHOP: 'Reunión Interna - Workshop',
  COMMERCIAL: 'Comercial',
  ADVISORY: 'Asesoría',
  PROVIDER: 'Proveedores',
};

const TYPE_SHORT: Record<string, string> = {
  INTERNAL_DAILY: 'Daily',
  INTERNAL_WORKSHOP: 'Workshop',
  COMMERCIAL: 'Comercial',
  ADVISORY: 'Asesoría',
  PROVIDER: 'Proveedores',
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/20 text-blue-400',
  COMPLETED: 'bg-green-500/20 text-green-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
};

function translateStatus(s: string) {
  return ({ SCHEDULED: 'Programada', COMPLETED: 'Completada', CANCELLED: 'Cancelada' } as Record<string, string>)[s] || s;
}

function resolveAttendees(attendees: string | null, users: { name: string; email: string }[]): string {
  if (!attendees) return '';
  return attendees.split(',').map(a => {
    const trimmed = a.trim();
    const user = users.find(u => u.email === trimmed);
    return user ? user.name : trimmed;
  }).join(', ');
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

export default function MeetingsPage() {
  const { data: session } = useSession();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'calendario' | 'semana' | 'lista'>('calendario');
  const [weekOffset, setWeekOffset] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [confirmDel, setConfirmDel] = useState<Meeting | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [actaFileBase64, setActaFileBase64] = useState('');
  const [actaFileNameState, setActaFileNameState] = useState('');
  const [externalAttendees, setExternalAttendees] = useState<string[]>([]);
  const [attendeeInput, setAttendeeInput] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/meetings').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([m, u]) => { setMeetings(m); setUsers(u); setLoading(false); });
  }, []);

  const openNew = () => {
    setEditMeeting(null);
    setFormError('');
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T09:00`;
    setForm({ ...EMPTY_FORM, date: today, userId: (session?.user as { id?: string })?.id || users[0]?.id || '', link: 'https://meet.google.com/usz-ysto-pcq' });
    setExternalAttendees([]);
    setAttendeeInput('');
    setActaFileBase64('');
    setActaFileNameState('');
    setShowModal(true);
  };

  const openEdit = (m: Meeting) => {
    setEditMeeting(m);
    setFormError('');
    setForm({
      title: m.title, description: m.description || '', type: m.type,
      date: toDatetimeLocalInput(m.date),
      endDate: m.endDate ? toDatetimeLocalInput(m.endDate) : '',
      location: m.location || '', link: m.link || '', attendees: m.attendees || '',
      status: m.status, notes: m.notes || '',
      userId: m.userId,
    });
    setExternalAttendees(m.attendees ? m.attendees.split(',').map(a => a.trim()).filter(Boolean) : []);
    setAttendeeInput('');
    setActaFileBase64(m.actaFile || '');
    setActaFileNameState(m.actaFileName || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const url = editMeeting ? `/api/meetings/${editMeeting.id}` : '/api/meetings';
      const method = editMeeting ? 'PUT' : 'POST';
      const body = form;
      const payload = { ...body, actaFile: actaFileBase64 || null, actaFileName: actaFileNameState || null };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const saved = await res.json();
        setMeetings(prev => editMeeting ? prev.map(m => m.id === saved.id ? saved : m) : [saved, ...prev]);
        setShowModal(false);
      } else {
        const d = await res.json();
        setFormError(d.error || `Error ${res.status}`);
      }
    } catch {
      setFormError('Error de conexión.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await fetch(`/api/meetings/${confirmDel.id}`, { method: 'DELETE' });
      setMeetings(prev => prev.filter(m => m.id !== confirmDel.id));
      setConfirmDel(null);
    } catch { /* ignore */ }
    setDeleting(false);
  };

  const handleActaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActaFileNameState(file.name);
    const reader = new FileReader();
    reader.onload = () => setActaFileBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleStatusToggle = async (meeting: Meeting) => {
    const newStatus = meeting.status === 'COMPLETED' ? 'SCHEDULED' : 'COMPLETED';
    const res = await fetch(`/api/meetings/${meeting.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m));
    }
  };

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = getTodayStrUTC5();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayMeetings = meetings.filter(m => getDateStrUTC5(m.date) === dateStr);
      days.push({ day: d, date: dateStr, meetings: dayMeetings, isToday: dateStr === today });
    }
    return days;
  }, [viewMonth, viewYear, meetings]);

  const filtered = useMemo(() => {
    return meetings.filter(m => {
      if (filterType && m.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!m.title.toLowerCase().includes(q) && !(m.attendees || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [meetings, filterType, search]);

  const dayMeetings = selectedDay ? meetings.filter(m => getDateStrUTC5(m.date) === selectedDay) : [];

  const thisWeekMeetings = useMemo(() => {
    const todayStr = getTodayStrUTC5();
    const todayUTC5 = new Date(todayStr + 'T00:00:00-05:00');
    const dayOfWeek = todayUTC5.getUTCDay();
    const monday = new Date(todayUTC5.getTime() - dayOfWeek * 86400000);
    const sunday = new Date(monday.getTime() + 7 * 86400000);
    return meetings
      .filter(m => {
        const d = new Date(m.date);
        return d >= monday && d < sunday;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [meetings]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  return (
    <div className="p-8">
      {/* Tabs + botón nueva reunión */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
          <button onClick={() => setTab('calendario')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'calendario' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>Mes</button>
          <button onClick={() => setTab('semana')}     className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'semana'     ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>Semana</button>
          <button onClick={() => setTab('lista')}      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'lista'      ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>Lista</button>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nueva Reunión
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total eventos', value: meetings.length, color: 'text-white' },
          { label: 'Programadas', value: meetings.filter(m => m.status === 'SCHEDULED').length, color: 'text-blue-400' },
          { label: 'Completadas', value: meetings.filter(m => m.status === 'COMPLETED').length, color: 'text-green-400' },
          { label: 'Esta semana', value: meetings.filter(m => {
            const todayStr = getTodayStrUTC5();
            const todayUTC5 = new Date(todayStr + 'T00:00:00-05:00');
            const dayOfWeek = todayUTC5.getUTCDay();
            const start = new Date(todayUTC5.getTime() - dayOfWeek * 86400000);
            const end = new Date(start.getTime() + 7 * 86400000);
            const d = new Date(m.date);
            return d >= start && d < end;
          }).length, color: 'text-orange-400' },
        ].map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {tab === 'calendario' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendario */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); }}
                className="p-1 text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h2 className="text-lg font-semibold text-white">{MONTHS[viewMonth]} {viewYear}</h2>
              <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); }}
                className="p-1 text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-7 text-center border-b border-gray-800">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-xs font-medium text-gray-500">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((d, i) => (
                <div
                  key={i}
                  onClick={() => d && setSelectedDay(d.date)}
                  className={`min-h-[80px] p-1.5 border-b border-r border-gray-800/50 cursor-pointer hover:bg-gray-800/30 transition-colors ${
                    d && d.date === selectedDay ? 'bg-orange-600/10 ring-1 ring-inset ring-orange-500/30' : ''
                  } ${d?.isToday ? 'bg-blue-600/5' : ''}`}
                >
                  {d && (
                    <>
                      <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        d.isToday ? 'bg-orange-600 text-white' : 'text-gray-300'
                      }`}>{d.day}</span>
                      <div className="mt-1 space-y-0.5">
                        {d.meetings.slice(0, 3).map(m => (
                          <div key={m.id} className={`text-xs truncate px-1 py-0.5 rounded border ${TYPE_COLORS[m.type] || TYPE_COLORS.OTHER}`}>
                            {m.title}
                          </div>
                        ))}
                        {d.meetings.length > 3 && (
                          <span className="text-xs text-gray-600">+{d.meetings.length - 3} más</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Panel del día / semana */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            {selectedDay ? (
              <>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  {getWeekdayDateUTC5(selectedDay)}
                </h3>
                {dayMeetings.length === 0 && (
                  <p className="text-gray-500 text-sm">Sin eventos este día.</p>
                )}
                <div className="space-y-3">
                  {dayMeetings.map(m => (
                    <div key={m.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-white">{m.title}</h4>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[m.status]}`}>
                          {translateStatus(m.status)}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs text-gray-400">
                        <p>{getTimeStrUTC5(m.date)}
                          {m.endDate ? ` — ${getTimeStrUTC5(m.endDate)}` : ''}
                        </p>
                        {m.location && <p>📍 {m.location}</p>}
                        {m.link && <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 block">🔗 Enlace</a>}
                        {m.attendees && <p>👥 {resolveAttendees(m.attendees, users)}</p>}
                        {m.notes && <p className="text-gray-500 mt-1 italic border-t border-gray-700 pt-1">📝 {m.notes.slice(0, 150)}{m.notes.length > 150 ? '...' : ''}</p>}
                        {m.actaFile && (
                          <a href={m.actaFile} download={m.actaFileName || 'acta'} className="text-xs text-orange-400 hover:text-orange-300 mt-1 block">
                            📎 Descargar {m.actaFileName || 'acta'}
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => openEdit(m)} className="text-xs text-gray-400 hover:text-white">Editar</button>
                        <button onClick={() => handleStatusToggle(m)} className={`text-xs ${m.status === 'COMPLETED' ? 'text-blue-400 hover:text-blue-300' : 'text-green-400 hover:text-green-300'}`}>
                          {m.status === 'COMPLETED' ? 'Reabrir' : 'Completar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-4">Esta Semana</h3>
                {thisWeekMeetings.length === 0 ? (
                  <p className="text-gray-500 text-sm">Sin eventos esta semana.</p>
                ) : (
                  <div className="space-y-4">
                    {(function () {
                      const grouped = new Map<string, typeof thisWeekMeetings>();
                      for (const m of thisWeekMeetings) {
                        const day = getDateStrUTC5(m.date);
                        if (!grouped.has(day)) grouped.set(day, []);
                        grouped.get(day)!.push(m);
                      }
                      return Array.from(grouped.entries()).map(([dateStr, dayMts]) => (
                        <div key={dateStr}>
                          <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                            {new Date(dateStr + 'T12:00:00-05:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Bogota' })}
                          </h4>
                          <div className="space-y-2">
                            {dayMts.map(m => (
                              <div key={m.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div>
                                    <h5 className="text-sm font-medium text-white leading-tight">{m.title}</h5>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      {getTimeStrUTC5(m.date)}
                                      {m.endDate ? ` — ${getTimeStrUTC5(m.endDate)}` : ''}
                                      <span className={`ml-1.5 px-1 py-0.5 rounded text-xs ${TYPE_COLORS[m.type] || 'bg-gray-700 text-gray-400'}`}>{TYPE_SHORT[m.type] || m.type}</span>
                                      <span className={`ml-1.5 px-1 py-0.5 rounded text-xs ${STATUS_COLORS[m.status]}`}>{translateStatus(m.status)}</span>
                                    </p>
                                  </div>
                                </div>
                                {m.attendees && <p className="text-xs text-gray-500 mt-1">👥 {resolveAttendees(m.attendees, users)}</p>}
                                <div className="flex gap-2 mt-2">
                                  <button onClick={() => openEdit(m)} className="text-xs text-gray-500 hover:text-gray-300">Editar</button>
                                  <button onClick={() => handleStatusToggle(m)} className={`text-xs ${m.status === 'COMPLETED' ? 'text-blue-400 hover:text-blue-300' : 'text-green-400 hover:text-green-300'}`}>
                                    {m.status === 'COMPLETED' ? 'Reabrir' : 'Completar'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : tab === 'semana' ? (() => {
        // Calcular inicio de semana (lunes) según weekOffset
        const now = new Date();
        const day = now.getDay(); // 0=dom
        const diffToMon = (day === 0 ? -6 : 1 - day);
        const monday = new Date(now);
        monday.setHours(0, 0, 0, 0);
        monday.setDate(now.getDate() + diffToMon + weekOffset * 7);

        const WEEK_DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
        const weekDates = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
        });

        const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7–21
        const PX_PER_MIN = 56 / 60; // 56px por hora

        const getMins = (dateStr: string) => {
          const d = new Date(dateStr);
          return (d.getHours() - 5) * 60 + d.getMinutes(); // UTC-5
        };

        const todayStr = new Date().toDateString();

        const weekLabel = (() => {
          const end = weekDates[6];
          const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
          return `${monday.toLocaleDateString('es-ES', opts)} – ${end.toLocaleDateString('es-ES', opts)}, ${monday.getFullYear()}`;
        })();

        return (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {/* Navegación semana */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
              <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 text-gray-400 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-white">{weekLabel}</span>
                {weekOffset !== 0 && (
                  <button onClick={() => setWeekOffset(0)} className="text-xs text-orange-400 hover:text-orange-300">Hoy</button>
                )}
              </div>
              <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 text-gray-400 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            <div className="overflow-x-auto">
              <div className="flex" style={{ minWidth: '640px' }}>
                {/* Columna de horas */}
                <div className="w-14 flex-shrink-0 border-r border-gray-800">
                  <div className="h-10 border-b border-gray-800" />
                  {HOURS.map(h => (
                    <div key={h} style={{ height: '56px' }} className="relative flex items-start justify-end pr-2 pt-1">
                      <span className="text-[10px] text-gray-600 tabular-nums">{String(h).padStart(2,'0')}:00</span>
                    </div>
                  ))}
                </div>

                {/* Columnas de días */}
                {weekDates.map((date, di) => {
                  const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
                  const isToday = date.toDateString() === todayStr;
                  const dayMeetings = meetings.filter(m => {
                    const d = new Date(m.date);
                    const mStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    return mStr === dateStr;
                  });

                  return (
                    <div key={di} className="flex-1 border-r border-gray-800 last:border-r-0 min-w-0">
                      {/* Header día */}
                      <div className={`h-10 border-b border-gray-800 flex flex-col items-center justify-center ${isToday ? 'bg-orange-500/10' : ''}`}>
                        <span className="text-[10px] text-gray-500">{WEEK_DAYS[di]}</span>
                        <span className={`text-sm font-semibold ${isToday ? 'text-orange-400' : 'text-gray-300'}`}>{date.getDate()}</span>
                      </div>

                      {/* Grid horas + meetings */}
                      <div className="relative" style={{ height: `${HOURS.length * 56}px` }}>
                        {/* Líneas de hora */}
                        {HOURS.map((_, hi) => (
                          <div key={hi} style={{ top: `${hi * 56}px` }} className="absolute inset-x-0 border-t border-gray-800/50 pointer-events-none" />
                        ))}
                        {/* Línea de "ahora" */}
                        {isToday && (() => {
                          const now = new Date();
                          const mins = (now.getHours() - 5) * 60 + now.getMinutes();
                          const top = (mins - 7 * 60) * PX_PER_MIN;
                          if (top < 0 || top > HOURS.length * 56) return null;
                          return (
                            <div style={{ top: `${top}px` }} className="absolute inset-x-0 h-px bg-orange-500 z-10 pointer-events-none">
                              <div className="w-2 h-2 bg-orange-500 rounded-full -mt-0.5 -ml-1" />
                            </div>
                          );
                        })()}

                        {/* Eventos */}
                        {dayMeetings.map(m => {
                          const startMins = getMins(m.date) - 7 * 60;
                          const endMins = m.endDate ? getMins(m.endDate) - 7 * 60 : startMins + 60;
                          const top = Math.max(startMins * PX_PER_MIN, 0);
                          const height = Math.max((endMins - startMins) * PX_PER_MIN, 22);
                          const colorMap: Record<string, string> = {
                            INTERNAL_DAILY: 'bg-blue-600/80 border-blue-500',
                            INTERNAL_WORKSHOP: 'bg-cyan-600/80 border-cyan-500',
                            COMMERCIAL: 'bg-orange-600/80 border-orange-500',
                            ADVISORY: 'bg-purple-600/80 border-purple-500',
                            PROVIDER: 'bg-emerald-600/80 border-emerald-500',
                          };
                          const cls = colorMap[m.type] ?? 'bg-gray-600/80 border-gray-500';
                          return (
                            <div
                              key={m.id}
                              onClick={() => openEdit(m)}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              className={`absolute inset-x-0.5 rounded px-1.5 py-0.5 border-l-2 cursor-pointer overflow-hidden ${cls} ${m.status === 'COMPLETED' ? 'opacity-50' : ''} hover:brightness-110 transition-all`}
                              title={m.title}
                            >
                              <p className="text-[10px] text-white font-medium leading-tight truncate">{m.title}</p>
                              {height > 30 && (
                                <p className="text-[9px] text-white/70 leading-tight">
                                  {getTimeStrUTC5(m.date)}{m.endDate ? `–${getTimeStrUTC5(m.endDate)}` : ''}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })() : (
        <>
          {/* Filtros lista */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6 flex gap-3 flex-wrap items-center">
            <input type="text" placeholder="Buscar por título o asistentes..." value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-48 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-orange-500" />
            {['', 'INTERNAL_DAILY', 'INTERNAL_WORKSHOP', 'COMMERCIAL', 'ADVISORY', 'PROVIDER'].map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${filterType === t ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {t === '' ? 'Todas' : TYPE_LABELS[t]}
              </button>
            ))}
            <button onClick={openNew} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium">
              + Nuevo Evento
            </button>
          </div>

          {/* Lista */}
          <div className="space-y-3">
            {filtered.map(m => (
              <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${m.status === 'COMPLETED' ? 'bg-green-900/30 text-green-400' : m.status === 'CANCELLED' ? 'bg-red-900/30 text-red-400' : 'bg-orange-900/30 text-orange-400'}`}>
                      {getDayUTC5(m.date)}
                    </div>
                    <div>
                      <h3 className={`font-semibold text-white ${m.status === 'CANCELLED' ? 'line-through opacity-50' : ''}`}>{m.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${TYPE_COLORS[m.type] || TYPE_COLORS.OTHER}`}>{TYPE_LABELS[m.type] || m.type}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[m.status]}`}>{translateStatus(m.status)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(m)} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg">Editar</button>
                    <button onClick={() => handleStatusToggle(m)} className={`px-3 py-1 text-xs rounded-lg ${m.status === 'COMPLETED' ? 'bg-blue-900/30 hover:bg-blue-800/50 text-blue-400' : 'bg-green-900/30 hover:bg-green-800/50 text-green-400'}`}>
                      {m.status === 'COMPLETED' ? 'Reabrir' : '✓'}
                    </button>
                    <button onClick={() => setConfirmDel(m)} className="px-3 py-1 text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 rounded-lg">×</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-400">
                  <p>📅 {getDateFullUTC5(m.date)} {getTimeStrUTC5(m.date)}</p>
                  {m.location && <p>📍 {m.location}</p>}
                  {m.attendees && <p>👥 {resolveAttendees(m.attendees, users)}</p>}
                  <p>👤 {m.user.name}</p>
                </div>
                {m.notes && (
                  <p className="text-sm text-gray-500 mt-3 border-t border-gray-800 pt-3 italic">📝 {m.notes.slice(0, 200)}{m.notes.length > 200 ? '...' : ''}</p>
                )}
                {m.actaFile && (
                  <a href={m.actaFile} download={m.actaFileName || 'acta'} className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 mt-2">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Descargar {m.actaFileName || 'acta'}
                  </a>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg mb-2">No hay eventos</p>
                <p className="text-sm">Crea tu primer evento con el botón "Nuevo Evento".</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal crear / editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">{editMeeting ? 'Editar Evento' : 'Nuevo Evento'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Título</label>
                  <input type="text" required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tipo</label>
                  <select value={form.type} onChange={e => {
                    const t = e.target.value;
                    setForm({...form, type: t, link: t === 'INTERNAL_DAILY' ? 'https://meet.google.com/usz-ysto-pcq' : (form.type === 'INTERNAL_DAILY' ? '' : form.link)});
                  }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                    <option value="INTERNAL_DAILY">Reunión Interna - Daily</option>
                    <option value="INTERNAL_WORKSHOP">Reunión Interna - Workshop</option>
                    <option value="COMMERCIAL">Comercial</option>
                    <option value="ADVISORY">Asesoría</option>
                    <option value="PROVIDER">Proveedores</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {/* Fecha */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Fecha</label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <input type="date" required value={form.date ? form.date.slice(0, 10) : ''}
                        onChange={e => {
                          const time = form.date ? form.date.slice(11, 16) : '09:00';
                          setForm({...form, date: `${e.target.value}T${time}`});
                        }}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm [color-scheme:dark]" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <select value={form.date ? form.date.slice(11, 13) : '09'}
                        onChange={e => {
                          const date = form.date ? form.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
                          const min = form.date ? form.date.slice(14, 16) : '00';
                          setForm({...form, date: `${date}T${e.target.value}:${min}`});
                        }}
                        className="w-16 px-2 py-2.5 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm text-center">
                        {Array.from({length: 24}, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="text-gray-500 text-sm">:</span>
                      <select value={form.date ? form.date.slice(14, 16) : '00'}
                        onChange={e => {
                          const date = form.date ? form.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
                          const hour = form.date ? form.date.slice(11, 13) : '09';
                          setForm({...form, date: `${date}T${hour}:${e.target.value}`});
                        }}
                        className="w-16 px-2 py-2.5 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm text-center">
                        {['00','15','30','45'].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <span className="text-xs text-gray-500 ml-1">hrs</span>
                    </div>
                  </div>
                  {form.date && (
                    <p className="text-xs text-orange-400/60 mt-1.5">
                      {new Date(form.date + ':00-05:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  )}
                </div>

                {/* Fin */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm text-gray-400">Fin</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (form.endDate) {
                          setForm({...form, endDate: ''});
                        } else if (form.date) {
                          const startDate = form.date.slice(0, 10);
                          const startHour = parseInt(form.date.slice(11, 13));
                          const startMin = form.date.slice(14, 16);
                          const endHour = startHour + 1;
                          setForm({...form, endDate: `${startDate}T${String(endHour).padStart(2, '0')}:${startMin}`});
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.endDate ? 'bg-orange-600' : 'bg-gray-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.endDate ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    {form.endDate && (
                      <span className="text-xs text-gray-500">(opcional)</span>
                    )}
                  </div>
                  {form.endDate ? (
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <input type="date" value={form.endDate.slice(0, 10)}
                          onChange={e => {
                            const time = form.endDate.slice(11, 16) || '10:00';
                            setForm({...form, endDate: `${e.target.value}T${time}`});
                          }}
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm [color-scheme:dark]" />
                      </div>
                      <select value={form.endDate.slice(11, 13) || '10'}
                        onChange={e => {
                          const date = form.endDate.slice(0, 10);
                          const min = form.endDate.slice(14, 16) || '00';
                          setForm({...form, endDate: `${date}T${e.target.value}:${min}`});
                        }}
                        className="w-16 px-2 py-2.5 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm text-center">
                        {Array.from({length: 24}, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="text-gray-500 text-sm self-center">:</span>
                      <select value={form.endDate.slice(14, 16) || '00'}
                        onChange={e => {
                          const date = form.endDate.slice(0, 10);
                          const hour = form.endDate.slice(11, 13) || '10';
                          setForm({...form, endDate: `${date}T${hour}:${e.target.value}`});
                        }}
                        className="w-16 px-2 py-2.5 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm text-center">
                        {['00','15','30','45'].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  ) : form.date ? (
                    <div className="flex gap-2">
                      {[
                        { label: '30 min', mins: 30 },
                        { label: '1 h', mins: 60 },
                        { label: '1.5 h', mins: 90 },
                        { label: '2 h', mins: 120 },
                      ].map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            const startDate = form.date.slice(0, 10);
                            const startHour = parseInt(form.date.slice(11, 13));
                            const startMin = parseInt(form.date.slice(14, 16));
                            const totalMin = startHour * 60 + startMin + p.mins;
                            const endH = Math.floor(totalMin / 60) % 24;
                            const endM = totalMin % 60;
                            setForm({...form, endDate: `${startDate}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`});
                          }}
                          className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-400 rounded-lg hover:border-orange-500/50 hover:text-orange-400 transition-colors"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">Selecciona primero la fecha de inicio</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Ubicación</label>
                  <select value={form.location} onChange={e => setForm({...form, location: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                    <option value="">Seleccionar...</option>
                    <option value="Presencial">Presencial</option>
                    <option value="Virtual">Virtual</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Dirección (URL)</label>
                  <div className="relative group">
                    <input
                      type="url"
                      value={form.link}
                      onChange={e => setForm({...form, link: e.target.value})}
                      placeholder="https://meet.google.com/..."
                      readOnly={form.type === 'INTERNAL_DAILY'}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none ${
                        form.type === 'INTERNAL_DAILY'
                          ? 'bg-gray-800/50 border-gray-700 text-gray-400 cursor-not-allowed select-none'
                          : 'bg-gray-800 border-gray-600 text-white focus:ring-2 focus:ring-orange-500 placeholder-gray-500'
                      }`}
                    />
                    {form.type === 'INTERNAL_DAILY' && (
                      <a
                        href={form.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900/80 text-orange-400 text-xs font-medium gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        Abrir enlace
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-gray-400">Asistentes</label>
                  <button
                    type="button"
                    onClick={() => {
                      const teamNames = ['Daniel Martinez', 'Santiago Ortega', 'Freddy Orozco'];
                      const toAdd = teamNames.filter(n => !externalAttendees.includes(n));
                      if (toAdd.length === 0) return;
                      const updated = [...externalAttendees, ...toAdd];
                      setExternalAttendees(updated);
                      setForm({...form, attendees: updated.join(', ')});
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-orange-600/15 border border-orange-500/30 text-orange-400 rounded-lg hover:bg-orange-600/25 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Equipo ArchitechIA
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={attendeeInput}
                    onChange={e => setAttendeeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && attendeeInput.trim()) {
                        e.preventDefault();
                        const name = attendeeInput.trim();
                        if (!externalAttendees.includes(name)) {
                          const updated = [...externalAttendees, name];
                          setExternalAttendees(updated);
                          setForm({...form, attendees: updated.join(', ')});
                        }
                        setAttendeeInput('');
                      }
                      if (e.key === 'Backspace' && !attendeeInput && externalAttendees.length > 0) {
                        const updated = externalAttendees.slice(0, -1);
                        setExternalAttendees(updated);
                        setForm({...form, attendees: updated.join(', ')});
                      }
                    }}
                    placeholder="Nombre o email y presiona Enter..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm placeholder-gray-500" />
                  {attendeeInput.trim() && (() => {
                    const q = attendeeInput.trim().toLowerCase();
                    const suggestions = users.filter(u =>
                      u.role !== 'ADMIN' &&
                      !externalAttendees.includes(u.email) &&
                      !externalAttendees.includes(u.name) &&
                      (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
                    ).slice(0, 5);
                    if (suggestions.length === 0) return null;
                    return (
                      <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg overflow-hidden">
                        {suggestions.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              const updated = [...externalAttendees, u.email];
                              setExternalAttendees(updated);
                              setForm({...form, attendees: updated.join(', ')});
                              setAttendeeInput('');
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-700 flex items-center gap-3 transition-colors"
                          >
                            <span className="w-7 h-7 rounded-full bg-orange-900/30 text-orange-400 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                              {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm text-white truncate">{u.name}</p>
                              <p className="text-xs text-gray-500 truncate">{u.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                  {externalAttendees.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {externalAttendees.map((a, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-xs text-orange-300">
                          {a}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = externalAttendees.filter((_, j) => j !== i);
                              setExternalAttendees(updated);
                              setForm({...form, attendees: updated.join(', ')});
                            }}
                            className="ml-0.5 text-orange-400 hover:text-white"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {form.type !== 'INTERNAL_DAILY' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Descripción</label>
                  <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Acta / Notas de reunión</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={4}
                  placeholder="Puntos tratados, acuerdos, tareas pendientes..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm placeholder-gray-500" />
                <div className="mt-2 flex items-center gap-3">
                  <label className="px-3 py-1.5 bg-gray-800 border border-gray-600 text-gray-400 rounded-lg cursor-pointer hover:border-gray-500 text-xs flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    {actaFileNameState ? actaFileNameState : 'Adjuntar documento (PDF, DOCX, etc.)'}
                    <input type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onChange={handleActaUpload} className="hidden" />
                  </label>
                  {actaFileBase64 && (
                    <button onClick={() => { setActaFileBase64(''); setActaFileNameState(''); }}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Quitar archivo</button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Estado</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                  <option value="SCHEDULED">Programada</option>
                  <option value="COMPLETED">Completada</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
              </div>
              {formError && (
                <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">{formError}</div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-700 text-gray-300 text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 text-sm font-medium flex items-center gap-2">
                  {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {editMeeting ? 'Guardar Cambios' : 'Crear Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">Eliminar evento</h3>
                <p className="text-gray-400 text-sm">¿Eliminar <span className="text-white font-medium">{confirmDel.title}</span>?</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-2">
                {deleting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
