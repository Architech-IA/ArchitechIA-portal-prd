'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_SEG = 120;

/** Micrófono: graba, transcribe en el servidor (Whisper propio) y entrega el texto para que la persona lo revise. */
export default function Microfono({ onTexto, onError, claro }: { onTexto: (t: string) => void; onError: (m: string) => void; claro?: boolean }) {
  const [estado, setEstado] = useState<'libre' | 'grabando' | 'transcribiendo'>('libre');
  const [seg, setSeg] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);
  const flujo = useRef<MediaStream | null>(null);

  const soltar = () => { if (reloj.current) clearInterval(reloj.current); reloj.current = null; flujo.current?.getTracks().forEach(t => t.stop()); flujo.current = null; };
  useEffect(() => () => { try { rec.current?.stop(); } catch {} soltar(); }, []);

  async function iniciar() {
    onError('');
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) { onError('Este navegador no permite grabar audio.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      flujo.current = stream; trozos.current = [];
      const r = new MediaRecorder(stream);
      rec.current = r;
      r.ondataavailable = e => { if (e.data.size) trozos.current.push(e.data); };
      r.onstop = async () => {
        soltar();
        const blob = new Blob(trozos.current, { type: r.mimeType || 'audio/webm' });
        if (blob.size < 1000) { setEstado('libre'); onError('No se grabó nada; inténtalo de nuevo.'); return; }
        setEstado('transcribiendo');
        try {
          const fd = new FormData();
          fd.append('audio', blob, blob.type.includes('mp4') ? 'audio.mp4' : 'audio.webm');
          const res = await fetch('/api/transcribir-audio', { method: 'POST', body: fd });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(d.error || 'No se pudo transcribir el audio');
          onTexto(d.texto as string);
        } catch (e) { onError(e instanceof Error ? e.message : 'No se pudo transcribir el audio'); } finally { setEstado('libre'); }
      };
      r.start(); setSeg(0); setEstado('grabando');
      reloj.current = setInterval(() => setSeg(x => { if (x + 1 >= MAX_SEG) { try { r.stop(); } catch {} } return x + 1; }), 1000);
    } catch { soltar(); onError('No se pudo usar el micrófono. Revisa el permiso del navegador.'); }
  }
  function detener() { try { rec.current?.stop(); } catch {} }

  const mm = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  if (estado === 'transcribiendo') return <span className={`text-[11px] px-1 flex-shrink-0 ${claro ? 'text-gray-500' : 'text-gray-400'}`}>Transcribiendo…</span>;
  const reposo = claro ? 'border-gray-300 text-gray-600 hover:bg-gray-50' : 'border-white/10 text-gray-300 hover:bg-white/[0.06]';
  const activo = claro ? 'border-red-400 bg-red-50 text-red-600' : 'border-red-500/60 bg-red-600/20 text-red-300';
  return (
    <button type="button" onClick={estado === 'grabando' ? detener : () => { void iniciar(); }}
      title={estado === 'grabando' ? 'Detener y transcribir' : 'Dictar con el micrófono'} aria-label={estado === 'grabando' ? 'Detener grabación' : 'Dictar con el micrófono'}
      className={`inline-flex items-center justify-center gap-1.5 h-9 min-w-9 px-2 rounded-lg border text-xs flex-shrink-0 transition-colors ${estado === 'grabando' ? activo : reposo}`}>
      {estado === 'grabando'
        ? <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />{mm}</>
        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v3m-4 0h8M12 3a3 3 0 00-3 3v5a3 3 0 006 0V6a3 3 0 00-3-3z" /></svg>}
    </button>
  );
}
