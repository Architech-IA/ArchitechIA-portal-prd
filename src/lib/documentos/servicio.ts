// Repositorio de documentos: copias congeladas de lo enviado, firmado o archivado (propuestas, presentaciones, contratos, actas...).
// Tablas Documento y DocumentoHistorial (SQL 029). Nada se escribe solo: el envío lo registra una persona desde el editor del proyecto
// o sube el archivo ella misma. Lo enviado o firmado es de solo lectura; se corrige con una versión nueva (la anterior pasa a «Reemplazado»).
import { prisma } from '@/lib/prisma';
import { esPropuestaComercial } from '@/lib/presales/nucleo';
import { esTipo, esEstado, esCanal, type DocumentoFila, type DocumentoDetalle, type Opciones } from './tipos';

export const MAX_ARCHIVO = 15 * 1024 * 1024;
export interface Usuario { id: string; nombre: string }
export type Res<T> = { ok: true; dato: T } | { ok: false; error: string };

const COLS = `id, tipo, titulo, estado, version, grupo, "clienteId", "clienteNombre", "solucionId", "proyectoNombre", "archivoNombre", mime, tamano,
  (contenido is not null and length(contenido) > 0) as "tieneContenido", canal, "enviadoEn", "valorFinal"::float8 as "valorFinal", "creadoPorNombre", "createdAt", "updatedAt"`;

export async function listar(): Promise<{ documentos: DocumentoFila[]; opciones: Opciones }> {
  const documentos = await prisma.$queryRawUnsafe<DocumentoFila[]>(`select ${COLS} from "Documento" order by "createdAt" desc limit 1000`);
  const clientes = await prisma.$queryRaw<{ id: string; nombre: string }[]>`select id, nombre from "Cliente" order by nombre limit 500`;
  const proyectos = await prisma.$queryRaw<{ id: string; nombre: string; empresa: string | null }[]>`select id, nombre, empresa from "Solucion" where tipo = 'PROJECT' order by "updatedAt" desc limit 300`;
  return { documentos, opciones: { clientes, proyectos } };
}

export async function obtener(id: string): Promise<DocumentoDetalle | null> {
  const f = (await prisma.$queryRawUnsafe<(DocumentoFila & { contenido: string | null; notas: string | null })[]>(`select ${COLS}, contenido, notas from "Documento" where id = $1`, id))[0];
  if (!f) return null;
  const historial = await prisma.$queryRaw<{ evento: string; usuarioNombre: string | null; createdAt: Date }[]>`select evento, "usuarioNombre", "createdAt" from "DocumentoHistorial" where "documentoId" = ${id} order by "createdAt" desc, id limit 60`;
  return { ...f, historial: historial.map(h => ({ ...h, createdAt: h.createdAt.toISOString() })) };
}

export async function archivo(id: string): Promise<{ nombre: string; mime: string; buf: Buffer } | null> {
  const r = (await prisma.$queryRaw<{ archivo: Buffer | null; archivoNombre: string | null; mime: string | null }[]>`select archivo, "archivoNombre", mime from "Documento" where id = ${id}`)[0];
  if (!r?.archivo) return null;
  return { nombre: r.archivoNombre || 'documento', mime: r.mime || 'application/octet-stream', buf: Buffer.from(r.archivo) };
}

async function clienteDe(solucionId: string | null, clienteId: string | null, clienteNombre: string): Promise<{ id: string | null; nombre: string; proyecto: string | null }> {
  let proyecto: string | null = null, empresa: string | null = null, cid = clienteId, nombre = clienteNombre.trim();
  if (solucionId) {
    const s = (await prisma.$queryRaw<{ nombre: string; empresa: string | null; clienteId: string | null }[]>`select s.nombre, s.empresa, f."clienteId" from "Solucion" s left join "ProyectoFicha" f on f."solucionId" = s.id where s.id = ${solucionId}`)[0];
    if (s) { proyecto = s.nombre; empresa = s.empresa; if (!cid) cid = s.clienteId; }
  }
  if (cid) { const c = (await prisma.$queryRaw<{ nombre: string }[]>`select nombre from "Cliente" where id = ${cid}`)[0]; if (c) nombre = c.nombre; else cid = null; }
  if (!nombre) nombre = empresa || proyecto || 'Sin cliente';
  return { id: cid, nombre, proyecto };
}

