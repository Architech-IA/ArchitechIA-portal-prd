import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { spawn } from 'child_process'

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

const TODAY = () => new Date().toISOString().split('T')[0]

const COUNCIL_AGENTS = [
  { id: 'agent_ares_001',  name: 'Ares',  slug: 'ares',
    role: 'Sales & Presales Lead. Evaluás impacto comercial, ingresos y protección de clientes.' },
  { id: 'agent_atlas_001', name: 'Atlas', slug: 'atlas',
    role: 'Operations Manager. Evaluás ejecutabilidad, recursos disponibles y timelines realistas.' },
  { id: 'agent_iris_001',  name: 'Iris',  slug: 'iris',
    role: 'Marketing & Brand Lead. Evaluás coherencia de marca y posicionamiento externo.' },
  { id: 'agent_vesta_001', name: 'Vesta', slug: 'vesta',
    role: 'Finance & Legal Lead. Evaluás viabilidad financiera, ROI y riesgos legales.' },
]

const ORION_OPENING_SYSTEM = `Eres Orión, CEO y orquestador del Consejo de ArchiTechIA.
El consejo no alcanzó consenso en el debate previo. Tu rol ahora es ABRIR la negociación:
1. Resumí las principales objeciones de cada miembro
2. Proponé ajustes concretos a la propuesta que podrían resolver esas objeciones
3. Invitá a cada miembro a responder

Tono: directo, constructivo, orientado a consenso. No sos el que decide — sos el facilitador.
Respondé en 3-5 oraciones.`

const agentNegotiationSystem = (name: string, role: string) =>
  `Eres ${name} del Consejo de ArchiTechIA. Rol: ${role}
Orión acaba de proponer ajustes para desbloquear el consenso en una propuesta escalada.
Tu tarea: respondé concretamente —
- Qué ajustes de Orión aceptás
- Qué ajuste adicional específico (1 como máximo) necesitás vos para aprobar
- Si los ajustes ya cubren tus preocupaciones, decí que aprobás con los cambios propuestos

Sé conciso (2-4 oraciones). No repitas el debate anterior — solo tu posición actual.`

const ORION_CLOSING_SYSTEM = `Eres Orión, CEO del Consejo de ArchiTechIA.
Leíste las respuestas de todos los miembros del consejo en la negociación.
Tu tarea: CERRAR el debate con el plan final consensuado.

Primero escribí 2 oraciones declarando el consenso alcanzado y los ajustes incorporados.
Luego respondé con el siguiente JSON (sin markdown):

{
  "epic": {
    "name": "nombre de la épica",
    "description": "qué resuelve y por qué importa",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD"
  },
  "sprints": [
    {
      "name": "Sprint N — nombre",
      "goal": "objetivo concreto",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "areaSlug": "dev|data|infra|qa|sales|operations|finance|marketing|people|delivery|security",
      "tasks": [
        {
          "title": "título accionable",
          "description": "qué hacer",
          "priority": "LOW|MEDIUM|HIGH|CRITICAL",
          "areaSlug": "...",
          "assigneeName": null
        }
      ]
    }
  ]
}

Reglas: 1 épica, 2-4 sprints de 2 semanas, 2-5 tasks por sprint. Hoy es ${TODAY()}.`

async function insertMessage(proposalId: string, agentId: string, agentName: string, agentSlug: string, content: string, round: number) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "DebateMessage" ("proposalId", "agentId", "agentName", "agentSlug", content, round) VALUES ($1,$2,$3,$4,$5,$6)`,
    proposalId, agentId, agentName, agentSlug, content, round
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params

  const [proposal] = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "CouncilProposal" WHERE id = $1`, id)
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get full debate history
  const history = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "agentName", content, round FROM "DebateMessage" WHERE "proposalId" = $1 ORDER BY round, "createdAt"`, id
  )
  const votes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "agentName", vote, argument, weight FROM "AgentVote" WHERE "proposalId" = $1 ORDER BY round, "createdAt"`, id
  )
  const maxRound = history.reduce((m: number, msg: any) => Math.max(m, msg.round), 0)
  const negotiationRound = maxRound + 1

  // Mark proposal as DEBATING
  await prisma.$executeRawUnsafe(`UPDATE "CouncilProposal" SET status = 'DEBATING', "updatedAt" = NOW() WHERE id = $1`, id)

  const debateSummary = history.map((m: any) => `[R${m.round}] ${m.agentName}: ${m.content}`).join('\n')
  const voteSummary = votes.map((v: any) => `${v.agentName} (×${v.weight}): ${v.vote ? 'APROBÓ' : 'RECHAZÓ'} — ${v.argument}`).join('\n')
  const itemsSummary = (proposal.items ?? []).map((i: any) => `- ${i.title}`).join('\n')

  const proposalContext = `PROPUESTA: ${proposal.title}
${proposal.description ?? ''}
Items: ${itemsSummary}

DEBATE PREVIO:
${debateSummary}

VOTOS:
${voteSummary}`

  // 1. Orión opening
  const orionOpening = await callClaude(ORION_OPENING_SYSTEM, proposalContext)
  await insertMessage(id, 'agent_orion_001', 'Orión', 'orion', orionOpening, negotiationRound)

  // 2. Each agent responds
  const agentResponses: string[] = []
  for (const agent of COUNCIL_AGENTS) {
    const agentPrompt = `${proposalContext}

PROPUESTA DE AJUSTES DE ORIÓN:
${orionOpening}`
    const response = await callClaude(agentNegotiationSystem(agent.name, agent.role), agentPrompt)
    await insertMessage(id, agent.id, agent.name, agent.slug, response, negotiationRound)
    agentResponses.push(`${agent.name}: ${response}`)
  }

  // 3. Orión closing — synthesizes plan
  const closingPrompt = `${proposalContext}

PROPUESTA DE AJUSTES DE ORIÓN:
${orionOpening}

RESPUESTAS DEL CONSEJO:
${agentResponses.join('\n\n')}

Cerrá la negociación con el plan final consensuado.`

  const orionClosing = await callClaude(ORION_CLOSING_SYSTEM, closingPrompt)
  await insertMessage(id, 'agent_orion_001', 'Orión', 'orion', orionClosing, negotiationRound)

  // Extract JSON plan from Orión's closing
  const jsonMatch = orionClosing.match(/\{[\s\S]*\}/)
  let negotiatedPlan = null
  if (jsonMatch) {
    try { negotiatedPlan = JSON.parse(jsonMatch[0]) } catch {}
  }

  // Store plan in metadata + mark ESCALATED again (waiting for human to create backlog)
  const existingMeta = proposal.metadata ?? {}
  await prisma.$executeRawUnsafe(
    `UPDATE "CouncilProposal" SET status = 'ESCALATED', metadata = $2::jsonb, "updatedAt" = NOW() WHERE id = $1`,
    id, JSON.stringify({ ...existingMeta, negotiatedPlan })
  )

  return NextResponse.json({ success: true, round: negotiationRound, hasPlan: !!negotiatedPlan })
}
