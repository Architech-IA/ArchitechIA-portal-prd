import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sesionCorreo } from '@/lib/correo/sesion';
import { clasificarPendientes } from '@/lib/correo/servicio';

/**
 * Importación manual (solo administradores): sirve para probar la clasificación o cargar correos
 * que no vienen de un buzón conectado. Los mensajes quedan con proveedor MANUAL.
 */
export async function POST(req: NextRequest) {
  const s = await sesionCorreo(req);
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!s.admin) return NextResponse.json({ error: 'Solo un administrador importa correos' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const lista = Array.isArray(b.mensajes) ? b.mensajes.slice(0, 200) : [];
  if (lista.length === 0) return NextResponse.json({ error: 'Envía al menos un mensaje' }, { status: 400 });
  let creados = 0;
  for (const [i, m] of lista.entries()) {
    const de = String(m.de ?? '').slice(0, 200);
    const asunto = String(m.asunto ?? '').slice(0, 300);
    if (!de.includes('@') || !asunto) continue;
    const cuerpo = String(m.cuerpo ?? '').slice(0, 20000);
    const adj = Array.isArray(m.adjuntos) ? m.adjuntos.map((x: unknown) => String(x).slice(0, 200)).slice(0, 20) : [];
    const externalId = `manual-${Date.now()}-${i}`;
    await prisma.externalMessage.create({
      data: {
        userId: s.userId, externalId, provider: 'MANUAL', subject: asunto, sender: de.toLowerCase(),
        senderName: m.nombre ? String(m.nombre).slice(0, 120) : null,
        bodyPreview: cuerpo.slice(0, 240), bodyHtml: cuerpo ? `<p>${cuerpo.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))}</p>` : null,
        receivedAt: new Date(), hasAttachments: adj.length > 0, adjuntos: adj.length ? JSON.stringify(adj) : null,
      },
    });
    creados++;
  }
  const c = await clasificarPendientes(s.userId);
  return NextResponse.json({ creados, ...c }, { status: 201 });
}
