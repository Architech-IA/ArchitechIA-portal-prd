import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, solucionExiste } from '@/lib/proyectos/auth'
import { TIPOS_SUSCRIPCION } from '@/lib/proyectos/tipos'
import { obtenerBitacora } from '@/lib/proyectos/suscripciones'

export const dynamic = 'force-dynamic'

const INTERVALO_POR_DEFECTO: Record<string, number> = { BACKLOG_CAMBIOS: 30, DOCUMENTOS_CAMBIOS: 30, RESUMEN_PERIODICO: 10_080 }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  if (!(await solucionExiste(id))) return NO_ENCONTRADO('Proyecto')
  const lista = await prisma.proyectoSuscripcion.findMany({ where: { solucionId: id }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json(lista.map(s => ({ ...s, config: undefined })))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  if (!(await solucionExiste(id))) return NO_ENCONTRADO('Proyecto')
  const b = await req.json().catch(() => ({})) as { tipo?: string; nombre?: string; intervaloMin?: number }
  if (!(TIPOS_SUSCRIPCION as readonly string[]).includes(String(b.tipo))) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  const tipo = String(b.tipo)
  const dup = await prisma.proyectoSuscripcion.findFirst({ where: { solucionId: id, tipo } })
  if (dup) return NextResponse.json({ error: 'Ya existe una automatización de este tipo en el proyecto' }, { status: 409 })
  const intervalo = Number.isFinite(Number(b.intervaloMin)) && Number(b.intervaloMin) >= 10 ? Math.min(Number(b.intervaloMin), 43_200) : INTERVALO_POR_DEFECTO[tipo]
  const sesionId = await obtenerBitacora(id)
  const s = await prisma.proyectoSuscripcion.create({ data: { solucionId: id, tipo, nombre: (b.nombre ?? '').slice(0, 80), intervaloMin: intervalo, sesionId, creadaPorId: u.id } })
  return NextResponse.json({ ...s, config: undefined }, { status: 201 })
}