type Tx = Pick<typeof prisma, '$queryRaw' | '$executeRaw'>;
async function hist(tx: Tx, documentoId: string, evento: string, usuario: string) {
  await tx.$executeRaw`insert into "DocumentoHistorial" ("documentoId", evento, "usuarioNombre") values (${documentoId}, ${evento}, ${usuario})`;
}

// Una versión nueva del mismo grupo deja las anteriores abiertas como «Reemplazado» (siguen visibles).
async function siguienteVersion(tx: Tx, grupo: string, usuario: string): Promise<number> {
  const prev = await tx.$queryRaw<{ id: string; version: number; estado: string }[]>`select id, version, estado from "Documento" where grupo = ${grupo}`;
  for (const p of prev) {
    if (p.estado === 'Enviado' || p.estado === 'En negociación' || p.estado === 'Borrador') {
      await tx.$executeRaw`update "Documento" set estado = 'Reemplazado', "updatedAt" = now() where id = ${p.id}`;
      await hist(tx, p.id, 'Pasa a Reemplazado: se registró una versión nueva', usuario);
    }
  }
  return prev.reduce((m, p) => Math.max(m, p.version), 0) + 1;
}

function fechaEnvio(f?: string): Date | null {
  if (!f) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return null;
  const d = new Date(`${f}T12:00:00`);
  return isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000 ? null : d;
}

// «Marcar como enviada» desde el editor del proyecto: congela el texto actual del documento.
export async function registrarEnvio(p: { solucionId: string; faseClave: string; entregableClave: string; tipo?: string; canal: string; fecha?: string; usuario: Usuario }): Promise<Res<{ id: string; version: number }>> {
  if (!esCanal(p.canal)) return { ok: false, error: 'Canal no válido.' };
  const fecha = fechaEnvio(p.fecha);
  if (!fecha) return { ok: false, error: 'La fecha de envío no es válida (formato AAAA-MM-DD, no futura).' };
  const d = (await prisma.$queryRaw<{ titulo: string; contenido: string }[]>`select titulo, contenido from "ProyectoDocumento" where "solucionId" = ${p.solucionId} and "faseClave" = ${p.faseClave} and "entregableClave" = ${p.entregableClave}`)[0];
  if (!d) return { ok: false, error: 'No encuentro ese documento en el proyecto.' };
  if (!d.contenido.trim()) return { ok: false, error: 'El documento está vacío: escribe o acepta una propuesta antes de marcarlo como enviado.' };
  const tipo = esTipo(p.tipo) ? p.tipo : esPropuestaComercial(p.faseClave, p.entregableClave, d.titulo) ? 'Propuesta' : 'Otro';
  const c = await clienteDe(p.solucionId, null, '');
  const grupo = `${p.solucionId}:${p.faseClave}:${p.entregableClave}`;
  const r = await prisma.$transaction(async tx => {
    const version = await siguienteVersion(tx, grupo, p.usuario.nombre);
    const ins = await tx.$queryRaw<{ id: string }[]>`insert into "Documento" (tipo, titulo, estado, version, grupo, "clienteId", "clienteNombre", "solucionId", "proyectoNombre", contenido, canal, "enviadoEn", "origenFase", "origenEntregable", "creadoPorId", "creadoPorNombre")
      values (${tipo}, ${d.titulo}, 'Enviado', ${version}, ${grupo}, ${c.id}, ${c.nombre}, ${p.solucionId}, ${c.proyecto}, ${d.contenido}, ${p.canal}, ${fecha}, ${p.faseClave}, ${p.entregableClave}, ${p.usuario.id}, ${p.usuario.nombre}) returning id`;
    await hist(tx, ins[0].id, `Enviada por ${p.canal} (versión ${version})`, p.usuario.nombre);
    return { id: ins[0].id, version };
  });
  return { ok: true, dato: r };
}

