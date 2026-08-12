import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const COUNCIL_AGENTS = [
  {
    id: 'agent_orion_001',
    name: 'Orión',
    slug: 'orion',
    systemPrompt: `Eres Orión, el agente estratégico central de ArchiTechIA. Actúas como CEO operacional del consejo de agentes.
Tu función: evaluar si una propuesta es coherente con la visión estratégica de ArchiTechIA, si se alinea con las soluciones activas y si tiene viabilidad sistémica a largo plazo.
Eres reflexivo, decisivo y hablas con autoridad. Tu peso de voto es 3 (el más alto del consejo).
Si rechazas, tu argumento guía la reformulación en ronda 2.
Responde EXCLUSIVAMENTE con JSON sin markdown: {"argument": "análisis en 2-3 oraciones", "vote": true o false}`,
  },
  {
    id: 'agent_ares_001',
    name: 'Ares',
    slug: 'ares',
    systemPrompt: `Eres Ares, el agente comercial de ArchiTechIA. Rol: Sales & Presales Lead.
Tu función: evaluar si la propuesta tiene impacto comercial real, genera ingresos directos o abre oportunidades de negocio concretas.
Eres agresivo, orientado a conversión y piensas en el pipeline. Si algo no mueve ventas o no protege clientes actuales, eres escéptico.
Responde EXCLUSIVAMENTE con JSON sin markdown: {"argument": "análisis en 2-3 oraciones", "vote": true o false}`,
  },
  {
    id: 'agent_atlas_001',
    name: 'Atlas',
    slug: 'atlas',
    systemPrompt: `Eres Atlas, el agente operativo de ArchiTechIA. Rol: Operations Manager.
Tu función: evaluar si la propuesta es ejecutable con los recursos actuales del equipo, si tiene dependencias bloqueantes y si el timeline es realista.
Eres analítico, exiges datos concretos y no especulas. Si falta información crítica para estimar esfuerzo, lo señalas y rechazas por precaución.
Responde EXCLUSIVAMENTE con JSON sin markdown: {"argument": "análisis en 2-3 oraciones", "vote": true o false}`,
  },
  {
    id: 'agent_iris_001',
    name: 'Iris',
    slug: 'iris',
    systemPrompt: `Eres Iris, la agente de marketing y marca de ArchiTechIA. Rol: Marketing & Brand Lead.
Tu función: evaluar si la propuesta es coherente con la identidad de marca ArchiTechIA, si la comunicación externa es adecuada y si refuerza el posicionamiento en el mercado.
Eres creativa pero rigurosa con la identidad. Preguntas: ¿cómo lo vería un cliente? ¿refuerza o diluye la marca?
Responde EXCLUSIVAMENTE con JSON sin markdown: {"argument": "análisis en 2-3 oraciones", "vote": true o false}`,
  },
  {
    id: 'agent_vesta_001',
    name: 'Vesta',
    slug: 'vesta',
    systemPrompt: `Eres Vesta, la agente de finanzas y legal de ArchiTechIA. Rol: Finance & Legal Lead.
Tu función: evaluar la viabilidad financiera de la propuesta, si hay presupuesto disponible, si el ROI justifica la inversión y si hay riesgos legales o de cumplimiento.
Eres conservadora y precisa. Si el costo no está justificado o hay riesgo legal sin mitigación, rechazas.
Responde EXCLUSIVAMENTE con JSON sin markdown: {"argument": "análisis en 2-3 oraciones", "vote": true o false}`,
  },
]

const AGENT_WEIGHTS: Record<string, number> = {
  orion: 3,
  ares: 1,
  atlas: 2,
  iris: 1,
  vesta: 1,
}

const VOTE_INSTRUCTION = '\n\nResponde EXCLUSIVAMENTE con JSON sin markdown: {"argument": "análisis en 2-3 oraciones", "vote": true o false}'

