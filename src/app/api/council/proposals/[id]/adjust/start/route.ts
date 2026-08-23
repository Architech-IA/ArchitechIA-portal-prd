import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const ADJUST_AGENTS = [
  {
    slug: 'ares',
    prompt: `Eres Ares, Sales Lead. La propuesta fue rechazada.
Analiza las razones de rechazo desde la perspectiva comercial:
- Que aspectos no tienen justificacion de negocio suficiente
- Que cambios aumentarian el impacto comercial
- Que se podria reducir o simplificar sin perder valor
Propone cambios concretos. Responde en prosa, 3-4 oraciones.`,
  },
  {
    slug: 'atlas',
    prompt: `Eres Atlas, Operations Manager. La propuesta fue rechazada.
Analiza las razones de rechazo desde la perspectiva operativa:
- Que parte del alcance es inviable o demasiado amplia
- Que simplificaciones harían el scope ejecutable
- Que dependencias bloqueantes hay que resolver primero
Propone ajustes concretos. Responde en prosa, 3-4 oraciones.`,
  },
  {
    slug: 'vesta',
    prompt: `Eres Vesta, Finance Lead. La propuesta fue rechazada.
Analiza las razones de rechazo desde la perspectiva financiera:
- Que aspectos tienen riesgo financiero no justificado
- Como se podria reducir el costo o riesgo manteniendo el valor
- Que ajuste al presupuesto o alcance mejoraria la aprobacion
Propone ajustes concretos. Responde en prosa, 3-4 oraciones.`,
  },
  {
    slug: 'iris',
    prompt: `Eres Iris, Marketing Lead. La propuesta fue rechazada.
Analiza las razones de rechazo desde branding/comunicacion:
- Que aspectos no estan bien comunicados o alineados con la marca
- Como se podria reformular para que sea mas convincente
- Que ajustes de enfoque o narrativa mejorarian la aceptacion
Responde en prosa, 3-4 oraciones.`,
  },
  {
    slug: 'orion',
    prompt: `Eres Orion, CEO operacional. Con los inputs de todos los agentes,
sintetiza los ajustes definitivos a la propuesta rechazada.
Que cambios concretos y especificos se deben hacer para que sea aprobable.
Responde EXCLUSIVAMENTE con JSON valido sin markdown.`,
  },
]

