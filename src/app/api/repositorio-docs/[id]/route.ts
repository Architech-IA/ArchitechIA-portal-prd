import { NextRequest, NextResponse } from 'next/server';
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO } from '@/lib/proyectos/auth';
import { obtener, cambiarEstado } from '@/lib/documentos/servicio';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req);
  if (!u) return NO_AUTENTICADO();
  const d = await obtener((await params).id);
  return d ? NextResponse.json(d) : NO_ENCONTRADO('Documento');
}

// PATCH { estado, valorFinal?, notas? }: cambia el estado de seguimiento. El contenido nunca se edita aquí.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req);
  if (!u) return NO_AUTENTICADO();
  const b = await req.json().catch(() => ({})) as { estado?: string; valorFinal?: number | null; notas?: string | null };
  const r = await cambiarEstado((await params).id, String(b.estado ?? ''), { id: u.id, nombre: u.nombre }, { valorFinal: b.valorFinal, notas: b.notas });
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.error.includes('no encontrado') ? 404 : 400 });
}
