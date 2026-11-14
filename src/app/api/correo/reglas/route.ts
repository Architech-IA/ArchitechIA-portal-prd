import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sesionCorreo } from '@/lib/correo/sesion';

export async function GET(req: NextRequest) {
  const s = await sesionCorreo(req);
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const reglas = await prisma.correoRegla.findMany({
    orderBy: [{ origen: 'asc' }, { createdAt: 'desc' }],
    include: { categoria: { select: { nombre: true, color: true } } },
  });
  return NextResponse.json(reglas);
}

export async function POST(req: NextRequest) {
  const s = await sesionCorreo(req);
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!s.admin) return NextResponse.json({ error: 'Solo un administrador crea reglas' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const tipo = String(b.tipo ?? '');
  const patron = String(b.patron ?? '').trim();
  if (!['REMITENTE', 'DOMINIO', 'TEXTO'].includes(tipo)) return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 });
  if (patron.length < 3 || patron.length > 200) return NextResponse.json({ error: 'El patrón debe tener entre 3 y 200 caracteres' }, { status: 400 });
  const cat = await prisma.correoCategoria.findUnique({ where: { id: String(b.categoriaId ?? '') } });
  if (!cat) return NextResponse.json({ error: 'Categoría no existe' }, { status: 400 });
  const clave = tipo === 'TEXTO' ? patron : patron.toLowerCase();
  const existe = await prisma.correoRegla.findUnique({ where: { tipo_patron: { tipo, patron: clave } } });
  if (existe) return NextResponse.json({ error: 'Esa regla ya existe' }, { status: 409 });
  const r = await prisma.correoRegla.create({
    data: { tipo, patron: clave, categoriaId: cat.id, origen: 'MANUAL', creadaPor: s.userId },
  });
  return NextResponse.json(r, { status: 201 });
}