// Subir un archivo (presentación, contrato firmado, factura...) o una versión nueva de un documento ya existente (grupo).
export async function subir(p: { titulo: string; tipo: string; estado: string; clienteId?: string | null; clienteNombre?: string; solucionId?: string | null; grupo?: string | null; nombreArchivo: string; mime: string; buf: Buffer; usuario: Usuario }): Promise<Res<{ id: string; version: number }>> {
  if (!p.titulo.trim()) return { ok: false, error: 'Falta el título.' };
  if (!esTipo(p.tipo)) return { ok: false, error: 'Tipo no válido.' };
  if (!esEstado(p.estado)) return { ok: false, error: 'Estado no válido.' };
  if (!p.buf.length) return { ok: false, error: 'El archivo está vacío.' };
  if (p.buf.length > MAX_ARCHIVO) return { ok: false, error: 'El archivo supera 15 MB.' };
  const c = await clienteDe(p.solucionId || null, p.clienteId || null, p.clienteNombre || '');
  const nombreArchivo = p.nombreArchivo.replace(/[\\/\0]/g, '_').slice(0, 200) || 'documento';
  const grupo = p.grupo || `u:${crypto.randomUUID()}`;
  const enviado = p.estado !== 'Borrador' ? new Date() : null;
  const r = await prisma.$transaction(async tx => {
    const version = await siguienteVersion(tx, grupo, p.usuario.nombre);
    const ins = await tx.$queryRaw<{ id: string }[]>`insert into "Documento" (tipo, titulo, estado, version, grupo, "clienteId", "clienteNombre", "solucionId", "proyectoNombre", archivo, "archivoNombre", mime, tamano, "enviadoEn", "creadoPorId", "creadoPorNombre")
      values (${p.tipo}, ${p.titulo.trim().slice(0, 200)}, ${p.estado}, ${version}, ${grupo}, ${c.id}, ${c.nombre}, ${p.solucionId || null}, ${c.proyecto}, ${p.buf}, ${nombreArchivo}, ${p.mime || 'application/octet-stream'}, ${p.buf.length}, ${enviado}, ${p.usuario.id}, ${p.usuario.nombre}) returning id`;
    await hist(tx, ins[0].id, `Subido (${nombreArchivo}, versión ${version})`, p.usuario.nombre);
    return { id: ins[0].id, version };
  });
  return { ok: true, dato: r };
}

export async function cambiarEstado(id: string, estado: string, usuario: Usuario, extra: { valorFinal?: number | null; notas?: string | null } = {}): Promise<Res<true>> {
  if (!esEstado(estado)) return { ok: false, error: 'Estado no válido.' };
  const d = (await prisma.$queryRaw<{ estado: string }[]>`select estado from "Documento" where id = ${id}`)[0];
  if (!d) return { ok: false, error: 'Documento no encontrado.' };
  const valor = typeof extra.valorFinal === 'number' && isFinite(extra.valorFinal) && extra.valorFinal >= 0 ? extra.valorFinal : null;
  const notas = typeof extra.notas === 'string' ? extra.notas.slice(0, 2000) : null;
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`update "Documento" set estado = ${estado}, "valorFinal" = coalesce(${valor}::numeric, "valorFinal"), notas = coalesce(${notas}, notas), "updatedAt" = now() where id = ${id}`;
    if (d.estado !== estado) await hist(tx, id, `Estado: ${d.estado} → ${estado}`, usuario.nombre);
    if (valor !== null) await hist(tx, id, `Valor final acordado: ${valor.toLocaleString('es-CO')}`, usuario.nombre);
  });
  return { ok: true, dato: true };
}
