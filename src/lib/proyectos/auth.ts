import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

// Identidad para Oficina > Proyectos: sesión NextAuth, o la clave interna (cron / automatizaciones).
export interface Usuario { id: string; nombre: string; sistema: boolean }

export async function usuarioActual(req: NextRequest): Promise<Usuario | null> {
  const key = req.headers.get('x-api-key')
  if (key && key === process.env.INTERNAL_API_KEY) return { id: 'sistema', nombre: 'Sistema', sistema: true }
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return null
  const id = String(token.sub ?? (token as { id?: string }).id ?? '')
  if (!id) return null
  return { id, nombre: String(token.name ?? token.email ?? 'Usuario'), sistema: false }
}

export const NO_AUTENTICADO = () => NextResponse.json({ error: 'No autenticado' }, { status: 401 })
export const NO_ENCONTRADO = (que = 'Recurso') => NextResponse.json({ error: `${que} no encontrado` }, { status: 404 })

// Una sesión privada solo la ve quien la creó.
export async function sesionVisible(solucionId: string, sesionId: string, u: Usuario) {
  const s = await prisma.proyectoSesion.findFirst({ where: { id: sesionId, solucionId } })
  if (!s) return null
  if (s.privada && s.creadaPorId !== u.id) return null
  return s
}

export async function solucionExiste(id: string) {
  return prisma.solucion.findUnique({ where: { id }, select: { id: true, nombre: true, estado: true, tipo: true } })
}
