// Ejecutar: npx tsx --test src/lib/documentador/nucleo.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { terminosDe, intencionRapida, trocear, parsearActa, fusionarEnHub, hubATexto, actaATelegram, usuariosPermitidos } from './nucleo';

let n = 0;
const uid = () => `id${++n}`;

test('términos: quita palabras vacías y detecta que piden pendientes', () => {
  const r = terminosDe('¿Qué quedó pendiente con VAIGEN sobre la cotización?');
  assert.deepEqual(r.terminos, ['VAIGEN', 'cotización']);
  assert.equal(r.pidePendientes, true);
});

test('términos: pregunta sin pendientes', () => {
  const r = terminosDe('Resumen de la reunión con Compensar');
  assert.deepEqual(r.terminos, ['Compensar']);
  assert.equal(r.pidePendientes, false);
});

test('términos: los verbos corrientes no cuentan como palabra clave', () => {
  assert.deepEqual(terminosDe('¿Qué se decidió con Zxqwvbnm?').terminos, ['Zxqwvbnm']);
  assert.deepEqual(terminosDe('¿Qué acordamos con Nexora la semana pasada?').terminos, ['Nexora']);
});

test('términos: pregunta por el briefing de un proyecto', () => {
  assert.deepEqual(terminosDe('¿Qué dice el briefing del proyecto La Promotora Seguros?').terminos, ['briefing', 'Promotora', 'Seguros']);
});

test('intención rápida', () => {
  assert.equal(intencionRapida('¿Qué se decidió con Nexora?'), 'consulta');
  assert.equal(intencionRapida('/nota hoy hablamos de precios'), 'nota');
  assert.equal(intencionRapida('¿Cuáles son sus funciones?'), 'otro');
  assert.equal(intencionRapida('¿Qué puedes hacer?'), 'otro');
  assert.equal(intencionRapida('Hola'), 'otro');
  assert.equal(intencionRapida('¿Qué funciones quedaron pendientes con Nexora?'), 'consulta');
  assert.equal(intencionRapida('Hoy hablamos con Daniel y quedamos en enviar la propuesta el viernes'), null);
});

test('trocear respeta el máximo y no pierde texto', () => {
  const t = Array.from({ length: 60 }, (_, i) => `Línea número ${i} con algo de texto`).join('\n');
  const p = trocear(t, 300);
  assert.ok(p.every(x => x.length <= 300));
  assert.equal(p.join('\n').replace(/\s+/g, ' '), t.replace(/\s+/g, ' '));
});

test('parsearActa: sanea y descarta fechas inválidas', () => {
  const a = parsearActa('```json\n{"resumen":"R","hechos":["a"],"decisiones":[],"pendientes":[{"texto":"Enviar propuesta","responsable":"Ana","fechaLimite":"viernes"},{"texto":"","responsable":"x"}],"dudas":["¿monto?"],"reunionSugerida":"abc"}\n```');
  assert.ok(a);
  assert.equal(a!.pendientes.length, 1);
  assert.equal(a!.pendientes[0].fechaLimite, '');
  assert.equal(a!.reunionSugerida, 'abc');
});

test('parsearActa: vacía o inválida devuelve null', () => {
  assert.equal(parsearActa('no es json'), null);
  assert.equal(parsearActa('{"resumen":"","hechos":[],"decisiones":[],"pendientes":[]}'), null);
});

test('telegram marca Por confirmar lo que falta', () => {
  const t = actaATelegram({ resumen: 'R', hechos: [], decisiones: [], pendientes: [{ texto: 'Enviar propuesta', responsable: '', fechaLimite: '' }], dudas: [], reunionSugerida: '' });
  assert.match(t, /quién: Por confirmar \| cuándo: Por confirmar/);
});

test('fusionarEnHub: conserva lo existente, añade pestaña y no duplica decisiones', () => {
  const previo = JSON.stringify({ objetivo: 'O', puntos: [{ id: 'p1', texto: 'Punto' }], notas: JSON.stringify({ tabs: [{ id: 't1', name: 'General', content: '<p>hola</p>' }] }), decisiones: [{ id: 'd1', texto: 'Usar Rust' }] });
  const { hub, decisionesNuevas } = fusionarEnHub(previo, { titulo: 'Nota de voz', markdown: '## Resumen\nTexto', decisiones: ['usar rust', 'Lanzar en marzo'] }, uid);
  const h = JSON.parse(hub);
  assert.equal(h.objetivo, 'O');
  assert.equal(h.puntos.length, 1);
  const tabs = JSON.parse(h.notas).tabs;
  assert.equal(tabs.length, 2);
  assert.equal(tabs[0].content, '<p>hola</p>');
  assert.match(tabs[1].content, /<h2>Resumen<\/h2>/);
  assert.equal(decisionesNuevas, 1);
  assert.deepEqual(h.decisiones.map((d: { texto: string }) => d.texto), ['Usar Rust', 'Lanzar en marzo']);
});

test('fusionarEnHub: hub vacío o con notas en texto plano', () => {
  assert.equal(JSON.parse(JSON.parse(fusionarEnHub(null, { titulo: 'N', markdown: 'x', decisiones: [] }, uid).hub).notas).tabs.length, 1);
  const h = JSON.parse(fusionarEnHub(JSON.stringify({ notas: '<p>viejo</p>' }), { titulo: 'N', markdown: 'x', decisiones: [] }, uid).hub);
  assert.equal(JSON.parse(h.notas).tabs.length, 2);
});

test('hubATexto lee las pestañas', () => {
  const raw = JSON.stringify({ puntos: [{ texto: 'A' }], notas: JSON.stringify({ tabs: [{ name: 'Resumen', content: '<p>Se habló de X</p>' }] }), decisiones: [{ texto: 'D' }] });
  const r = hubATexto(raw);
  assert.deepEqual(r.puntos, ['A']);
  assert.match(r.notas, /\[Resumen\]\nSe habló de X/);
  assert.deepEqual(r.decisiones, ['D']);
});

test('usuarios permitidos', () => {
  assert.deepEqual([...usuariosPermitidos(' 1, 2 ,,3')], ['1', '2', '3']);
  assert.equal(usuariosPermitidos(undefined).size, 0);
});
