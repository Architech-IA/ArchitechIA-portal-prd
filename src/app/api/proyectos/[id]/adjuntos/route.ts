import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, solucionExiste, sesionVisible } from '@/lib/proyectos/auth'
import { textoDeBuffer, esLegible } from '@/lib/extraerTexto'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 6 * 1024 * 1024
const MAX_TEXTO = 60_000

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  if (!(await solucionExiste(id))) return NO_ENCONTRADO('Proyecto')
  const lista = await prisma.proyectoAdjunto.findMany({
    where: { solucionId: id }, orderBy: { createdAt: 'desc' },
    select: { id: true, nombre: true, mime: true, size: true, textoLen: true, legible: true, sesionId: true, creadoPorNombre: true, createdAt: true },
  })
  return NextResponse.json(lista)
}

// Subir un adjunto al proyecto: se extrae su texto y se guarda el TEXTO (no el archivo original).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  if (!(await solucionExiste(id))) return NO_ENCONTRADO('Proyecto')

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!form || !(file instanceof File)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El archivo supera los 6 MB' }, { status: 413 })

  let sesionId: string | null = null
  const sid = form.get('sesionId')
  if (typeof sid === 'string' && sid) {
    const s = await sesionVisible(id, sid, u)
    if (!s) return NO_ENCONTRADO('Sesión')
    sesionId = s.id
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const texto = esLegible(file.name) ? await textoDeBuffer(buffer, file.name) : null
  const legible = !!texto
  const guardado = (texto ?? '').slice(0, MAX_TEXTO)
  const adj = await prisma.proyectoAdjunto.create({
    data: {
      solucionId: id, sesionId, nombre: file.name.slice(0, 200), mime: file.type || null, size: file.size,
      texto: guardado, textoLen: guardado.length, legible, creadoPorId: u.id, creadoPorNombre: u.nombre,
    },
    select: { id: true, nombre: true, mime: true, size: true, textoLen: true, legible: true, sesionId: true, creadoPorNombre: true, createdAt: true },
  })
  return NextResponse.json({ ...adj, truncado: (texto?.length ?? 0) > MAX_TEXTO }, { status: 201 })
}