async function callAgentLLM(
  systemPrompt: string,
  userMessage: string,
  model?: string | null,
): Promise<{ argument: string; vote: boolean }> {
  let stdout: string

  if (model && (model.startsWith('openai/') || model.startsWith('openrouter/') || model.startsWith('opencode/') || model.startsWith('opencode-go/'))) {
    // OpenCode GO path: use opencode run with combined prompt
    const combined = `${systemPrompt}\n\n---\n\n${userMessage}`
    const safePrompt = combined.replace(/'/g, "'\\''")
    const cmd = `OPENAI_API_KEY=${process.env.OPENAI_API_KEY} OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY} OPENCODE_API_KEY=${process.env.OPENCODE_API_KEY} opencode run '${safePrompt}' --model ${model}`
    const res = await execAsync(cmd, { timeout: 90000 })
    stdout = res.stdout.trim()
  } else {
    // Claude CLI path
    const safeSystem = systemPrompt.replace(/'/g, "'\\''")
    const safeUser = userMessage.replace(/'/g, "'\\''")
    const modelFlag = model ? `--model ${model} ` : ''
    const cmd = `claude ${modelFlag}--system-prompt '${safeSystem}' -p '${safeUser}'`
    const res = await execAsync(cmd, { timeout: 60000 })
    stdout = res.stdout.trim()
  }

  const match = stdout.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON in response: ${stdout.slice(0, 200)}`)
  return JSON.parse(match[0])
}

async function runDebateEngine(proposalId: string, round: number) {
  const COUNCIL_SLUGS = ['orion', 'ares', 'atlas', 'iris', 'vesta']
  const dbAgents = await prisma.agent.findMany({
    where: { slug: { in: COUNCIL_SLUGS } },
    select: { id: true, name: true, slug: true, systemPrompt: true, llmModel: true },
  })
  const councilAgents = COUNCIL_SLUGS.map(slug => {
    const db = dbAgents.find(a => a.slug === slug)
    const fb = COUNCIL_AGENTS.find(a => a.slug === slug)!
    return {
      id: db?.id ?? fb.id,
      name: db?.name ?? fb.name,
      slug,
      systemPrompt: db?.systemPrompt ? db.systemPrompt + VOTE_INSTRUCTION : fb.systemPrompt,
      llmModel: db?.llmModel ?? null,
    }
  })

  const [proposal] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "CouncilProposal" WHERE id = $1`, proposalId
  )
  if (!proposal) return

  const itemsSummary = (proposal.items as any[])
    .map((i: any) => `- ${i.type}: ${i.title}`)
    .join('\n') || 'Sin items específicos'

  const prevMessages = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "agentName", content FROM "DebateMessage" WHERE "proposalId" = $1 AND round = $2 ORDER BY "createdAt"`,
    proposalId, round
  )

  for (const agent of councilAgents) {
    try {
      const prevContext = prevMessages.length > 0
        ? '\n\nDebate previo en esta ronda:\n' + prevMessages.map((m: any) => `${m.agentName}: ${m.content}`).join('\n')
        : ''

      const userMessage = `PROPUESTA A EVALUAR:
Título: ${proposal.title}
Descripción: ${proposal.description ?? 'Sin descripción'}
Canal de entrada: ${proposal.inputChannel}
Items propuestos:
${itemsSummary}${prevContext}

Analiza esta propuesta desde tu perspectiva y emite tu voto. Recuerda responder solo con JSON.`

      const result = await callAgentLLM(agent.systemPrompt, userMessage, agent.llmModel)

      await prisma.$executeRawUnsafe(
        `INSERT INTO "DebateMessage" ("proposalId", "agentId", "agentName", "agentSlug", content, round)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        proposalId, agent.id, agent.name, agent.slug,
        result.argument ?? 'Sin argumento generado',
        round
      )

      let weight = AGENT_WEIGHTS[agent.slug] ?? 1
      const items: any[] = proposal.items ?? []
      if (agent.slug !== 'orion') {
        const areaIds = items.map((i: any) => i.areaId).filter(Boolean)
        if (areaIds.length > 0) {
          const areaAgents = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "agentSlug" FROM "Area" WHERE id = ANY($1::text[]) AND "agentSlug" IS NOT NULL`, areaIds
          )
          if (areaAgents.some((a: any) => a.agentSlug === agent.slug)) weight = 2
        }
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO "AgentVote" ("proposalId", "agentId", "agentName", "agentSlug", weight, vote, argument, round)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT ("proposalId", "agentId", round) DO UPDATE
           SET vote=$6, argument=$7, weight=$5, "createdAt"=NOW()`,
        proposalId, agent.id, agent.name, agent.slug, weight, result.vote,
        result.argument ?? null, round
      )

      prevMessages.push({ agentName: agent.name, content: result.argument })

    } catch (err) {
      console.error(`[DebateEngine] Error with agent ${agent.name}:`, err)
    }
  }

  const THRESHOLD = 5
  const allVotes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "AgentVote" WHERE "proposalId" = $1 AND round = $2`, proposalId, round
  )
  const weightedScore = allVotes.reduce((s: number, v: any) => s + (v.vote ? Number(v.weight) : 0), 0)

  if (weightedScore >= THRESHOLD) {
    await prisma.$executeRawUnsafe(
      `UPDATE "CouncilProposal" SET status = 'APPROVED', "updatedAt" = NOW() WHERE id = $1`, proposalId
    )
    const items: any[] = proposal.items ?? []
    for (const item of items) {
      if (item.type === 'task') {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "BacklogItem" (title, description, status, priority, "itemType", "areaId", "epicId", "sprintId", "createdByAgentId", "createdByAgentName")
           VALUES ($1,$2,'BACKLOG',$3,'TASK',$4,$5,$6,$7,$8)`,
          item.title ?? 'Task sin título', item.description ?? null,
          item.priority ?? 'MEDIUM', item.areaId ?? null,
          proposal.epicId ?? item.epicId ?? null,
          proposal.sprintId ?? item.sprintId ?? null,
          'agent_orion_001', 'Orión'
        )
      } else if (item.type === 'sprint') {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "Sprint" (name, goal, status, "epicId", "ownerAreaId", "responsibleId", "responsibleName")
           VALUES ($1,$2,'PLANNED',$3,$4,$5,$6)`,
          item.title ?? 'Sprint', item.goal ?? null,
          proposal.epicId ?? item.epicId ?? null,
          item.areaId ?? null, 'agent_orion_001', 'Orión'
        )
      }
    }
  } else if (round >= 2) {
    await prisma.$executeRawUnsafe(
      `UPDATE "CouncilProposal" SET status = 'ESCALATED', "updatedAt" = NOW() WHERE id = $1`, proposalId
    )
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE "CouncilProposal" SET status = 'REVISED', "updatedAt" = NOW() WHERE id = $1`, proposalId
    )
    const [original] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "CouncilProposal" WHERE id = $1`, proposalId
    )
    if (original) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CouncilProposal" (title, description, status, "inputChannel", items, round, "epicId", "sprintId", "solucionId", "createdByAgentId", "createdByAgentName", metadata)
         VALUES ($1,$2,'PENDING',$3,$4::jsonb,2,$5,$6,$7,$8,$9,$10::jsonb)`,
        `[Revisada] ${original.title}`, original.description, original.inputChannel,
        JSON.stringify(original.items), original.epicId, original.sprintId, original.solucionId,
        original.createdByAgentId, original.createdByAgentName,
        JSON.stringify({ originalProposalId: proposalId, revisedRound: 2, ...(original.metadata ?? {}) })
      )
    }
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const round = Number(body.round ?? 1)

  const [proposal] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, status, round FROM "CouncilProposal" WHERE id = $1`, id
  )
  if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  if (!['PENDING', 'REVISED'].includes(proposal.status)) {
    return NextResponse.json({ error: `No se puede iniciar debate con status: ${proposal.status}` }, { status: 400 })
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "CouncilProposal" SET status = 'DEBATING', "updatedAt" = NOW() WHERE id = $1`, id
  )

  runDebateEngine(id, round).catch(err => console.error('[DebateEngine] Fatal error:', err))

  return NextResponse.json({ started: true, status: 'DEBATING', proposalId: id, round })
}
