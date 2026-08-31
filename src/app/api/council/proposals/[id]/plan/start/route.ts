import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const OPENCODE_GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_URL    = 'https://opencode.ai/zen/v1/chat/completions'
const OPENCODE_KEY    = process.env.OPENCODE_API_KEY ?? ''
const OPENCODE_FALLBACK_MODEL = process.env.OPENCODE_EXECUTOR_MODEL ?? 'qwen3.7-max'

// Algunos modelos razonadores devuelven su cadena de pensamiento inline
// dentro de "content" entre <think>...</think> en vez de un canal aparte
// (visto en vivo en el motor MASD — ver masd_worker.py). Se limpia antes
// de guardar cualquier mensaje del debate o el JSON del plan.
function stripReasoningTags(text: string): string {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const dangling = cleaned.toLowerCase().indexOf('<think>')
  return (dangling !== -1 ? cleaned.slice(0, dangling) : cleaned).trim()
}

const PLANNING_AGENTS = [
  {
    slug: 'atlas',
    role: 'operativo',
    prompt: `Eres Atlas, Operations Manager de ArchiTechIA.
Analiza la propuesta aprobada y define el alcance operativo:
- Cuantos sprints necesita y de cuanto tiempo
- Que areas del equipo deben involucrarse y por que
- Que dependencias tecnicas existen
- Riesgos operativos y como mitigarlos
Sé concreto. Propone nombres de sprints y areas responsables.
Responde en prosa, 3-5 oraciones.`,
  },
  {
    slug: 'vesta',
    role: 'financiero',
    prompt: `Eres Vesta, Finance & Legal Lead de ArchiTechIA.
Analiza el plan operativo propuesto y evalua:
- Distribucion de esfuerzo por area (alta/media/baja)
- Si el alcance es financieramente razonable
- Que tasks tienen mayor ROI y cuales son nice-to-have
- Prioridades desde la perspectiva de costo-beneficio
Ajusta o valida lo propuesto por Atlas. Responde en prosa, 3-4 oraciones.`,
  },
  {
    slug: 'ares',
    role: 'comercial',
    prompt: `Eres Ares, Sales Lead de ArchiTechIA.
Define el angulo comercial del plan:
- Que sprint o entregable genera valor visible para el cliente primero
- Como se conecta esto con el pipeline actual
- Que tasks de demos, presales o comunicacion comercial son necesarias
- Propone tasks especificas con el area Sales & Presales
Responde en prosa, 3-4 oraciones.`,
  },
  {
    slug: 'iris',
    role: 'marketing',
    prompt: `Eres Iris, Marketing & Brand Lead de ArchiTechIA.
Define el angulo de comunicacion del plan:
- Como se comunica el lanzamiento de esta iniciativa (interno y externo)
- Que tasks de marketing o documentacion son necesarias
- En que sprint deberia incluirse el componente de comunicacion
- Propone tasks concretas con el area Marketing & Brand
Responde en prosa, 3-4 oraciones.`,
  },
  {
    slug: 'orion',
    role: 'estrategico',
    prompt: `Eres Orion, CEO operacional de ArchiTechIA.
Con los inputs de Atlas (operativo), Vesta (financiero), Ares (comercial) e Iris (marketing),
sintetiza el plan de ejecucion definitivo como JSON.
CRITICO: cada task DEBE tener areaSlug. Si el area no existe, proponla con prefix "new:".
CRITICO: cada task DEBE tener un "localId" corto y unico dentro del plan (ej. "s1-t1").
Si una task necesita el trabajo de OTRA task para poder arrancar (ej. "construir el
formulario" necesita que "crear el modelo en la base de datos" ya este hecho), marcala
con "dependsOnLocalId" apuntando al localId de esa otra task — SOLO puede apuntar a una
task que ya aparecio antes en el plan, nunca a una futura. Si no depende de nada, null.
No inventes dependencias que no sean reales — la mayoria de las tasks no dependen de nada.
Responde EXCLUSIVAMENTE con JSON valido sin markdown ni texto extra.`,
  },
]

/**
 * Llama a OpenCode GO por HTTP directo — nunca por CLI/exec(). Este archivo
 * corria antes via exec('claude --system-prompt ... -p ...') / exec('opencode
 * run ...'), el mismo patron fragil (shell + escaping manual de comillas,
 * vulnerable a inyeccion si el contenido tiene comillas simples sin escapar
 * bien) que causo el problema original de gasto de tokens migrado en el
 * resto del motor (taskDispatcher.ts/taskVerifier.ts/sprintMonitor.ts).
 */
