// Ejecutar: npx tsx --test src/lib/agentes/nucleo.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluar, bloqueReglas, sanearConfig, resumenCambio, recortarHistorial, CONFIG_POR_DEFECTO, MAX_REGLAS } from './nucleo';

test('evaluar: pausado y acción bloqueada', () => {
  assert.equal(evaluar('Booking Agent', CONFIG_POR_DEFECTO, 'crear').ok, true);
  const p = evaluar('Booking Agent', { ...CONFIG_POR_DEFECTO, activo: false }, 'crear');
  assert.equal(p.ok, false);
  assert.match(p.motivo, /pausado/);
  const b = evaluar('Booking Agent', { ...CONFIG_POR_DEFECTO, accionesBloqueadas: ['cancelar'] }, 'cancelar');
  assert.equal(b.ok, false);
  assert.match(b.motivo, /desactivada/);
  assert.equal(evaluar('Booking Agent', { ...CONFIG_POR_DEFECTO, accionesBloqueadas: ['cancelar'] }, 'crear').ok, true);
});

test('reglas adicionales: vacías no agregan nada y llevan la salvaguarda', () => {
  assert.equal(bloqueReglas(CONFIG_POR_DEFECTO), '');
  const t = bloqueReglas({ ...CONFIG_POR_DEFECTO, reglas: 'No agendar los viernes por la tarde' });
  assert.match(t, /No agendar los viernes/);
  assert.match(t, /nunca contradicen/);
});

test('sanear: solo acciones válidas, texto acotado y tipos estrictos', () => {
  const c = sanearConfig({ activo: true, accionesBloqueadas: ['cancelar', 'hackear', 5, 'cancelar'], reglas: 'x'.repeat(5000) + '\u0000' }, ['crear', 'cancelar']);
  assert.ok(c);
  assert.deepEqual(c!.accionesBloqueadas, ['cancelar']);
  assert.equal(c!.reglas.length, MAX_REGLAS);
  assert.equal(sanearConfig({ activo: 'si' }, []), null);
  assert.equal(sanearConfig(null, []), null);
});

test('memoria: descarta lo viejo, limita turnos y empieza por la persona', () => {
  const ahora = new Date('2026-11-12T15:00:00Z');
  const m = (rol: 'user' | 'assistant', min: number, contenido: string) => ({ rol, contenido, createdAt: new Date(ahora.getTime() - min * 60_000) });
  const h = recortarHistorial([m('user', 40, 'viejo'), m('assistant', 39, 'viejo2'), m('assistant', 9, 'huérfana'), m('user', 8, 'agenda con Nexora'), m('assistant', 7, '{"aclaracion":"¿cuándo?"}')], ahora);
  assert.deepEqual(h.map(x => x.content), ['agenda con Nexora', '{"aclaracion":"¿cuándo?"}']);
  const muchos = Array.from({ length: 20 }, (_, i) => m(i % 2 === 0 ? 'user' : 'assistant', 14 - i * 0.5, `m${i}`));
  const r = recortarHistorial(muchos, ahora);
  assert.ok(r.length <= 12);
  assert.equal(r[0].role, 'user');
  assert.deepEqual(recortarHistorial([], ahora), []);
  assert.equal(recortarHistorial([m('user', 1, 'x'.repeat(5000))], ahora)[0].content.length, 1500);
});

test('resumen de cambios', () => {
  const a = CONFIG_POR_DEFECTO;
  assert.match(resumenCambio(a, { ...a, activo: false }), /pausó/);
  assert.match(resumenCambio(a, { ...a, accionesBloqueadas: ['cancelar'] }), /bloqueó: cancelar/);
  assert.match(resumenCambio({ ...a, accionesBloqueadas: ['cancelar'] }, a), /permitió: cancelar/);
  assert.equal(resumenCambio(a, a), 'sin cambios');
});
