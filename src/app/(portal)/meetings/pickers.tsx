'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

// Selectores propios del módulo de reuniones (fecha, hora y lista desplegable).
// Los menús se dibujan en un portal con posición fija: dentro de un panel con
// scroll (como la columna lateral del popup de reunión) se cortarían.

const MESES_DP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_DP = ['Lu','Ma','Mi','Ju','Vi','Sa','Do'];

function useFuera(open: boolean, cerrar: () => void, refs: RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (refs.some(r => r.current?.contains(t))) return;
      cerrar();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

// Menú flotante anclado a un elemento; si no cabe debajo, se abre hacia arriba.
function Menu({ anchor, popRef, ancho, alto, igualAncho, children }: {
  anchor: RefObject<HTMLElement | null>; popRef: RefObject<HTMLDivElement | null>;
  ancho: number; alto: number; igualAncho?: boolean; children: ReactNode;
}) {
  // El menú solo existe mientras está abierto: la posición se calcula una vez al montarlo.
  const [pos] = useState<{ top: number; left: number; width: number } | null>(() => {
    const el = anchor.current;
    if (!el || typeof window === 'undefined') return null;
    const r = el.getBoundingClientRect();
    const w = igualAncho ? r.width : ancho;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    let top = r.bottom + 4;
    if (top + alto > window.innerHeight - 8) top = Math.max(8, r.top - alto - 4);
    return { top, left, width: w };
  });
  if (!pos || typeof document === 'undefined') return null;
  return createPortal(
    <div ref={popRef} style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 80 }}>{children}</div>,
    document.body,
  );
}