async function callLLM(systemPrompt: string, userMessage: string, model?: string | null): Promise<string> {
  let apiUrl = OPENCODE_GO_URL
  let modelId = OPENCODE_FALLBACK_MODEL
  if (model?.startsWith('opencode-go/')) {
    modelId = model.slice('opencode-go/'.length)
  } else if (model?.startsWith('opencode/')) {
    apiUrl = OPENCODE_URL
    modelId = model.slice('opencode/'.length)
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENCODE_KEY}` },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    throw new Error(`OpenCode API error ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  return stripReasoningTags(content)
}

export async function runPlanningEngine(proposalId: string, humanComment: string | null) {
  const PLANNING_ROUND = 10

  const [proposal] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "CouncilProposal" WHERE id = $1`, proposalId
  )
  if (!proposal) return

  // Load DB agent configs (model overrides)
  const dbAgents = await prisma.$queryRawUnsafe<any[]>(
    `SELECT slug, id, "systemPrompt", "llmModel" FROM "Agent" WHERE slug IN ('orion','atlas','vesta','ares','iris')`
  )

  const solutions = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, nombre, descripcion FROM "Solucion" ORDER BY "createdAt" DESC LIMIT 15`
  )
  const areas = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, slug FROM "Area" ORDER BY name LIMIT 30`
  )
  const agents = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, slug FROM "Agent" WHERE status = 'ACTIVE' LIMIT 20`
  )

  const solutionsList = (solutions as any[]).length
    ? (solutions as any[]).map((s: any) => `  - ID:"${s.id}" Nombre:"${s.nombre}"${s.descripcion ? ' - ' + s.descripcion : ''}`).join('\n')
    : '  (ninguna aun)'
  const areasList = (areas as any[]).length
    ? (areas as any[]).map((a: any) => `  - slug:"${a.slug}" Nombre:"${a.name}"`).join('\n')
    : '  (ninguna - proponer con "new:nombre")'
  const agentsList = (agents as any[]).length
    ? (agents as any[]).map((a: any) => `  - slug:"${a.slug}" Nombre:"${a.name}"`).join('\n')
    : '  (ninguno)'

  const debateVotes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "agentName", argument, vote FROM "AgentVote" WHERE "proposalId" = $1 ORDER BY "createdAt"`, proposalId
  )
  const voteSummary = (debateVotes as any[]).map((v: any) =>
    `  ${v.agentName} (${v.vote ? 'APROBO' : 'RECHAZO'}): ${v.argument ?? ''}`
  ).join('\n')

  const humanCtx = humanComment ? `\n\nCOMENTARIO DEL USUARIO:\n${humanComment}` : ''
  const existingPlan = proposal.metadata?.councilPlan
    ? `\n\nPLAN PREVIO (refinar con el comentario del usuario):\n${JSON.stringify(proposal.metadata.councilPlan, null, 2)}`
    : ''
  const fixedSolucion = proposal.solucionId
    ? `\n\nSOLUCION YA DECIDIDA (fijada por un humano al extraer la propuesta, NO la cambies): solucionId = "${proposal.solucionId}"`
    : ''

  const baseContext = `PROPUESTA APROBADA:
Titulo: ${proposal.title}
Descripcion: ${proposal.description ?? 'Sin descripcion'}

DEBATE DE VOTACION (por que fue aprobada):
${voteSummary || '  (no disponible)'}
${humanCtx}
${existingPlan}
${fixedSolucion}

SOLUCIONES EXISTENTES:
${solutionsList}

AREAS DISPONIBLES (usar estos slugs en las tasks):
${areasList}

AGENTES DISPONIBLES:
${agentsList}`

  // Delete previous planning messages for this proposal (round=10)
  await prisma.$executeRawUnsafe(
    `DELETE FROM "DebateMessage" WHERE "proposalId" = $1 AND round = ${PLANNING_ROUND}`, proposalId
  )

  const conversationHistory: string[] = []
  let finalPlan: any = null

  for (const agent of PLANNING_AGENTS) {
    const dbAgent = (dbAgents as any[]).find((a: any) => a.slug === agent.slug)
    const agentId = dbAgent?.id ?? `agent_${agent.slug}_001`
    const agentName = agent.slug.charAt(0).toUpperCase() + agent.slug.slice(1)
    const model = dbAgent?.llmModel ?? null

    const prevContext = conversationHistory.length > 0
      ? `\n\nDEBATE DE PLANIFICACION HASTA AHORA:\n${conversationHistory.join('\n\n')}`
      : ''

    let userMsg: string
    if (agent.slug === 'orion') {
      userMsg = `${baseContext}${prevContext}

