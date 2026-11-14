import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AGENTES_FUNCIONALES } from '@/lib/orquestador/registro';
import { obtenerConfig, guardarConfig, historialConfig, accionesDe } from '@/lib/agentes/config';
import { sanearConfig } from '@/lib/agentes/nucleo';

// Configuración de un agente funcional: leer la ve cualquier usuario con sesión; cambiarla, solo administradores.
const esAdmin = (role?: string) => role === 'ADMIN' || role === 'SUPERADMIN';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { slug } = await params;
  const info = AGENTES_FUNCIONALES[slug];
  if (!info) return NextResponse.json({ error: 'Este agente no tiene función real configurable' }, { status: 404 });
  return NextResponse.json({ config: await obtenerConfig(slug), acciones: info.acciones, historial: await historialConfig(slug), puedeEditar: esAdmin(u.role) });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string; name?: string | null } | undefined;
  if (!u?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!esAdmin(u.role)) return NextResponse.json({ error: 'Solo un administrador puede cambiar la configuración de un agente.' }, { status: 403 });
  const { slug } = await params;
  if (!AGENTES_FUNCIONALES[slug]) return NextResponse.json({ error: 'Agente no configurable' }, { status: 404 });
  const nueva = sanearConfig(await request.json().catch(() => null), accionesDe(slug));
  if (!nueva) return NextResponse.json({ error: 'Configuración inválida' }, { status: 400 });
  const resumen = await guardarConfig(slug, nueva, u.name || 'Administrador', u.id);
  return NextResponse.json({ ok: true, resumen, config: nueva, historial: await historialConfig(slug) });
}
