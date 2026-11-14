'use client';

import { useState } from 'react';
import { DatePicker, TimePicker, Select } from './pickers';

// Información clave de una reunión, editable: tipo, fecha y hora, duración,
// ubicación, enlace, asistentes y estado. La usa el popup grande (MeetingHub)
// tanto al crear una reunión como al abrir una existente.

export interface DatosReunion {
  title: string; description: string; type: string;
  date: string; endDate: string; // 'AAAA-MM-DDTHH:mm'
  location: string; link: string; attendees: string; status: string;
}

export const DATOS_VACIOS: DatosReunion = {
  title: '', description: '', type: 'INTERNAL_DAILY', date: '', endDate: '',
  location: '', link: '', attendees: '', status: 'SCHEDULED',
};

export const TIPOS = [
  { value: 'INTERNAL_DAILY', label: 'Reunión Interna - Daily' },
  { value: 'INTERNAL_WORKSHOP', label: 'Reunión Interna - Workshop' },
  { value: 'COMMERCIAL', label: 'Comercial' },
  { value: 'ADVISORY', label: 'Asesoría' },
  { value: 'PROVIDER', label: 'Proveedores' },
];

import { DAILY_LINK, EQUIPO } from '@/lib/agendador/plantillas';
export { DAILY_LINK, EQUIPO };

export const listaAsistentes = (s: string) => (s ? s.split(',').map(a => a.trim()).filter(Boolean) : []);

type Usuario = { id: string; name: string; email: string; role: string };
type Cliente = { id: string; nombre: string; contacto: string; email: string };

const Campo = ({ label, children, extra }: { label: string; children: React.ReactNode; extra?: React.ReactNode }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="text-[11px] text-[#7f8a9c]">{label}</label>
      {extra}
    </div>
    {children}
  </div>
);

const inputCls = 'w-full px-2.5 py-1.5 text-xs text-white rounded-xl focus:ring-2 focus:ring-orange-500/60 focus:outline-none placeholder-gray-500';
const inputSty = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' };

