// Ejecutar: npx tsx --test src/lib/presales/nucleo.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsearContenido, parsearRevision, limpiarHtml, parsearRuta, contenidoATexto, comentariosATexto } from './nucleo';

test('contenido técnico: sanea y exige secciones con puntos', () => {
  const c = parsearContenido('```json\n{"titulo":"Diagnóstico","secciones":[{"titulo":"Alcance","puntos":["API","  "]},{"titulo":"Vacía","puntos":[]},{"titulo":"","puntos":["x"]}],"porConfirmar":["Presupuesto"],"fuentes":["Briefing v13"]}\n```');
  assert.ok(c);
  assert.equal(c!.secciones.length, 1);
  assert.deepEqual(c!.secciones[0].puntos, ['API']);
  assert.equal(parsearContenido('{"secciones":[]}'), null);
  assert.equal(parsearContenido('nada'), null);
  assert.match(contenidoATexto(c!), /## Por confirmar\n- Presupuesto/);
});

test('revisión: aprobar solo sin comentarios; ante duda, ajustar', () => {
  assert.equal(parsearRevision('{"veredicto":"aprobar","comentarios":[]}').veredicto, 'aprobar');
  const r = parsearRevision('{"veredicto":"aprobar","comentarios":[{"seccion":"Alcance","comentario":"Falta el ERP"}]}');
  assert.equal(r.veredicto, 'ajustar');
  assert.equal(r.comentarios.length, 1);
  assert.equal(parsearRevision('no es json').veredicto, 'ajustar');
  assert.match(comentariosATexto(r.comentarios), /1\. \[Alcance\] Falta el ERP/);
});

test('html: quita scripts, atributos on* y javascript:', () => {
  const h = limpiarHtml('```html\n<h1>Doc</h1><p onclick="x()">Texto largo de ejemplo para el documento</p><script>alert(1)</script><a href="javascript:alert(1)">l</a>\n```');
  assert.ok(h);
  assert.ok(!/script|onclick|javascript:/i.test(h!));
  assert.match(h!, /<h1>Doc<\/h1>/);
  assert.equal(limpiarHtml('solo texto sin etiquetas, nada de html aquí para el editor del portal'), null);
});

test('ruta del orquestador: agente desconocido es ninguno', () => {
  assert.equal(parsearRuta('{"agente":"presales","solucionId":"s1","entregableClave":"briefing_contacto"}')!.agente, 'presales');
  assert.equal(parsearRuta('{"agente":"hacker"}')!.agente, 'ninguno');
  assert.equal(parsearRuta('xx'), null);
});

import { esPropuestaComercial } from './nucleo';
test('esPropuestaComercial: fase, entregable o pedido', () => {
  assert.equal(esPropuestaComercial('propuesta', 'doc_x', 'mejora'), true);
  assert.equal(esPropuestaComercial('contacto', 'briefing_contacto', 'Arma la propuesta comercial'), true);
  assert.equal(esPropuestaComercial('contacto', 'briefing_contacto', 'Mejora el briefing'), false);
  assert.equal(esPropuestaComercial('negociacion', 'cotizacion_final', 'ajusta'), true);
});
