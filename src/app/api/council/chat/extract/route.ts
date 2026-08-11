import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const EXTRACT_SYSTEM = `Eres Orión, extractor estructurado de propuestas para el consejo de ArchiTechIA.

Tu tarea: analizar una conversación entre un socio y tú mismo, y extraer una propuesta formal con el siguiente formato JSON EXACTO (sin markdown, sin explicaciones):

{
  "title": "título conciso de la propuesta (max 80 chars)",
  "description": "descripción ejecutiva de 2-3 oraciones explicando el por qué y el objetivo",
  "items": [
    {
      "type": "task" o "sprint",
      "title": "título del item",
      "description": "qué implica este item",
      "areaSlug": "slug del área propietaria (operations/sales/finance/marketing/people/delivery/dev/data/infra/security/qa)",
      "priority": "LOW" o "MEDIUM" o "HIGH" o "CRITICAL"
    }
  ]
}

Si la conversación no es suficientemente clara para extraer items concretos, crea al menos 1 task genérica con lo que se pueda inferir. Responde SOLO con el JSON.`

export async function POST(req: NextRequest) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0)
    return NextResponse.json({ error: 'messages requerido' }, { status: 400 })

  const transcript = messages
    .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'Socio' : 'Orión'}: ${m.content}`)
    .join('\n')

  const userPrompt = `Esta es la conversación completa:\n\n${transcript}\n\nExtrae la propuesta formal en JSON.`
  const safeSystem = EXTRACT_SYSTEM.replace(/'/g, "'\\''")
  const safeUser = userPrompt.replace(/'/g, "'\\''")

  const { stdout } = await execAsync(`claude --system-prompt '${safeSystem}' -p '${safeUser}'`, { timeout: 60000 })
  const raw = stdout.trim()
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'No se pudo extraer propuesta', raw }, { status: 422 })

  try {
    const proposal = JSON.parse(match[0])
    return NextResponse.json(proposal)
  } catch {
    return NextResponse.json({ error: 'JSON inválido en respuesta', raw }, { status: 422 })
  }
}
