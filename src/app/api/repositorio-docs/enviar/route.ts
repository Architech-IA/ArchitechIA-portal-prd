import { NextRequest, NextResponse } from 'next/server';
import { usuarioActual, NO_AUTENTICADO } from '@/lib/proyectos/auth';
import { registrarEnvio } from '@/lib/documentos/servicio';

export const dynamic = 'force-dynamic';

// POST { solucionId, faseClave, entregableClave, canal, fecha?, tipo? }: «Marcar como enviada». Congela el texto actual del documento.
// Solo una persona con sesión puede hacerlo (la clave interna de automatizaciones no).
export async function POST(req: NextRequest) {
  const u = await usuarioActual(req);
  if (!u || u.sistema) return NO_AUTENTICADO();
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const s = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
  if (!s('solucionId') || !s('faseClave') || !s('entregableClave')) return NextResponse.json({ error: 'Falta indicar el documento.' }, { status: 400 });
  const r = await registrarEnvio({ solucionId: s('solucionId'), faseClave: s('faseClave'), entregableClave: s('entregableClave'), tipo: s('tipo') || undefined, canal: s('canal'), fecha: s('fecha') || undefined, usuario: { id: u.id, nombre: u.nombre } });
  return r.ok ? NextResponse.json(r.dato) : NextResponse.json({ error: r.error }, { status: 400 });
}
