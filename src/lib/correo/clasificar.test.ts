// Ejecutar: npx tsx --test src/lib/correo/clasificar.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificar, type EntradaCorreo, type ReglaCorreo } from './clasificar';

const base: EntradaCorreo = { sender: 'x@y.com', subject: '', bodyPreview: '', hasAttachments: false, adjuntos: [] };
const regla = (o: Partial<ReglaCorreo>): ReglaCorreo => ({ id: 'r1', tipo: 'REMITENTE', patron: 'x@y.com', categoriaId: 'cat_legal', origen: 'MANUAL', ...o });

test('remitente manual gana sobre las palabras', () => {
  const r = clasificar({ ...base, subject: 'Factura electrónica 123' }, [regla({})]);
  assert.equal(r.categoriaId, 'cat_legal');
  assert.equal(r.origen, 'REMITENTE');
  assert.equal(r.confianza, 'Alta');
});

test('dominio manual', () => {
  const r = clasificar({ ...base, sender: 'ana@notarias.co' }, [regla({ tipo: 'DOMINIO', patron: 'notarias.co' })]);
  assert.equal(r.categoriaId, 'cat_legal');
});

test('factura con XML adjunto es confianza alta', () => {
  const r = clasificar({ ...base, subject: 'Factura electrónica FEX204499', adjuntos: ['fv0900.xml', 'fv0900.pdf'], hasAttachments: true }, []);
  assert.equal(r.categoriaId, 'cat_factura');
  assert.equal(r.confianza, 'Alta');
});

test('palabras sin acento ni mayúsculas', () => {
  const r = clasificar({ ...base, subject: 'COTIZACIÓN para plataforma' }, []);
  assert.equal(r.categoriaId, 'cat_comercial');
  assert.equal(r.confianza, 'Media');
});

test('palabras de dos categorías: no decide', () => {
  const r = clasificar({ ...base, subject: 'Contrato y cotización' }, []);
  assert.equal(r.categoriaId, null);
  assert.match(r.motivo, /varias categorías/);
});

test('lo aprendido solo aplica si nada más decide', () => {
  const ap = regla({ origen: 'APRENDIDA', categoriaId: 'cat_proyecto' });
  assert.equal(clasificar({ ...base, subject: 'hola' }, [ap]).categoriaId, 'cat_proyecto');
  assert.equal(clasificar({ ...base, subject: 'contrato nuevo' }, [ap]).categoriaId, 'cat_legal');
});

test('aprendizajes contradictorios van a revisión', () => {
  const r = clasificar(base, [regla({ id: 'a', origen: 'APRENDIDA', categoriaId: 'cat_legal' }), regla({ id: 'b', origen: 'APRENDIDA', categoriaId: 'cat_soporte', patron: 'X@Y.com' })]);
  assert.equal(r.categoriaId, null);
});

test('sin reglas ni palabras: sin clasificar', () => {
  const r = clasificar({ ...base, subject: 'Novedades de este mes' }, []);
  assert.equal(r.categoriaId, null);
  assert.equal(r.confianza, 'Baja');
});