Con todo lo anterior, genera el JSON del plan de ejecucion definitivo.
Incluye: solucionId (o solucionPropuesta), epic, sprints con tasks.
Cada task DEBE tener areaSlug. Puedes proponer areas con "new:nombre-area".

Formato JSON exacto:
{"needsMoreInfo":false,"questions":[],"planRationale":"resumen del plan","solucionId":null,"solucionPropuesta":null,"epic":{"name":"...","description":"...","estimatedWeeks":4},"sprints":[{"name":"Sprint 1 - ...","goal":"...","areaSlug":"...","estimatedWeeks":2,"tasks":[{"localId":"s1-t1","dependsOnLocalId":null,"title":"...","description":"...","areaSlug":"...","agentSlug":null,"priority":"HIGH","estimatedHours":8,"rationaleArea":"por que esta area"}]}]}`
    } else {
      userMsg = `${baseContext}${prevContext}

${agent.prompt}

Enfocate en tu area de expertise. Sé especifico con nombres de areas y tasks.`
    }

    try {
      const response = await callLLM(agent.prompt, userMsg, model)

      if (agent.slug === 'orion') {
        // Try to parse JSON plan from Orion's response
        const match = response.match(/\{[\s\S]*\}/)
        if (match) {
          try {
            finalPlan = JSON.parse(match[0])
            // Si la propuesta ya trae una Solucion decidida (elegida por el
            // humano en el panel de "Propuesta Extraida", antes de mandarla
            // al Consejo), esa decision manda siempre — Orion no la vuelve a
            // adivinar en esta sintesis final. Sin esto, alguien podia elegir
            // una Solucion en la extraccion y terminar con la tarea en otra
            // distinta, decidida por el LLM sin que nadie lo viera venir.
            if (finalPlan && proposal.solucionId) {
              finalPlan.solucionId = proposal.solucionId
              finalPlan.solucionPropuesta = null
            }
          } catch {}
        }

        // Store Orion's synthesis message (prose version without the raw JSON)
        const prose = response.replace(/\{[\s\S]*\}/, '').trim() || 'Plan sintetizado y definido.'
        await prisma.$executeRawUnsafe(
          `INSERT INTO "DebateMessage" ("proposalId", "agentId", "agentName", "agentSlug", content, round)
           VALUES ($1, $2, $3, $4, $5, ${PLANNING_ROUND})`,
          proposalId, agentId, agentName + ' (Planificacion)', agent.slug,
          prose || 'Sintetizando plan de ejecucion...'
        )
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "DebateMessage" ("proposalId", "agentId", "agentName", "agentSlug", content, round)
           VALUES ($1, $2, $3, $4, $5, ${PLANNING_ROUND})`,
          proposalId, agentId, agentName + ' (Planificacion)', agent.slug, response
        )
        conversationHistory.push(`${agentName}: ${response}`)
      }
    } catch (err) {
      console.error(`[PlanningEngine] Error with ${agent.slug}:`, err)
    }
  }

  if (finalPlan && finalPlan.needsMoreInfo && finalPlan.questions?.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "CouncilProposal"
       SET status = 'PLAN_QUESTIONS',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           "updatedAt" = NOW()
       WHERE id = $1`,
      proposalId,
      JSON.stringify({ councilQuestions: finalPlan.questions, councilPlanDraft: finalPlan })
    )
  } else if (finalPlan) {
    await prisma.$executeRawUnsafe(
      `UPDATE "CouncilProposal"
       SET status = 'PLAN_READY',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           "updatedAt" = NOW()
       WHERE id = $1`,
      proposalId,
      JSON.stringify({ councilPlan: finalPlan })
    )
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE "CouncilProposal"
       SET status = 'PLAN_READY',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           "updatedAt" = NOW()
       WHERE id = $1`,
      proposalId,
      JSON.stringify({ planError: 'No se pudo generar plan estructurado — revisa los logs del servidor.' })
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
  if (!['APPROVED', 'PLANNING', 'PLAN_QUESTIONS', 'PLAN_READY', 'ADJUST_READY'].includes(proposal.status)) {
    return NextResponse.json({ error: `Estado invalido: ${proposal.status}` }, { status: 400 })
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "CouncilProposal" SET status = 'PLANNING', "updatedAt" = NOW() WHERE id = $1`, id
  )

  runPlanningEngine(id, humanComment).catch(err => console.error('[Plan/start] Fatal:', err))

  return NextResponse.json({ started: true, status: 'PLANNING', proposalId: id })
}