async function callLLM(systemPrompt: string, userMessage: string, model?: string | null): Promise<string> {
  let stdout: string
  if (model && (model.startsWith('openai/') || model.startsWith('openrouter/') || model.startsWith('opencode/'))) {
    const combined = `${systemPrompt}\n\n---\n\n${userMessage}`
    const safe = combined.replace(/'/g, "'\\''")
    const cmd = `OPENAI_API_KEY=${process.env.OPENAI_API_KEY} OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY} opencode run '${safe}' --model ${model}`
    const res = await execAsync(cmd, { timeout: 120000 })
    stdout = res.stdout.trim()
  } else {
    const safeS = systemPrompt.replace(/'/g, "'\\''")
    const safeU = userMessage.replace(/'/g, "'\\''")
    const mf = model ? `--model ${model} ` : ''
    const cmd = `claude ${mf}--system-prompt '${safeS}' -p '${safeU}'`
    const res = await execAsync(cmd, { timeout: 90000 })
    stdout = res.stdout.trim()
  }
  return stdout.trim()
}

export async function runAdjustmentEngine(proposalId: string, humanComment: string | null) {
  const ADJUST_ROUND = 20

  const [proposal] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "CouncilProposal" WHERE id = $1`, proposalId
  )
  if (!proposal) return

  const dbAgents = await prisma.$queryRawUnsafe<any[]>(
    `SELECT slug, id, "llmModel" FROM "Agent" WHERE slug IN ('orion','atlas','vesta','ares','iris')`
  )

  const debateVotes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "agentName", argument, vote, weight FROM "AgentVote" WHERE "proposalId" = $1 ORDER BY "createdAt"`, proposalId
  )
  const rejectReasons = (debateVotes as any[])
    .filter((v: any) => !v.vote)
    .map((v: any) => `  - ${v.agentName}: ${v.argument ?? ''}`)
    .join('\n')

  const allArguments = (debateVotes as any[])
    .map((v: any) => `  - ${v.agentName} (${v.vote ? 'VOTO A FAVOR' : 'RECHAZO'}): ${v.argument ?? ''}`)
    .join('\n')

  const humanCtx = humanComment ? `\n\nCOMENTARIO DEL USUARIO:\n${humanComment}` : ''

  const baseContext = `PROPUESTA RECHAZADA:
Titulo: ${proposal.title}
Descripcion: ${proposal.description ?? 'Sin descripcion'}
Items originales: ${JSON.stringify(proposal.items ?? [], null, 2)}

RAZONES DE RECHAZO:
${rejectReasons || '  (no disponible)'}

TODOS LOS ARGUMENTOS DEL DEBATE:
${allArguments || '  (no disponible)'}
${humanCtx}`

  // Clear previous adjustment messages
  await prisma.$executeRawUnsafe(
    `DELETE FROM "DebateMessage" WHERE "proposalId" = $1 AND round = ${ADJUST_ROUND}`, proposalId
  )

  const conversationHistory: string[] = []
  let finalAdjustment: any = null

  for (const agent of ADJUST_AGENTS) {
    const dbAgent = (dbAgents as any[]).find((a: any) => a.slug === agent.slug)
    const agentId = dbAgent?.id ?? `agent_${agent.slug}_001`
    const agentName = agent.slug.charAt(0).toUpperCase() + agent.slug.slice(1)
    const model = dbAgent?.llmModel ?? null

    const prevContext = conversationHistory.length > 0
      ? `\n\nDEBATE DE AJUSTES HASTA AHORA:\n${conversationHistory.join('\n\n')}`
      : ''

    let userMsg: string
    if (agent.slug === 'orion') {
      userMsg = `${baseContext}${prevContext}

Con todo lo anterior, define los ajustes definitivos. Formato JSON exacto:
{"needsMoreInfo":false,"questions":[],"adjustmentRationale":"por que estos ajustes resuelven el rechazo","titleAdjusted":null,"descriptionAdjusted":null,"keyChanges":[{"aspect":"que cambia","from":"estado actual","to":"propuesta de cambio","agentSupporting":"nombre agente","rationale":"por que"}],"agentConsensus":"resumen del consenso"}`
    } else {
      userMsg = `${baseContext}${prevContext}\n\n${agent.prompt}`
    }

    try {
      const response = await callLLM(agent.prompt, userMsg, model)

      if (agent.slug === 'orion') {
        const match = response.match(/\{[\s\S]*\}/)
        if (match) {
          try { finalAdjustment = JSON.parse(match[0]) } catch {}
        }
        const prose = response.replace(/\{[\s\S]*\}/, '').trim() || 'Ajustes sintetizados.'
        await prisma.$executeRawUnsafe(
          `INSERT INTO "DebateMessage" ("proposalId", "agentId", "agentName", "agentSlug", content, round)
           VALUES ($1, $2, $3, $4, $5, ${ADJUST_ROUND})`,
          proposalId, agentId, agentName + ' (Ajustes)', agent.slug,
          prose || 'Sintetizando ajustes...'
        )
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "DebateMessage" ("proposalId", "agentId", "agentName", "agentSlug", content, round)
           VALUES ($1, $2, $3, $4, $5, ${ADJUST_ROUND})`,
          proposalId, agentId, agentName + ' (Ajustes)', agent.slug, response
        )
        conversationHistory.push(`${agentName}: ${response}`)
      }
    } catch (err) {
      console.error(`[AdjustmentEngine] Error with ${agent.slug}:`, err)
    }
  }

  if (finalAdjustment?.needsMoreInfo && finalAdjustment.questions?.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "CouncilProposal"
       SET status = 'ADJUST_QUESTIONS',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           "updatedAt" = NOW()
       WHERE id = $1`,
      proposalId,
      JSON.stringify({ adjustmentQuestions: finalAdjustment.questions, adjustmentProposal: finalAdjustment })
    )
  } else if (finalAdjustment) {
    await prisma.$executeRawUnsafe(
      `UPDATE "CouncilProposal"
       SET status = 'ADJUST_READY',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           "updatedAt" = NOW()
       WHERE id = $1`,
      proposalId,
      JSON.stringify({ adjustmentProposal: finalAdjustment })
    )
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE "CouncilProposal"
       SET status = 'ADJUST_READY',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           "updatedAt" = NOW()
       WHERE id = $1`,
      proposalId,
      JSON.stringify({ adjustError: 'No se pudo generar ajustes — revisa los logs del servidor.' })
    )
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const humanComment: string | null = body.humanComment ?? null

  const [proposal] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, status FROM "CouncilProposal" WHERE id = $1`, id
  )
  if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  if (!['ADJUSTING', 'ADJUST_QUESTIONS', 'ADJUST_READY'].includes(proposal.status)) {
    return NextResponse.json({ error: `Estado invalido: ${proposal.status}` }, { status: 400 })
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "CouncilProposal" SET status = 'ADJUSTING', "updatedAt" = NOW() WHERE id = $1`, id
  )

  runAdjustmentEngine(id, humanComment).catch(err => console.error('[Adjust/start] Fatal:', err))

  return NextResponse.json({ started: true, status: 'ADJUSTING', proposalId: id })
}
