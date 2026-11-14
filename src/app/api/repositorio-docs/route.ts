import { NextRequest, NextResponse } from 'next/server';
import { usuarioActual, NO_AUTENTICADO } from '@/lib/proyectos/auth';
import { listar, subir, MAX_ARCHIVO } from '@/lib/documentos/servicio';

export const dynamic = 'force-dynamic';

// Repositorio de documentos. GET: lista (sin contenido ni archivos) + opciones de clientes y proyectos.
// POST (multipart): sube un archivo nuevo o una versión nueva (campo grupo).
export async function GET(req: NextRequest) {
  const u = await usuarioActual(req);
  if (!u) return NO_AUTENTICADO();
  return NextResponse.json(await listar());
}

export async function POST(req: NextRequest) {
  const u = await usuarioActual(req);
  if (!u) return NO_AUTENTICADO();
  const f = await req.formData().catch(() => null);
  const file = f?.get('archivo');
  if (!f || !(file instanceof File)) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
  if (file.size > MAX_ARCHIVO) return NextResponse.json({ error: 'El archivo supera 15 MB.' }, { status: 413 });
  const txt = (k: string) => { const v = f.get(k); return typeof v === 'string' ? v : ''; };
  const r = await subir({
    titulo: txt('titulo'), tipo: txt('tipo'), estado: txt('estado') || 'Borrador',
    clienteId: txt('clienteId') || null, clienteNombre: txt('clienteNombre'), solucionId: txt('solucionId') || null, grupo: txt('grupo') || null,
    nombreArchivo: file.name, mime: file.type, buf: Buffer.from(await file.arrayBuffer()), usuario: { id: u.id, nombre: u.nombre },
  });
  return r.ok ? NextResponse.json(r.dato) : NextResponse.json({ error: r.error }, { status: 400 });
}
