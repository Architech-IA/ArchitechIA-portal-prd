import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

export async function GET() {
  const productos = await prisma.producto.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(productos.map(p => ({
    ...p,
    tecnologias: JSON.parse(p.tecnologias),
    caracteristicas: JSON.parse(p.caracteristicas),
  })));
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const body = await request.json();
  const { nombre, version, estado, descripcion, tecnologias, caracteristicas, icono, color } = body;
  const producto = await prisma.producto.create({
    data: {
      nombre, version, estado, descripcion, icono, color,
      tecnologias: JSON.stringify(tecnologias),
      caracteristicas: JSON.stringify(caracteristicas),
    },
  });
  await logActivity({
    type: 'CREATED', description: 'creó el producto  + nombre + ',
    entityType: 'producto', entityId: producto.id, userId: token?.sub,
  });
  return NextResponse.json({ ...producto, tecnologias, caracteristicas });
}
