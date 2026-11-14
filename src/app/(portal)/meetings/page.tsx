'use client';

import { useEffect, useState, useMemo } from 'react';
import MeetingHub from "./MeetingHub";
import AgendadorPanel from "./AgendadorPanel";
import type { DatosReunion } from './DatosClave';
import { getDateStrUTC5, getTodayStrUTC5, getTimeStrUTC5, getDateFullUTC5, getDayUTC5, getWeekdayDateUTC5 } from '@/lib/timezone';

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
  hub: string | null;
  userId: string;
  user: { id: string; name: string; email: string };
  createdAt: string;
}

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

// Reunión vacía que usa el popup en modo crear
const MEETING_NUEVA = {
  id: '', title: '', type: 'INTERNAL_DAILY', status: 'SCHEDULED', link: null, location: null, hub: null,
  actaFile: null, actaFileName: null, date: new Date().toISOString(), endDate: null, createdAt: new Date().toISOString(),
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string; contacto: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'calendario' | 'semana' | 'registros'>('calendario');
  const [weekOffset, setWeekOffset] = useState(0);
  // Día con el que se abre el popup en modo crear (null = cerrado)
  const [nuevoDia, setNuevoDia] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [confirmDel, setConfirmDel] = useState<Meeting | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  // Popup de la reunión (único: crear y trabajar la reunión)
  const [hubMeetingId, setHubMeetingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/meetings').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/clientes').then(r => r.json()),
    ]).then(([m, u, c]) => { setMeetings(m); setUsers(u); setClientes(Array.isArray(c) ? c : []); setLoading(false); });
  }, []);

  // dia: fecha elegida (AAAA-MM-DD); si no se pasa, se usa la de hoy
  const openNew = (dia?: string) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    setNuevoDia(typeof dia === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dia) ? dia : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  };

  // Crea la reunión desde el popup; devuelve el mensaje de error, o null si salió bien
  const crearReunion = async (datos: DatosReunion, hub: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...datos, hub }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); return d.error || `Error ${res.status}`; }
      const saved = await res.json();
      setMeetings(prev => [saved, ...prev]);
      setNuevoDia(null);
      setHubMeetingId(saved.id);
      return null;
    } catch { return 'Error de conexión.'; }
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
    <div className="page-wrap">
      {/* Tabs + botón nueva reunión */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={() => setTab('calendario')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'calendario' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>Mes</button>
          <button onClick={() => setTab('semana')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === 'semana' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            Semana
            {thisWeekMeetings.length > 0 && (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none ${tab === 'semana' ? 'bg-white/20 text-white' : 'bg-orange-600/80 text-white'}`}>{thisWeekMeetings.length}</span>
            )}
          </button>
          <button onClick={() => setTab('registros')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === 'registros' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            Registros
            {meetings.length > 0 && (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none ${tab === 'registros' ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'}`}>{meetings.length}</span>
            )}
          </button>
        </div>
        <button onClick={() => openNew()} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nueva Reunión
        </button>
      </div>

      {tab === 'calendario' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendario */}
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
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
            <div className="grid grid-cols-7 text-center border-b border-white/[0.06]">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-xs font-medium text-[#7f8a9c]">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((d, i) => (
                <div
                  key={i}
                  onClick={() => d && setSelectedDay(d.date)}
                  className={`min-h-[80px] p-1.5 border-b border-r border-white/[0.04] transition-colors group relative ${
                    d ? 'cursor-pointer hover:bg-white/[0.03]' : ''
                  } ${d && d.date === selectedDay ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/40' : ''} ${d?.isToday && d.date !== selectedDay ? 'bg-orange-500/5' : ''}`}
                >
                  {d && (
                    <>
                      <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        d.isToday ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/40' :
                        d.date === selectedDay ? 'bg-blue-500/30 text-blue-200 ring-1 ring-blue-400/50' :
                        'text-gray-400'
                      }`}>{d.day}</span>
                      <div className="mt-1 space-y-0.5">
                        {d.meetings.slice(0, 3).map(m => (
                          <div key={m.id} title={m.title} className={`text-xs truncate px-1 py-0.5 rounded border ${TYPE_COLORS[m.type] || TYPE_COLORS.OTHER}`}>
                            {m.title}
                          </div>
                        ))}
                        {d.meetings.length > 3 && (
                          <span className="text-xs text-[#7f8a9c]">+{d.meetings.length - 3}</span>
                        )}
                      </div>
                      {d.meetings.length === 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedDay(d.date); openNew(d.date); }}
                          className="absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[#7f8a9c] hover:text-white hover:bg-orange-600/60"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Panel del día / semana */}
          <div className="card p-5">
            {selectedDay ? (
              <>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  {getWeekdayDateUTC5(selectedDay)}
                </h3>
                {dayMeetings.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <svg className="w-5 h-5 text-[#7f8a9c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <p className="text-[#7f8a9c] text-xs text-center">Sin eventos</p>
                    <button onClick={() => openNew(selectedDay ?? undefined)} className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Agregar evento
                    </button>
                  </div>
                )}
                <div className="space-y-3">
                  {dayMeetings.map(m => (
                    <div key={m.id} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
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
                        {m.location && (
                          <p className="flex items-center gap-1.5">
                            <svg className="w-3 h-3 flex-shrink-0 text-[#7f8a9c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {m.location}
                          </p>
                        )}
                        {m.link && (
                          <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 flex items-center gap-1.5">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            Enlace
                          </a>
                        )}
                        {m.attendees && (
                          <p className="flex items-start gap-1.5">
                            <svg className="w-3 h-3 flex-shrink-0 mt-0.5 text-[#7f8a9c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {resolveAttendees(m.attendees, users)}
                          </p>
                        )}
                        {m.notes && (
                          <p className="flex items-start gap-1.5 text-[#7f8a9c] mt-1 italic border-t border-white/[0.06] pt-1">
                            <svg className="w-3 h-3 flex-shrink-0 mt-0.5 text-[#7f8a9c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            {m.notes.slice(0, 150)}{m.notes.length > 150 ? '...' : ''}
                          </p>
                        )}
                        {m.actaFile && (
                          <a href={m.actaFile} download={m.actaFileName || 'acta'} className="text-xs text-orange-400 hover:text-orange-300 mt-1 flex items-center gap-1.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            {m.actaFileName || 'acta'}
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => setHubMeetingId(m.id)} className="text-xs font-semibold text-orange-400 hover:text-orange-300">Abrir hub</button>
                        <button onClick={() => handleStatusToggle(m)} className={`text-xs transition-colors ${m.status === 'COMPLETED' ? 'text-[#7f8a9c] hover:text-blue-400' : 'text-green-400 hover:text-green-300'}`}>
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
                  <p className="text-[#7f8a9c] text-sm">Sin eventos esta semana.</p>
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
                          <h4 className="text-xs font-semibold text-[#7f8a9c] mb-2 uppercase">
                            {new Date(dateStr + 'T12:00:00-05:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Bogota' })}
                          </h4>
                          <div className="space-y-2">
                            {dayMts.map(m => (
                              <div key={m.id} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
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
                                {m.attendees && (
                  <p className="text-xs text-[#7f8a9c] mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {resolveAttendees(m.attendees, users)}
                  </p>
                )}
                                <div className="flex gap-2 mt-2">
                                  <button onClick={() => setHubMeetingId(m.id)} className="text-xs font-semibold text-orange-400 hover:text-orange-300">Abrir hub</button>
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
          <div className="card overflow-hidden">
            {/* Navegación semana */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06]">
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
                <div className="w-14 flex-shrink-0 border-r border-white/[0.06]">
                  <div className="h-10 border-b border-white/[0.06]" />
                  {HOURS.map(h => (
                    <div key={h} style={{ height: '56px' }} className="relative flex items-start justify-end pr-2 pt-1">
                      <span className="text-[11px] text-[#7f8a9c] tabular-nums">{String(h).padStart(2,'0')}:00</span>
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
                    <div key={di} className="flex-1 border-r border-white/[0.06] last:border-r-0 min-w-0">
                      {/* Header día */}
                      <div className={`h-10 border-b border-white/[0.06] flex flex-col items-center justify-center ${isToday ? 'bg-orange-500/10' : ''}`}>
                        <span className="text-[11px] text-[#7f8a9c]">{WEEK_DAYS[di]}</span>
                        <span className={`text-sm font-semibold ${isToday ? 'text-orange-400' : 'text-gray-300'}`}>{date.getDate()}</span>
                      </div>

                      {/* Grid horas + meetings */}
                      <div className="relative" style={{ height: `${HOURS.length * 56}px` }}>
                        {/* Líneas de hora */}
                        {HOURS.map((_, hi) => (
                          <div key={hi} style={{ top: `${hi * 56}px` }} className="absolute inset-x-0 border-t border-white/[0.04] pointer-events-none" />
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
                              onClick={() => setHubMeetingId(m.id)}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              className={`absolute inset-x-0.5 rounded px-1.5 py-0.5 border-l-2 cursor-pointer overflow-hidden ${cls} ${m.status === 'COMPLETED' ? 'opacity-50' : ''} hover:brightness-110 transition-all`}
                              title={m.title}
                            >
                              <p className="text-[11px] text-white font-medium leading-tight truncate">{m.title}</p>
                              {height > 30 && (
                                <p className="text-[10px] text-white/70 leading-tight">
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
      })() : tab === 'registros' ? (() => {
        const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
        const byMonth: {[k:string]:typeof sorted} = {};
        for (const m of sorted) {
          const key = m.date.slice(0, 7);
          if (!byMonth[key]) byMonth[key] = [];
          byMonth[key].push(m);
        }
        const monthLabel = (key: string) => {
          const [y, mo] = key.split('-');
          return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        };
        const total = meetings.length;
        const completed = meetings.filter(m => m.status === 'COMPLETED').length;
        const scheduled = meetings.filter(m => m.status === 'SCHEDULED').length;
        const pct = total > 0 ? Math.round(completed / total * 100) : 0;
        return (
          <div className="space-y-6">
            {/* Resumen estadístico */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total registros', value: total, color: 'text-white', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
                { label: 'Completadas', value: completed, color: 'text-green-400', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                { label: 'Pendientes', value: scheduled, color: 'text-blue-400', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                { label: 'Tasa cierre', value: `${pct}%`, color: 'text-orange-400', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
              ].map(s => (
                <div key={s.label} className="card p-4 flex items-center gap-3">
                  <div className={`${s.color} opacity-60`}>{s.icon}</div>
                  <div>
                    <p className="text-[11px] text-[#7f8a9c] uppercase tracking-wide">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Barra de progreso completadas */}
            {total > 0 && (
              <div className="card px-4 py-3">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>Progreso global</span>
                  <span className="text-orange-400 font-semibold">{pct}% completado</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            {/* Registros agrupados por mes */}
            {Object.keys(byMonth).length === 0 ? (
              <div className="text-center py-16 text-[#7f8a9c]">
                <p>Sin registros.</p>
              </div>
            ) : (
              Object.entries(byMonth).map(([monthKey, monthMeetings]) => (
                <div key={monthKey}>
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest capitalize">{monthLabel(monthKey)}</h3>
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <span className="text-[11px] text-[#7f8a9c]">{monthMeetings.length} eventos</span>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                    {monthMeetings.map((m, idx) => (
                      <div key={m.id} className={`flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors ${idx > 0 ? 'border-t border-white/[0.04]' : ''}`}>
                        {/* Fecha */}
                        <div className="w-12 flex-shrink-0 text-center">
                          <p className="text-[11px] text-[#7f8a9c] uppercase">{new Date(m.date + (m.date.length === 10 ? 'T12:00:00-05:00' : '')).toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'America/Bogota' })}</p>
                          <p className="text-lg font-bold text-gray-300 leading-none">{getDayUTC5(m.date)}</p>
                        </div>
                        {/* Barra de tipo */}
                        <div className="w-0.5 self-stretch rounded-full flex-shrink-0" style={{ background: m.type === 'COMMERCIAL' ? '#f97316' : m.type === 'INTERNAL_DAILY' ? '#3b82f6' : m.type === 'INTERNAL_WORKSHOP' ? '#06b6d4' : m.type === 'ADVISORY' ? '#a855f7' : m.type === 'PROVIDER' ? '#10b981' : '#6b7280' }} />
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{m.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-[#7f8a9c]">{getTimeStrUTC5(m.date)}{m.endDate ? ` — ${getTimeStrUTC5(m.endDate)}` : ''}</span>
                            <span className={`text-[11px] px-1.5 py-0.5 rounded border ${TYPE_COLORS[m.type] || TYPE_COLORS.OTHER}`}>{TYPE_SHORT[m.type] || m.type}</span>
                          </div>
                        </div>
                        {/* Asistentes */}
                        {m.attendees && (
                          <p className="hidden md:block text-xs text-[#7f8a9c] max-w-[180px] truncate flex-shrink-0">{resolveAttendees(m.attendees, users)}</p>
                        )}
                        {/* Estado + acciones */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[m.status]}`}>{translateStatus(m.status)}</span>
                          <button onClick={() => setHubMeetingId(m.id)} title="Abrir hub de la reunión" className="px-2 py-1 text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition-colors rounded hover:bg-white/[0.05]">Hub</button>
                          <button onClick={() => setConfirmDel(m)} className="p-1.5 text-[#7f8a9c] hover:text-red-400 transition-colors rounded hover:bg-red-900/20">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })() : null}

      {/* Modal crear / editar */}
      {/* Popup de la reunión: abrir y trabajar una existente */}
      {hubMeetingId && (() => {
        const hm = meetings.find(m => m.id === hubMeetingId);
        if (!hm) return null;
        return (
          <MeetingHub
            key={hm.id}
            meeting={hm}
            users={users}
            clientes={clientes}
            onClose={() => setHubMeetingId(null)}
            onToggleStatus={() => { void handleStatusToggle(hm); }}
            onHubSaved={(id, hub) => setMeetings(prev => prev.map(m => m.id === id ? { ...m, hub } : m))}
            onActaChanged={u => setMeetings(prev => prev.map(m => m.id === u.id ? { ...m, actaFile: u.actaFile, actaFileName: u.actaFileName } : m))}
            onMeetingUpdated={u => setMeetings(prev => prev.map(m => m.id === u.id ? ({ ...m, ...u } as Meeting) : m))}
          />
        );
      })()}

      {/* Popup de la reunión en modo crear */}
      {nuevoDia && (
        <MeetingHub
          key="nuevo"
          meeting={MEETING_NUEVA}
          crear={{ dia: nuevoDia, onCrear: crearReunion }}
          users={users}
          clientes={clientes}
          onClose={() => setNuevoDia(null)}
          onToggleStatus={() => {}}
          onHubSaved={() => {}}
          onActaChanged={() => {}}
          onMeetingUpdated={() => {}}
        />
      )}

      {/* Modal eliminar */}
      {confirmDel && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)' }}>
          <div className="rounded-2xl p-6 w-full max-w-md relative overflow-hidden" style={{ background: 'rgba(14,10,28,0.50)', backdropFilter: 'blur(48px) saturate(200%)', WebkitBackdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 40px 80px rgba(0,0,0,0.65), 0 0 60px rgba(239,68,68,0.07)', animation: 'liquidModalIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2) 50%, transparent)' }} />
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
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 rounded-lg text-gray-300 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.1)' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-2">
                {deleting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      <AgendadorPanel onCambio={() => { fetch("/api/meetings").then(r => r.json()).then(setMeetings); }} />
    </div>
  );
}
