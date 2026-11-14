import { prisma } from '@/lib/prisma';
import { clasificar, type ReglaCorreo } from './clasificar';

export async function cargarReglas(): Promise<ReglaCorreo[]> {
  const rs = await prisma.correoRegla.findMany({ where: { activa: true } });
  return rs.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    patron: r.patron,
    categoriaId: r.categoriaId,
    origen: r.origen,
    clienteId: r.clienteId,
  }));
}

function listaAdjuntos(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Clasifica los mensajes que aún no se evaluaron (categoriaOrigen vacío). Devuelve cuántos tocó. */
export async function clasificarPendientes(userId?: string): Promise<{ evaluados: number; clasificados: number }> {
  const reglas = await cargarReglas();
  const pendientes = await prisma.externalMessage.findMany({
    where: { categoriaOrigen: null, deletedAt: null, ...(userId ? { userId } : {}) },
    select: { id: true, sender: true, subject: true, bodyPreview: true, hasAttachments: true, adjuntos: true },
    take: 500,
  });
  let clasificados = 0;
  for (const m of pendientes) {
    const r = clasificar(
      { sender: m.sender, subject: m.subject, bodyPreview: m.bodyPreview, hasAttachments: m.hasAttachments, adjuntos: listaAdjuntos(m.adjuntos) },
      reglas,
    );
    await prisma.externalMessage.update({
      where: { id: m.id },
      data: {
        categoriaId: r.categoriaId,
        categoriaOrigen: r.origen,
        confianza: r.confianza,
        motivo: r.motivo,
        clienteId: r.clienteId ?? null,
      },
    });
    if (r.reglaId) {
      await prisma.correoRegla.update({ where: { id: r.reglaId }, data: { aciertos: { increment: 1 } } }).catch(() => {});
    }
    if (r.categoriaId) clasificados++;
  }
  return { evaluados: pendientes.length, clasificados };
}

/**
 * El usuario fija la categoría de un mensaje. Se guarda la acción (reversible) y, si el remitente
 * no tenía regla manual, se aprende una regla por remitente para los siguientes correos.
 */
export async function fijarCategoria(mensajeId: string, userId: string, categoriaId: string | null) {
  const m = await prisma.externalMessage.findUnique({ where: { id: mensajeId } });
  if (!m) throw new Error('Mensaje no encontrado');
  if (categoriaId) {
    const c = await prisma.correoCategoria.findUnique({ where: { id: categoriaId } });
    if (!c) throw new Error('Categoría no existe');
  }
  const antes = { categoriaId: m.categoriaId, categoriaOrigen: m.categoriaOrigen, confianza: m.confianza, motivo: m.motivo, revisado: m.revisado };
  const despues = {
    categoriaId,
    categoriaOrigen: categoriaId ? 'MANUAL' : 'NINGUNA',
    confianza: categoriaId ? 'Alta' : 'Baja',
    motivo: categoriaId ? 'Categoría fijada por una persona' : 'Categoría quitada por una persona',
    revisado: true,
  };
  await prisma.externalMessage.update({ where: { id: mensajeId }, data: despues });
  await prisma.correoAccion.create({
    data: { mensajeId, userId, accion: 'CATEGORIA', antes: JSON.stringify(antes), despues: JSON.stringify(despues) },
  });
  if (categoriaId && m.sender) {
    const patron = m.sender.toLowerCase();
    const existente = await prisma.correoRegla.findUnique({ where: { tipo_patron: { tipo: 'REMITENTE', patron } } });
    if (!existente) {
      await prisma.correoRegla.create({
        data: { tipo: 'REMITENTE', patron, categoriaId, origen: 'APRENDIDA', creadaPor: userId },
      });
    } else if (existente.origen === 'APRENDIDA' && existente.categoriaId !== categoriaId) {
      await prisma.correoRegla.update({ where: { id: existente.id }, data: { categoriaId } });
    }
  }
}

export async function marcarRevisado(mensajeId: string, userId: string, revisado: boolean) {
  const m = await prisma.externalMessage.findUnique({ where: { id: mensajeId }, select: { revisado: true } });
  if (!m) throw new Error('Mensaje no encontrado');
  await prisma.externalMessage.update({ where: { id: mensajeId }, data: { revisado } });
  await prisma.correoAccion.create({
    data: { mensajeId, userId, accion: 'REVISADO', antes: JSON.stringify({ revisado: m.revisado }), despues: JSON.stringify({ revisado }) },
  });
}

export async function revertirAccion(accionId: string) {
  const a = await prisma.correoAccion.findUnique({ where: { id: accionId } });
  if (!a) throw new Error('Acción no encontrada');
  if (a.revertida) throw new Error('Esa acción ya se revirtió');
  const antes = a.antes ? JSON.parse(a.antes) : {};
  await prisma.externalMessage.update({ where: { id: a.mensajeId }, data: antes });
  await prisma.correoAccion.update({ where: { id: accionId }, data: { revertida: true } });
}
