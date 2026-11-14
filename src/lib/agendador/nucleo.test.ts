// Ejecutar: npx tsx --test src/lib/agendador/nucleo.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsearPropuesta, aplicarPlantilla, pideCrearConFecha, cambiosEditar, limitesSemana, finDe, dateALocal, inicioADate, choques, intencionAgenda, propuestaATexto, agendaATexto } from './nucleo';

test('parsear: crear válida y saneada', () => {
  const p = parsearPropuesta('```json\n{"accion":"crear","titulo":"Reunión Nexora","inicio":"2026-11-14T15:00","duracionMin":45,"enlace":"javascript:x","asistentes":"Ana"}\n```');
  assert.ok(p);
  assert.equal(p!.inicio, '2026-11-14T15:00');
  assert.equal(p!.duracionMin, 45);
  assert.equal(p!.enlace, '');
});
test('parsear: inicio inválido, acción desconocida y duración por defecto', () => {
  assert.equal(parsearPropuesta('{"accion":"crear","titulo":"x","inicio":"mañana"}')!.inicio, '');
  assert.equal(parsearPropuesta('{"accion":"crear","titulo":"x","inicio":"2026-13-45T99:99"}')!.inicio, '');
  assert.equal(parsearPropuesta('{"accion":"borrar"}'), null);
  assert.equal(parsearPropuesta('{"accion":"crear","duracionMin":5}')!.duracionMin, 60);
});
test('hora de Colombia: ida y vuelta y fin', () => {
  assert.equal(inicioADate('2026-11-14T15:00').toISOString(), '2026-11-14T20:00:00.000Z');
  assert.equal(dateALocal(new Date('2026-11-14T20:00:00Z')), '2026-11-14T15:00');
  assert.equal(finDe('2026-11-14T23:30', 60), '2026-11-15T00:30');
});
test('choques: detecta cruce y ignora canceladas y la misma', () => {
  const r = (id: string, i: string, status = 'SCHEDULED') => ({ id, title: id, date: inicioADate(i), endDate: null, status });
  const reun = [r('a', '2026-11-14T15:30'), r('b', '2026-11-14T16:00'), r('c', '2026-11-14T15:30', 'CANCELLED')];
  const c = choques(inicioADate('2026-11-14T15:00'), inicioADate('2026-11-14T16:00'), reun);
  assert.deepEqual(c.map(x => x.id), ['a']);
  assert.deepEqual(choques(inicioADate('2026-11-14T15:00'), inicioADate('2026-11-14T16:00'), reun, 'a'), []);
});
test('intención de agenda', () => {
  for (const t of ['Agenda una reunión con Nexora el jueves a las 3', 'Por favor cancela la reunión de mañana', 'Mueve la reunión con VAIGEN al viernes', '¿Qué reuniones tengo esta semana?', 'qué tengo hoy', '/agenda', 'Oye, programa una llamada con Daniel', 'Reprograma la demo']) assert.equal(intencionAgenda(t), true, t);
  for (const t of ['¿Qué se decidió con Nexora?', 'Hoy hablamos con Daniel y quedamos en enviar la propuesta', 'Hola', '¿Qué dice el briefing de La Promotora?']) assert.equal(intencionAgenda(t), false, t);
});
test('semana de lunes a domingo', () => {
  // jueves 12 de noviembre de 2026
  assert.deepEqual(limitesSemana('2026-11-12'), { lunes: '2026-11-09', domingo: '2026-11-15', proxLunes: '2026-11-16', proxDomingo: '2026-11-22' });
  // lunes y domingo pertenecen a su propia semana
  assert.equal(limitesSemana('2026-11-09').lunes, '2026-11-09');
  assert.equal(limitesSemana('2026-11-15').lunes, '2026-11-09');
  assert.equal(limitesSemana('2026-11-15').domingo, '2026-11-15');
  // cruce de mes y de año
  assert.deepEqual(limitesSemana('2026-12-31'), { lunes: '2026-12-28', domingo: '2027-01-03', proxLunes: '2027-01-04', proxDomingo: '2027-01-10' });
});

