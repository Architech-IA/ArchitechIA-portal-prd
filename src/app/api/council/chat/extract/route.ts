import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const OPENCODE_GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_KEY = process.env.OPENCODE_API_KEY ?? ''
const OPENCODE_MODEL = process.env.OPENCODE_EXECUTOR_MODEL ?? 'qwen3.7-max'

// Algunos modelos razonadores devuelven su cadena de pensamiento inline
// dentro de "content" entre <think>...</think> (ver masd_worker.py / plan/start).
function stripReasoningTags(text: string): string {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const dangling = cleaned.toLowerCase().indexOf('<think>')
  return (dangling !== -1 ? cleaned.slice(0, dangling) : cleaned).trim()
}

function buildExtractSystem(solutionsList: string): string {
  return `Eres Orión, extractor estructurado de propuestas para el consejo de ArchiTechIA.

Tu tarea: analizar una conversación y extraer una propuesta formal con jerarquía Épica → Sprints → Tasks, y sugerir a qué Solución pertenece.

Responde SOLO con este JSON exacto (sin markdown, sin explicaciones):

{
  "title": "título conciso de la propuesta (max 80 chars)",
  "description": "descripción ejecutiva de 2-3 oraciones: contexto, problema y objetivo",
  "solucionSugerida": {
    "solucionId": "ID exacto de una solución existente de la lista, o null si ninguna aplica",
    "solucionPropuesta": { "name": "nombre corto de la solución nueva", "description": "qué es" } o null si usaste solucionId
  },
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

SOLUCIONES EXISTENTES (usar su ID exacto en solucionId si la propuesta pertenece a una de estas; si no encaja en ninguna, proponé una nueva en solucionPropuesta):
${solutionsList}

Reglas:
- Siempre 1 sola épica (el objetivo de negocio principal)
- Entre 2 y 4 sprints (nunca más)
- Entre 2 y 5 tasks por sprint (concretas y accionables, no ideas vagas)
- Si algo no está claro, inferí razonablemente desde el contexto
- No inventes un solucionId que no esté en la lista
- Responde SOLO con el JSON`
}

async function callExtractLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(OPENCODE_GO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENCODE_KEY}` },
    body: JSON.stringify({
      model: OPENCODE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) {
    throw new Error(`OpenCode API error ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  return stripReasoningTags(content)
}

export async function POST(req: NextRequest) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0)
    return NextResponse.json({ error: 'messages requerido' }, { status: 400 })

  const solutions = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, nombre, descripcion FROM "Solucion" ORDER BY "createdAt" DESC LIMIT 20`
  )
  const solutionsList = solutions.length
    ? solutions.map((s: any) => `  - ID:"${s.id}" Nombre:"${s.nombre}"${s.descripcion ? ' - ' + s.descripcion : ''}`).join('\n')
    : '  (ninguna aún — proponé siempre una nueva)'

  const transcript = messages
    .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'Socio' : 'Orión'}: ${m.content}`)
    .join('\n')

  const userPrompt = `Esta es la conversación completa:\n\n${transcript}\n\nExtrae la propuesta formal en JSON con la jerarquía Épica → Sprints → Tasks, y sugerí la Solución.`

  let raw: string
  try {
    raw = await callExtractLLM(buildExtractSystem(solutionsList), userPrompt)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }

  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'No se pudo extraer propuesta', raw }, { status: 422 })

  try {
    const proposal = JSON.parse(match[0])
    return NextResponse.json(proposal)
  } catch {
    return NextResponse.json({ error: 'JSON inválido en respuesta', raw }, { status: 422 })
  }
}