export default function DatosClave({ datos, onChange, users, clientes }: {
  datos: DatosReunion;
  onChange: (patch: Partial<DatosReunion>) => void;
  users: Usuario[];
  clientes: Cliente[];
}) {
  const [entrada, setEntrada] = useState('');
  const asist = listaAsistentes(datos.attendees);
  const setAsist = (arr: string[]) => onChange({ attendees: arr.join(', ') });

  const hora = datos.date ? datos.date.slice(11, 13) : '09';
  const min = datos.date ? datos.date.slice(14, 16) : '00';
  const diaHoy = new Date().toISOString().slice(0, 10);
  // Hora de fin: si no hay, se propone una hora después del inicio.
  const hFin = datos.endDate ? datos.endDate.slice(11, 13) : String((parseInt(hora) + 1) % 24).padStart(2, '0');
  const mFin = datos.endDate ? datos.endDate.slice(14, 16) : min;
  const diaFin = datos.endDate ? datos.endDate.slice(0, 10) : (datos.date ? datos.date.slice(0, 10) : diaHoy);
  const ponerFin = (h: string, m: string) => onChange({ endDate: `${diaFin}T${h}:${m}` });

  const q = entrada.trim().toLowerCase();
  const sugerencias = q
    ? users.filter(u => u.role !== 'ADMIN' && !asist.includes(u.email) && !asist.includes(u.name) && (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))).slice(0, 5)
    : [];
  const esDaily = datos.type === 'INTERNAL_DAILY';

  return (
    <div className="space-y-3">
      <Campo label="Tipo">
        <Select compact value={datos.type} options={TIPOS}
          onChange={t => onChange({ type: t, link: t === 'INTERNAL_DAILY' ? DAILY_LINK : (datos.type === 'INTERNAL_DAILY' ? '' : datos.link) })} />
      </Campo>

      <div className="flex gap-2 items-end">
        <div className="w-[6.5rem] flex-shrink-0">
          <label className="block text-[11px] text-[#7f8a9c] mb-1">Fecha</label>
          <DatePicker compact value={datos.date ? datos.date.slice(0, 10) : ''}
            onChange={v => onChange({ date: v ? `${v}T${datos.date ? datos.date.slice(11, 16) : '09:00'}` : '', ...(v && datos.endDate ? { endDate: `${v}T${datos.endDate.slice(11, 16)}` } : {}) })} />
        </div>
        <div className="flex-shrink-0">
          <label className="block text-[11px] text-[#7f8a9c] mb-1">Hora</label>
          <TimePicker compact showLabel={false} hour={hora} minute={min}
            onHourChange={h => onChange({ date: `${datos.date ? datos.date.slice(0, 10) : diaHoy}T${h}:${min}` })}
            onMinuteChange={m => onChange({ date: `${datos.date ? datos.date.slice(0, 10) : diaHoy}T${hora}:${m}` })} />
        </div>
        <div className="flex-shrink-0">
          <label className="block text-[11px] text-[#7f8a9c] mb-1">Hora fin</label>
          <TimePicker compact showLabel={false} hour={hFin} minute={mFin}
            onHourChange={h => ponerFin(h, mFin)} onMinuteChange={m => ponerFin(hFin, m)} />
        </div>
      </div>

      <Campo label="Asistentes" extra={
        <div className="flex items-center gap-1">
          {datos.type === 'COMMERCIAL' && clientes.length > 0 && (
            <select value="" onChange={e => {
              const c = clientes.find(x => x.id === e.target.value);
              if (!c) return;
              const etiqueta = c.contacto ? `${c.nombre} — ${c.contacto}` : c.nombre;
              if (!asist.includes(etiqueta)) setAsist([...asist, etiqueta]);
            }} className="text-[11px] bg-blue-600/15 border border-blue-500/30 text-blue-400 rounded-lg px-1.5 py-0.5 cursor-pointer max-w-[90px]">
              <option value="" disabled>Cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id} style={{ background: '#0f172a', color: '#e2e8f0' }}>{c.nombre}</option>)}
            </select>
          )}
          <button type="button" onClick={() => { const nuevos = EQUIPO.filter(n => !asist.includes(n)); if (nuevos.length) setAsist([...asist, ...nuevos]); }}
            className="text-[11px] bg-orange-600/15 border border-orange-500/30 text-orange-400 rounded-lg px-1.5 py-0.5 hover:bg-orange-600/25 transition-colors">Equipo ArchitechIA</button>
        </div>
      }>
        <div className="relative">
          <input type="text" value={entrada} onChange={e => setEntrada(e.target.value)} placeholder="Nombre o email y Enter"
            onKeyDown={e => {
              if (e.key === 'Enter' && entrada.trim()) {
                e.preventDefault();
                const n = entrada.trim();
                if (!asist.includes(n)) setAsist([...asist, n]);
                setEntrada('');
              }
              if (e.key === 'Backspace' && !entrada && asist.length) setAsist(asist.slice(0, -1));
            }} className={inputCls} style={inputSty} />
          {sugerencias.length > 0 && (
            <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden" style={{ background: 'rgba(10,10,28,0.98)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 30px rgba(0,0,0,0.6)' }}>
              {sugerencias.map(u => (
                <button key={u.id} type="button" onClick={() => { setAsist([...asist, u.email]); setEntrada(''); }}
                  className="w-full px-2.5 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 transition-colors">
                  <span className="w-6 h-6 rounded-full bg-orange-900/30 text-orange-400 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                    {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-white truncate">{u.name}</span>
                    <span className="block text-[11px] text-[#7f8a9c] truncate">{u.email}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {asist.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {asist.map((a, i) => (
              <span key={`${a}-${i}`} title={EQUIPO.includes(a) ? a : undefined} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-600/20 border border-orange-500/30 rounded-full text-[11px] text-orange-300">
                {EQUIPO.includes(a) ? a.split(' ').map(n => n[0]).join('').toUpperCase() : (users.find(u => u.email === a)?.name ?? a)}
                <button type="button" aria-label={`Quitar ${a}`} onClick={() => setAsist(asist.filter((_, j) => j !== i))} className="text-orange-400 hover:text-white">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </Campo>

      <div className="grid grid-cols-[6rem_minmax(0,1fr)_6.5rem] gap-2">
        <Campo label="Ubicación">
          <Select compact value={datos.location} onChange={v => onChange({ location: v })} placeholder="Seleccionar..."
            options={[
              { value: '', label: 'Seleccionar...' },
              { value: 'Presencial', label: 'Presencial' },
              { value: 'Virtual', label: 'Virtual' },
              { value: 'Otro', label: 'Otro' },
            ]} />
        </Campo>
        <Campo label="Enlace (URL)">
          <input type="url" value={datos.link} onChange={e => onChange({ link: e.target.value })} placeholder="https://meet.google.com/..."
            readOnly={esDaily} className={`${inputCls} ${esDaily ? 'text-gray-400 cursor-not-allowed' : ''}`} style={inputSty} />
        </Campo>
        <Campo label="Estado">
          <Select compact value={datos.status} onChange={v => onChange({ status: v })}
            options={[
        { value: 'SCHEDULED', label: 'Programada' },
        { value: 'COMPLETED', label: 'Completada' },
        { value: 'CANCELLED', label: 'Cancelada' },
            ]} />
        </Campo>
      </div>


    </div>
  );
}
