import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { spawn } from 'child_process'

const TODAY = () => new Date().toISOString().split('T')[0]

const SYNTHESIS_SYSTEM = `Eres el Consejo de ArchiTechIA en modo síntesis. Analizaste una propuesta en múltiples rondas y ahora debés definir el plan de ejecución final.

Tu tarea: basándote en el debate completo, producir una estructura de trabajo CONCRETA y EJECUTABLE.

Responde SOLO con este JSON (sin markdown):

{
  "epic": {
    "name": "nombre de la épica (objetivo de negocio)",
    "description": "qué resuelve y por qué importa",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD"
  },
  "sprints": [
    {
      "name": "Sprint 1 — nombre descriptivo",
      "goal": "objetivo concreto y medible",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "areaSlug": "dev | data | infra | qa | sales | operations | finance | marketing | people | delivery | security",
      "tasks": [
        {
          "title": "título accionable",
          "description": "qué hay que hacer exactamente",
          "priority": "LOW | MEDIUM | HIGH | CRITICAL",
          "areaSlug": "dev | data | infra | qa | sales | operations | finance | marketing | people | delivery | security",
          "assigneeName": "nombre sugerido o null"
        }
      ]
    }
  ]
}

Reglas:
- 1 épica, 2-4 sprints, 2-5 tasks por sprint
- Sprints de 2 semanas cada uno, comenzando desde hoy
- assigneeName: solo si el contexto del debate menciona personas concretas, si no null
- Responde SOLO con el JSON`

function callClaude(system: string, user: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['--system-prompt', system, '-p', user], { timeout: 90_000 })
    let out = ''
    child.stdout.on('data', (d: Buffer) => { out += d.toString() })
    child.on('close', (code: number | null) => {
      if (code !== 0 && !out.trim()) reject(new Error(`claude exited ${code}`))
      else resolve(out.trim())
    })
    child.on('error', reject)
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params

  const [proposal] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "CouncilProposal" WHERE id = $1`, id
  )
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const messages = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "agentName", content, round FROM "DebateMessage" WHERE "proposalId" = $1 ORDER BY round, "createdAt"`, id
  )
  const votes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "agentName", vote, argument, weight FROM "AgentVote" WHERE "proposalId" = $1 ORDER BY round, "createdAt"`, id
  )

  const debateContext = messages.map((m: any) => `[Ronda ${m.round}] ${m.agentName}: ${m.content}`).join('\n')
  const voteContext = votes.map((v: any) => `${v.agentName} (×${v.weight}): ${v.vote ? 'APROBÓ' : 'RECHAZÓ'} — ${v.argument}`).join('\n')
  const itemsSummary = (proposal.items ?? []).map((i: any) => `- ${i.type}: ${i.title}`).join('\n')

  const userPrompt = `PROPUESTA:
Título: ${proposal.title}
Descripción: ${proposal.description ?? ''}
Items originales:
${itemsSummary}

DEBATE DEL CONSEJO:
${debateContext}

VOTOS FINALES:
${voteContext}

Fecha de hoy: ${TODAY()}

Basándote en todo el debate, definí el plan de ejecución final con Épica, Sprints y Tasks concretas.`

  const raw = await callClaude(SYNTHESIS_SYSTEM, userPrompt)
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'No se pudo sintetizar', raw }, { status: 422 })

  try {
    return NextResponse.json(JSON.parse(match[0]))
  } catch {
    return NextResponse.json({ error: 'JSON inválido', raw }, { status: 422 })
  }
}