test('textos: propuesta y agenda', () => {
  const p = parsearPropuesta('{"accion":"crear","titulo":"Demo","inicio":"2026-11-14T15:00","duracionMin":60}')!;
  assert.match(propuestaATexto(p, null, []), /Asistentes: Por confirmar/);
  assert.match(agendaATexto('Agenda', []), /No hay reuniones/);
});

test('editar: solo cambia lo pedido y lo muestra', () => {
  const r = { id: 'x', title: 'Sesión Promotora', date: inicioADate('2026-11-13T10:00'), endDate: inicioADate('2026-11-13T11:00'), status: 'SCHEDULED', attendees: null, location: null, link: null, type: 'OTHER', description: null };
  const p = parsearPropuesta('{"accion":"editar","reunionId":"x","tipo":"commercial","lugar":"Presencial","asistentes":"Santiago Ortega, Daniel Martínez","duracionMin":""}')!;
  assert.equal(p.tipo, 'COMMERCIAL');
  assert.equal(p.duracionDada, false);
  const c = cambiosEditar(p, r);
  assert.deepEqual(c.map(x => x.clave).sort(), ['attendees', 'location', 'type']);
  assert.match(propuestaATexto(p, r, []), /Tipo: Otra → Comercial/);
  assert.deepEqual(cambiosEditar(parsearPropuesta('{"accion":"editar","reunionId":"x","lugar":""}')!, r), []);
  assert.equal(parsearPropuesta('{"accion":"editar","reunionId":"x","tipo":"inventado","estado":"x"}')!.tipo, '');
});

test('consultar: futuras se lee del JSON', () => {
  assert.equal(parsearPropuesta('{"accion":"consultar","futuras":true}')!.futuras, true);
  assert.equal(parsearPropuesta('{"accion":"consultar"}')!.futuras, false);
});

test('pideCrearConFecha: agendar algo nuevo con fecha vs. editar', () => {
  for (const t of ['Agenda el daily de architechia pasado mañana a las 9 am', 'agéndame una reunión con Nexora el jueves', 'Hola, programa la demo para mañana', 'Registra la reunión que tuve ayer a las 3 pm']) assert.equal(pideCrearConFecha(t), true, t);
  for (const t of ['Pon como descripción: revisar la propuesta', 'La reunión Daily del jueves es de tipo interna', 'Cambia el título a Piloto', 'qué reuniones hay esta semana', 'Agenda una reunión con Nexora']) assert.equal(pideCrearConFecha(t), false, t);
});

test('plantilla daily-architechia: título canónico, lo dicho se respeta, otros clientes no', () => {
  const base = '{"accion":"crear","inicio":"2026-11-15T09:00","plantilla":"daily-architechia"';
  const a = aplicarPlantilla(parsearPropuesta(`${base},"titulo":"Daily ArchitechIA"}`)!);
  assert.equal(a.titulo, 'Daily Intern - ArchitechIA');
  assert.equal(a.tipo, 'INTERNAL_DAILY'); assert.equal(a.lugar, 'Virtual'); assert.match(a.enlace, /meet\.google\.com/); assert.match(a.asistentes, /Freddy Orozco/);
  assert.equal(aplicarPlantilla(parsearPropuesta(`${base},"titulo":"Daily ArchitechIA - Sprint 5"}`)!).titulo, 'Daily ArchitechIA - Sprint 5');
  assert.equal(aplicarPlantilla(parsearPropuesta(`${base},"asistentes":"Ana"}`)!).asistentes, 'Ana');
  assert.equal(aplicarPlantilla(parsearPropuesta('{"accion":"crear","inicio":"2026-11-15T09:00","plantilla":"daily","titulo":"Daily Nexora"}')!).tipo, '');
  assert.equal(aplicarPlantilla(parsearPropuesta('{"accion":"editar","reunionId":"x","plantilla":"daily-architechia"}')!).titulo, '');
});