export function DatePicker({ value, onChange, compact }: { value: string; onChange: (v: string) => void; required?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useFuera(open, () => setOpen(false), [btn, pop]);
  const today = new Date();
  const sel = value ? new Date(value + 'T12:00:00') : null;
  const [vm, setVm] = useState(sel ? sel.getMonth() : today.getMonth());
  const [vy, setVy] = useState(sel ? sel.getFullYear() : today.getFullYear());
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const firstDayMon = (new Date(vy, vm, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const prevM = () => { if (vm === 0) { setVm(11); setVy(y => y - 1); } else setVm(m => m - 1); };
  const nextM = () => { if (vm === 11) { setVm(0); setVy(y => y + 1); } else setVm(m => m + 1); };
  const pick = (d: number) => { onChange(`${vy}-${String(vm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`); setOpen(false); };
  const display = sel ? sel.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  return (
    <div className="relative">
      <button ref={btn} type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 rounded-xl text-left transition-all ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'}`}
        style={{ background: 'rgba(255,255,255,0.06)', border: open ? '1px solid rgba(251,146,60,0.5)' : '1px solid rgba(255,255,255,0.1)', boxShadow: open ? '0 0 0 3px rgba(251,146,60,0.08)' : 'none' }}>
        {!compact && <svg className="w-4 h-4 flex-shrink-0 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        <span className={display ? 'text-white' : 'text-[#7f8a9c]'}>{display || 'Seleccionar fecha...'}</span>
      </button>
      {open && (
        <Menu anchor={btn} popRef={pop} ancho={280} alto={340}>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(10,10,26,0.98)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <button type="button" onClick={prevM} aria-label="Mes anterior" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <span className="text-sm font-semibold text-white">{MESES_DP[vm]} {vy}</span>
              <button type="button" onClick={nextM} aria-label="Mes siguiente" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-7 px-3 pt-3 pb-1">
              {DIAS_DP.map(d => <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'rgba(255,255,255,0.25)' }}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
              {Array.from({ length: firstDayMon }, (_, i) => <div key={'e' + i} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const ds = `${vy}-${String(vm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const isSel = ds === value;
                const isTod = ds === todayStr;
                return (
                  <button key={d} type="button" onClick={() => pick(d)} className="w-full aspect-square flex items-center justify-center text-sm rounded-lg font-medium transition-all hover:bg-white/10"
                    style={{ background: isSel ? '#f97316' : isTod ? 'rgba(251,146,60,0.12)' : 'transparent', color: isSel ? '#fff' : isTod ? '#fb923c' : 'rgba(255,255,255,0.8)', border: isTod && !isSel ? '1px solid rgba(251,146,60,0.3)' : '1px solid transparent' }}>{d}</button>
                );
              })}
            </div>
            <div className="px-4 py-2.5 border-t flex justify-between items-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="text-xs text-[#7f8a9c] hover:text-red-400 transition-colors">Borrar</button>
              <button type="button" onClick={() => { onChange(todayStr); setVm(today.getMonth()); setVy(today.getFullYear()); setOpen(false); }} className="text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors">Hoy</button>
            </div>
          </div>
        </Menu>
      )}
    </div>
  );
}

function MiniLista({ value, options, onChange, compact }: { value: string; options: string[]; onChange: (v: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useFuera(open, () => setOpen(false), [btn, pop]);
  return (
    <div className="relative">
      <button ref={btn} type="button" onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between gap-1 rounded-xl font-mono font-semibold transition-all ${compact ? 'w-12 px-2 py-1.5 text-xs' : 'w-14 px-2.5 py-2.5 text-sm'}`}
        style={{ background: 'rgba(255,255,255,0.06)', border: open ? '1px solid rgba(251,146,60,0.5)' : '1px solid rgba(255,255,255,0.1)', color: '#fff', boxShadow: open ? '0 0 0 3px rgba(251,146,60,0.08)' : 'none' }}>
        {value}
        <svg className="w-3 h-3 text-[#7f8a9c] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && (
        <Menu anchor={btn} popRef={pop} ancho={72} alto={200}>
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(10,10,26,0.98)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 40px rgba(0,0,0,0.7)', maxHeight: '200px', overflowY: 'auto' }}>
            {options.map(opt => (
              <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false); }}
                className="w-full px-3 py-2 text-sm font-mono text-left transition-colors hover:bg-white/[0.07]"
                style={{ background: opt === value ? 'rgba(249,115,22,0.2)' : undefined, color: opt === value ? '#f97316' : 'rgba(255,255,255,0.8)', fontWeight: opt === value ? 700 : 400 }}>
                {opt}
              </button>
            ))}
          </div>
        </Menu>
      )}
    </div>
  );
}

export function TimePicker({ hour, minute, onHourChange, onMinuteChange, showLabel = true, compact }: {
  hour: string; minute: string; onHourChange: (h: string) => void; onMinuteChange: (m: string) => void; showLabel?: boolean; compact?: boolean;
}) {
  const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const MINS = ['00', '15', '30', '45'];
  return (
    <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1.5'}`}>
      <MiniLista value={hour} options={HOURS} onChange={onHourChange} compact={compact} />
      <span className="text-[#7f8a9c] font-bold text-base select-none">:</span>
      <MiniLista value={minute} options={MINS} onChange={onMinuteChange} compact={compact} />
      {showLabel && <span className="text-xs text-[#7f8a9c] ml-1">hrs</span>}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder, compact }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useFuera(open, () => setOpen(false), [btn, pop]);
  const label = options.find(o => o.value === value)?.label || placeholder || '';
  return (
    <div className="relative">
      <button ref={btn} type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl text-left transition-all ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'}`}
        style={{ background: 'rgba(255,255,255,0.06)', border: open ? '1px solid rgba(251,146,60,0.5)' : '1px solid rgba(255,255,255,0.1)', color: value ? '#fff' : 'rgba(156,163,175,1)', boxShadow: open ? '0 0 0 3px rgba(251,146,60,0.08)' : 'none' }}>
        <span className="truncate">{label}</span>
        <svg className="w-4 h-4 flex-shrink-0 text-[#7f8a9c] transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && (
        <Menu anchor={btn} popRef={pop} ancho={200} alto={Math.min(options.length * 40 + 8, 280)} igualAncho>
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(10,10,26,0.98)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 40px rgba(0,0,0,0.7)' }}>
            {options.map(opt => (
              <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full px-3 text-left transition-colors flex items-center justify-between hover:bg-white/[0.07] ${compact ? 'py-2 text-xs' : 'py-2.5 text-sm'}`}
                style={{ background: opt.value === value ? 'rgba(249,115,22,0.12)' : undefined, color: opt.value === value ? '#f97316' : 'rgba(255,255,255,0.85)', fontWeight: opt.value === value ? 600 : 400 }}>
                {opt.label}
                {opt.value === value && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
              </button>
            ))}
          </div>
        </Menu>
      )}
    </div>
  );
}
