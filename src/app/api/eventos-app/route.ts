import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

const TIPOS_VALIDOS = new Set(["LOGIN", "ACCION"]);

// Ingesta de trazabilidad desde apps cliente externas (ej. portal-seg / La
// Promotora Seguros). Autenticación server-to-server via header x-api-key ===
// INTERNAL_API_KEY, ya resuelta globalmente por src/proxy.ts para cualquier
// ruta bajo /api/ — se revalida aquí también porque esta ruta NO debe
// aceptar una sesión NextAuth de un usuario del portal, solo llamadas
// máquina a máquina desde apps registradas.
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { appSlug, tipo, actorNombre, actorUsuario, entidad, accion, detalle, metadata } = body;
  if (!appSlug || !tipo || !actorNombre || !actorUsuario) {
    return NextResponse.json(
      { error: "appSlug, tipo, actorNombre y actorUsuario son requeridos" },
      { status: 400 }
    );
  }
  if (!TIPOS_VALIDOS.has(tipo)) {
    return NextResponse.json({ error: `tipo inválido: ${tipo}` }, { status: 400 });
  }

  const evento = await prisma.appEvento.create({
    data: {
      appSlug,
      tipo,
      actorNombre,
      actorUsuario,
      entidad: entidad ?? null,
      accion: accion ?? null,
      detalle: detalle ?? null,
      metadata: metadata ?? undefined,
    },
  });

  return NextResponse.json({ ok: true, id: evento.id }, { status: 201 });
}

// Usada por la pestaña "Aplicaciones" de Operations para listar los eventos
// reportados por las apps cliente.
export async function GET(req: NextRequest) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const appSlug = searchParams.get("appSlug");
  const take = Math.min(Number(searchParams.get("take") ?? 100), 500);

  const eventos = await prisma.appEvento.findMany({
    where: appSlug ? { appSlug } : undefined,
    orderBy: { creadoEn: "desc" },
    take,
  });

  const apps = await prisma.appEvento.groupBy({
    by: ["appSlug"],
    _count: { _all: true },
    _max: { creadoEn: true },
  });

  return NextResponse.json({ eventos, apps });
}
