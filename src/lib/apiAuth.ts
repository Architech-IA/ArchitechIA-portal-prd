import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Verifica autenticación por sesión NextAuth O por x-api-key header.
 * Permite acceso desde el MCP del bot de Telegram.
 */
export async function isAuthed(request: NextRequest): Promise<boolean> {
  // 1. API key interna (bot / MCP)
  const apiKey = request.headers.get('x-api-key')
  if (apiKey && apiKey === process.env.PORTAL_API_KEY) return true

  // 2. Sesión NextAuth (usuario en el portal)
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  return !!token
}
