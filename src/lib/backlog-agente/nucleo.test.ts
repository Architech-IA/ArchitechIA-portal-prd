// Ejecutar: npx tsx --test src/lib/backlog-agente/nucleo.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsearPropuesta, accionPermiso, resolverPersona, resolverReferencia, tareasATexto, cambiosTarea, propuestaATexto, hayCambiosEpica, type TareaLite, type Persona } from './nucleo';

const personas: Persona[] = [
  { id: 'u1', name: 'Freddy Orozco', tipo: 'HUMANO' }, { id: 'u2', name: 'Daniel Martinez', tipo: 'HUMANO' },
  { id: 'a1', name: 'Atlas', tipo: 'AGENTE' }, { id: 'a2', name: 'Orión', tipo: 'AGENTE' }, { id: null, name: 'Claude', tipo: 'AGENTE' },
];
const tarea = (o: Partial<TareaLite> = {}): TareaLite => ({ id: 't1', taskCode: 'MASD-0001-0001-001', title: 'Crear login', type: 'DESARROLLO', priority: 'HIGH', status: 'BACKLOG', points: 3, assigneeName: null, ejecutor: null, sprintCodigo: null, description: null, ...o });

test('parsear: crear tarea válida y saneada', () => {
  const p = parsearPropuesta('```json\n{"accion":"crear","entidad":"tarea","campos":{"titulo":"Crear login","tipo":"desarrollo","prioridad":"alta","puntos":"5","responsable":"Atlas"}}\n```');
  assert.ok(p);
  assert.equal(p!.campos.tipo, 'DESARROLLO');
  assert.equal(p!.campos.prioridad, 'HIGH');        // «alta» se acepta como sinónimo de HIGH
  assert.equal(p!.campos.puntos, 5);
  assert.equal(parsearPropuesta('{"accion":"crear","entidad":"tarea","campos":{"prioridad":"HIGH","tipo":"inventado","puntos":500}}')!.campos.puntos, null);
  assert.equal(parsearPropuesta('{"accion":"crear","entidad":"tarea","campos":{"prioridad":"high"}}')!.campos.prioridad, 'HIGH');
  assert.equal(parsearPropuesta('{"accion":"borrar","entidad":"tarea"}'), null);
  assert.equal(parsearPropuesta('{"accion":"crear","entidad":"proyecto"}'), null);
  assert.equal(parsearPropuesta('{"accion":"crear","entidad":"épica","campos":{"titulo":"Portal","fechaInicio":"mañana"}}')!.campos.fechaInicio, '');
});

test('filtro de consulta: valores por defecto y límites', () => {
  const p = parsearPropuesta('{"accion":"consultar","entidad":"tarea","filtro":{"ejecutor":"agente","sinResponsable":"true","limite":500,"estado":"blocked"}}')!;
  assert.equal(p.filtro.ejecutor, 'AGENTE'); assert.equal(p.filtro.sinResponsable, true); assert.equal(p.filtro.limite, 15); assert.equal(p.filtro.estado, 'BLOCKED');
});

test('permisos por acción', () => {
  assert.equal(accionPermiso({ accion: 'consultar', entidad: 'sprint' }), 'consultar');
  assert.equal(accionPermiso({ accion: 'crear', entidad: 'tarea' }), 'crear_tarea');
  assert.equal(accionPermiso({ accion: 'editar', entidad: 'epica' }), 'editar_epica');
  assert.equal(accionPermiso({ accion: 'crear', entidad: 'sprint' }), 'sprint_no_disponible');
});

test('responsable: humano o agente, exacto, parcial y ambiguo', () => {
  assert.equal(resolverPersona('atlas', personas).persona?.tipo, 'AGENTE');
  assert.equal(resolverPersona('Freddy', personas).persona?.name, 'Freddy Orozco');
  assert.equal(resolverPersona('orion', personas).persona?.name, 'Orión');
  assert.equal(resolverPersona('Zeta', personas).candidatos.length, 0);
  assert.equal(resolverPersona('', personas).persona, undefined);
});

test('referencia: código exacto, título único y ambiguo', () => {
  const items = [
    { id: '1', titulo: 'Crear login de usuarios', codigo: 'MASD-0001-001' }, { id: '2', titulo: 'Crear logout', codigo: 'MASD-0001-002' }, { id: '3', titulo: 'Reporte mensual', codigo: null },
  ];
  assert.equal(resolverReferencia(items, 'masd-0001-002').elegido?.id, '2');
  assert.equal(resolverReferencia(items, 'reporte').elegido?.id, '3');
  const amb = resolverReferencia(items, 'crear');
  assert.equal(amb.elegido, undefined); assert.equal(amb.candidatos.length, 2);
  assert.equal(resolverReferencia(items, 'inexistente').candidatos.length, 0);
});

test('textos: lista de tareas, cambios y propuesta', () => {
  assert.match(tareasATexto('Tareas', [], 0), /No hay tareas/);
  assert.match(tareasATexto('Tareas', [tarea({ assigneeName: 'Atlas', ejecutor: 'AGENTE' })], 40), /Atlas \(agente\).*|Muestro 1 de 40/s);
  const p = parsearPropuesta('{"accion":"editar","entidad":"tarea","campos":{"prioridad":"CRITICAL","puntos":8}}')!;
  p.resuelto = { asignadoNombre: 'Daniel Martinez', ejecutor: 'HUMANO' };
  const c = cambiosTarea(p, tarea());
  assert.deepEqual(c.map(x => x.campo), ['Prioridad', 'Puntos', 'Responsable']);
  assert.match(propuestaATexto(p, tarea(), null), /Prioridad: Alta → Crítica/);
  const nueva = parsearPropuesta('{"accion":"crear","entidad":"tarea","campos":{"titulo":"X"}}')!;
  assert.match(propuestaATexto(nueva, null, null), /Tipo: Tarea \(por defecto\)/);
  assert.equal(hayCambiosEpica(parsearPropuesta('{"accion":"editar","entidad":"epica"}')!), false);
});
