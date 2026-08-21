import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { spawn } from 'child_process'

const EXTRACT_SYSTEM = `Eres Orión, extractor estructurado de propuestas para el consejo de ArchiTechIA.

Tu tarea: analizar una conversación y extraer una propuesta formal con jerarquía Épica → Sprints → Tasks.

Responde SOLO con este JSON exacto (sin markdown, sin explicaciones):

{
  "title": "título conciso de la propuesta (max 80 chars)",
  "description": "descripción ejecutiva de 2-3 oraciones: contexto, problema y objetivo",
  "epic": {
    "name": "nombre de la épica (objetivo de negocio principal)",
    "description": "qué resuelve esta épica y por qué importa"
  },
  "sprints": [
    {
      "name": "Sprint 1 — nombre descriptivo",
      "goal": "objetivo concreto y medible de este sprint",
      "tasks": [
        {
          "title": "título de la tarea",
          "description": "qué hay que hacer exactamente",
          "areaSlug": "dev | data | infra | qa | sales | operations | finance | marketing | people | delivery | security",
          "priority": "LOW | MEDIUM | HIGH | CRITICAL"
        }
      ]
    }
  ]
}

Reglas:
- Siempre 1 sola épica (el objetivo de negocio principal)
- Entre 2 y 4 sprints (nunca más)
- Entre 2 y 5 tasks por sprint (concretas y accionables, no ideas vagas)
- Si algo no está claro, inferí razonablemente desde el contexto
- Responde SOLO con el JSON`

function callClaudeExtract(systemPrompt: string, userPrompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', [
      '--system-prompt', systemPrompt,
      '-p', userPrompt,
    ], { timeout: 60_000 })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    child.on('close', (code: number | null) => {
      if (code !== 0 && !stdout.trim()) reject(new Error(stderr || `claude exited ${code}`))
      else resolve(stdout.trim())
    })
    child.on('error', reject)
  })
}

export async function POST(req: NextRequest) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0)
    return NextResponse.json({ error: 'messages requerido' }, { status: 400 })

  const transcript = messages
    .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'Socio' : 'Orión'}: ${m.content}`)
    .join('\n')

  const userPrompt = `Esta es la conversación completa:\n\n${transcript}\n\nExtrae la propuesta formal en JSON con la jerarquía Épica → Sprints → Tasks.`

  const raw = await callClaudeExtract(EXTRACT_SYSTEM, userPrompt)
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'No se pudo extraer propuesta', raw }, { status: 422 })

  try {
    const proposal = JSON.parse(match[0])
    return NextResponse.json(proposal)
  } catch {
    return NextResponse.json({ error: 'JSON inválido en respuesta', raw }, { status: 422 })
  }
}
