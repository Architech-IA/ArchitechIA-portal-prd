import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseUTC5 } from '@/lib/timezone'

const OPENCODE_URL  = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_KEY  = process.env.OPENCODE_API_KEY ?? ''
const MAX_HISTORY   = 20
const DEFAULT_MODEL = 'opencode-go/kimi-k2.5'

const DEFAULT_SYSTEM = `Eres Orión, CEO y orquestador de ArchiTechIA. Coordinas, sintetizas y alineas. No tomas partido — buscas consenso, resumes posiciones y defines próximos pasos claros. Siempre respondés en el idioma del usuario.

IMPORTANTE: Respondés SOLO en texto. No tenés acceso a herramientas, bash, ni bases de datos. Toda la información que necesitás para responder ya está en el contexto del sistema — no intentés ejecutar código ni consultas. Si el usuario pide leer un lead y el contexto ya está en el sistema, úsalo directamente.`

type Message = { role: 'user' | 'assistant'; content: string }

// ── Lead context skill ────────────────────────────────────────────────────────

const LEAD_TRIGGERS = /\b(lee|leé|leer|revisa|revisar|analiza|analizar|contextualiza|contextualizar|valida|validar|resume|resumir|hub|lead)\b/i

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractCompanyName(message: string): string | null {
  // Quoted name: "Previsora" or 'Previsora'
  const quoted = message.match(/["']([^"']{3,60})["']/)
  if (quoted) return quoted[1].trim()

  // "lead de X" / "hub de X" / "el lead X"
  const pattern = message.match(/\b(?:lead|hub|empresa|cliente)\s+(?:de\s+|del\s+)?([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ\s&\.]{2,50})/i)
  if (pattern) return pattern[1].trim()

  // Trigger word + subsequent capitalized words
  const triggerMatch = message.match(/(?:lee|revisa|analiza|contextualiza|valida|resume)\s+(?:el\s+lead\s+(?:de\s+)?)?([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ\s&\.]{2,50})/i)
  if (triggerMatch) return triggerMatch[1].trim()

  return null
}

async function fetchLeadContext(companyName: string): Promise<string | null> {
  // Search by each word so "Previsora Seguros" finds "Seguros La Previsora"
  const words = companyName.split(/\s+/).filter(w => w.length > 3)
  const searchConditions = words.length > 0
    ? words.map(w => ({ companyName: { contains: w, mode: 'insensitive' as const } }))
    : [{ companyName: { contains: companyName, mode: 'insensitive' as const } }]

  const leadCandidates = await prisma.lead.findMany({
    where: { OR: searchConditions },
    take: 5,
    select: { id: true, companyName: true },
  })

  // Pick the lead whose name matches the most words
  const scored = leadCandidates.map(l => ({
    id: l.id,
    score: words.filter(w => l.companyName.toLowerCase().includes(w.toLowerCase())).length,
  })).sort((a, b) => b.score - a.score)

  if (!scored.length) return null

  const leads = await prisma.lead.findMany({
    where: { id: scored[0].id },
    take: 1,
    include: {
      proposals: { orderBy: { createdAt: 'desc' }, take: 1 },
      activities: {
        where: { type: { in: ['CALL', 'EMAIL', 'MEETING', 'WHATSAPP'] } },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          user: { select: { name: true } },
          meeting: { select: { title: true, type: true, status: true, date: true, location: true, link: true } },
        },
      },
      solucion: {
        include: {
          backlogItems: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { sprint: { select: { name: true, sprintCode: true } } },
          },
        },
      },
    },
  })

  if (!leads.length) return null
  const lead = leads[0]

  // Hub phases
  const hubPhases = await prisma.leadHub.findMany({
    where: { leadId: lead.id },
    include: { files: { select: { name: true, size: true, uploadedBy: true } } },
  })

  const STATUS_LABELS: Record<string, string> = {
    NEW: 'Nuevo', CONTACTED: 'Contactado', QUALIFIED: 'Calificado',
    PROPOSAL_SENT: 'Propuesta enviada', NEGOTIATION: 'Negociación',
    WON: 'Ganado', LOST: 'Perdido',
  }

  const INT_LABELS: Record<string, string> = { CALL: 'Llamada', EMAIL: 'Email', MEETING: 'Reunión', WHATSAPP: 'WhatsApp' }
  const MEET_STATUS: Record<string, string> = { SCHEDULED: 'Programada', COMPLETED: 'Completada', CANCELLED: 'Cancelada' }

  const lines: string[] = []
  lines.push(`━━━ CONTEXTO DEL LEAD: ${lead.companyName.toUpperCase()} ━━━`)
  lines.push(`Empresa: ${lead.companyName}`)
  lines.push(`Contacto: ${lead.contactName} | ${lead.email}${lead.phone ? ' | ' + lead.phone : ''}`)
  lines.push(`Estado: ${STATUS_LABELS[lead.status] ?? lead.status}`)
  lines.push(`Valor estimado: $${lead.estimatedValue.toLocaleString('es-CO')}`)
  lines.push(`Origen: ${lead.source}`)
  if (lead.scope) lines.push(`Alcance: ${lead.scope}`)
  if (lead.notes) lines.push(`Notas generales: ${lead.notes}`)
  lines.push('')

  // Hub phases
  const PHASE_LABELS: Record<string, string> = {
    identificacion: 'Identificación', contacto: 'Contacto', diagnostico: 'Diagnóstico',
    demo: 'Demo', propuesta: 'Propuesta', negociacion: 'Negociación', resultado: 'Resultado',
  }
  const PHASES_ORDER = ['identificacion', 'contacto', 'diagnostico', 'demo', 'propuesta', 'negociacion', 'resultado']

  lines.push('📋 FASES DEL HUB:')
  for (const phaseKey of PHASES_ORDER) {
    const hub = hubPhases.find(h => h.phase === phaseKey)
    const label = PHASE_LABELS[phaseKey] ?? phaseKey
    if (!hub || !hub.content) {
      lines.push(`  [${label}] Sin contenido`)
    } else {
      const text = stripHtml(hub.content)
      lines.push(`  [${label}]:`)
      text.split('\n').filter(Boolean).forEach(l => lines.push(`    ${l}`))
      if (hub.files.length > 0) {
        lines.push(`    Archivos adjuntos: ${hub.files.map(f => f.name).join(', ')}`)
      }
    }
  }
  lines.push('')

  // Interactions
  if (lead.activities.length > 0) {
    lines.push('🗣️ INTERACCIONES (más recientes):')
    for (const act of lead.activities) {
      const date = new Date(act.date ?? act.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
      if (act.meeting) {
        lines.push(`  • REUNIÓN VINCULADA | ${date} | ${act.user?.name ?? 'Sistema'}`)
        lines.push(`    Título: ${act.meeting.title} | ${MEET_STATUS[act.meeting.status] ?? act.meeting.status}`)
        if (act.meeting.location) lines.push(`    Lugar: ${act.meeting.location}`)
      } else {
        lines.push(`  • ${INT_LABELS[act.type] ?? act.type} | ${date} | ${act.user?.name ?? 'Sistema'}: ${act.description}`)
      }
    }
    lines.push('')
  }

  // Proposal
  if (lead.proposals.length > 0) {
    const p = lead.proposals[0]
    const PROP_STATUS: Record<string, string> = { DRAFT: 'Borrador', SENT: 'Enviada', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada' }
    lines.push('📄 PROPUESTA:')
    lines.push(`  Título: ${p.title}`)
    lines.push(`  Estado: ${PROP_STATUS[p.status] ?? p.status} | Monto: $${p.amount.toLocaleString('es-CO')}`)
    if (p.description) lines.push(`  Descripción: ${p.description.slice(0, 300)}`)
    lines.push('')
  }

  // Backlog / solution
  if (lead.solucion?.backlogItems.length) {
    const items = lead.solucion.backlogItems
    const STATUS_ITEM: Record<string, string> = { TODO: 'Por hacer', IN_PROGRESS: 'En progreso', DONE: 'Hecho', BACKLOG: 'Backlog' }
    lines.push(`🗂️ SOLUCIÓN ASOCIADA: ${lead.solucion.nombre}`)
    lines.push(`  Backlog items (${items.length}):`)
    for (const item of items.slice(0, 15)) {
      lines.push(`    - [${STATUS_ITEM[item.status] ?? item.status}] ${item.title}${item.sprint ? ' (' + item.sprint.name + ')' : ''}`)
    }
    lines.push('')
  }

  lines.push('━━━ FIN CONTEXTO DEL LEAD ━━━')
  return lines.join('\n')
}

// ── Conversation persistence ──────────────────────────────────────────────────

async function loadHistory(agentSlug: string, channelType: string, channelId: string): Promise<Message[]> {
  const conv = await prisma.agentConversation.findUnique({
    where: { agentSlug_channelType_channelId: { agentSlug, channelType, channelId } },
  })
  return (conv?.messages as Message[] | null) ?? []
}

async function saveHistory(agentSlug: string, channelType: string, channelId: string, messages: Message[]) {
  const trimmed = messages.slice(-MAX_HISTORY)
  await prisma.agentConversation.upsert({
    where: { agentSlug_channelType_channelId: { agentSlug, channelType, channelId } },
    create: { agentSlug, channelType, channelId, messages: trimmed as any },
    update: { messages: trimmed as any, updatedAt: new Date() },
  })
}

async function getAgentConfig(): Promise<{ systemPrompt: string; model: string }> {
  const agent = await prisma.agent.findUnique({
    where: { slug: 'orion' },
    select: { systemPrompt: true, llmModel: true },
  })
  return {
    systemPrompt: agent?.systemPrompt ?? DEFAULT_SYSTEM,
    model: agent?.llmModel ?? DEFAULT_MODEL,
  }
}

// ── LLM callers ───────────────────────────────────────────────────────────────

async function callClaude(model: string, systemPrompt: string, history: Message[]): Promise<string> {
  const { spawn } = await import('child_process')

  const historyLines = history
    .slice(0, -1)
    .slice(-10)
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Orion'}: ${m.content}`)
    .join('\n')
  const lastMsg = history[history.length - 1].content
  const fullMsg = historyLines ? `${historyLines}\nUsuario: ${lastMsg}` : lastMsg

  return new Promise((resolve, reject) => {
    const child = spawn('claude', [
      '--model', model,
      '--system-prompt', systemPrompt,
      '--tools', '',
      '-p', fullMsg,
    ], { timeout: 90_000 })

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

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { message, channelType = 'portal', channelId = 'anonymous', stream = false } = body

  if (!message?.trim()) return NextResponse.json({ error: 'message requerido' }, { status: 400 })

  const { systemPrompt: baseSystemPrompt, model } = await getAgentConfig()
  const isOpenCode = model.startsWith('opencode-go/') || model.startsWith('opencode/')
  const isClaude   = model.startsWith('claude')

  // ── Lead skill: detect intent and inject context ──
  let systemPrompt = baseSystemPrompt
  let leadContextNote = ''

  if (LEAD_TRIGGERS.test(message)) {
    const companyName = extractCompanyName(message)
    if (companyName) {
      try {
        const context = await fetchLeadContext(companyName)
        if (context) {
          systemPrompt = `${baseSystemPrompt}\n\nEl usuario te ha pedido que analices un lead. A continuación está toda la información disponible del lead en el sistema. Úsala para responder con precisión y profundidad.\n\n${context}`
          leadContextNote = companyName
        }
      } catch (e) {
        console.error('[Orion] Lead context fetch error:', e)
      }
    }
  }

  const history = await loadHistory('orion', channelType, channelId)
  history.push({ role: 'user', content: message.trim() })

  try {
    if (stream && isOpenCode) {
      const modelId = model.split('/').pop()!
      const upstream = await fetch(OPENCODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENCODE_KEY}` },
        body: JSON.stringify({ model: modelId, messages: [{ role: 'system', content: systemPrompt }, ...history], max_tokens: 2048, stream: true }),
        signal: AbortSignal.timeout(60_000),
      })
      if (!upstream.ok) return NextResponse.json({ error: await upstream.text() }, { status: upstream.status })

      let fullReply = ''
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          const reader = upstream.body!.getReader()
          const decoder = new TextDecoder()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const chunk = decoder.decode(value)
              controller.enqueue(encoder.encode(chunk))
              for (const line of chunk.split('\n')) {
                if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
                try {
                  const delta = JSON.parse(line.slice(6))?.choices?.[0]?.delta?.content
                  if (delta) fullReply += delta
                } catch {}
              }
            }
          } finally {
            reader.releaseLock()
            controller.close()
            if (fullReply) {
              history.push({ role: 'assistant', content: fullReply })
              saveHistory('orion', channelType, channelId, history).catch(console.error)
            }
          }
        }
      })
      return new NextResponse(readable, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      })
    }

    let reply = ''

    if (isOpenCode) {
      const modelId = model.split('/').pop()!
      const res = await fetch(OPENCODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENCODE_KEY}` },
        body: JSON.stringify({ model: modelId, messages: [{ role: 'system', content: systemPrompt }, ...history], max_tokens: 2048 }),
        signal: AbortSignal.timeout(60_000),
      })
      if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
      const data = await res.json()
      reply = data.choices?.[0]?.message?.content?.trim() ?? ''
    } else if (isClaude) {
      reply = await callClaude(model, systemPrompt, history)
    } else {
      return NextResponse.json({ error: `Modelo no soportado: ${model}` }, { status: 400 })
    }

    if (reply) {
      history.push({ role: 'assistant', content: reply })
      await saveHistory('orion', channelType, channelId, history)
    }

    if (stream && isClaude) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        start(controller) {
          const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\ndata: [DONE]\n\n`
          controller.enqueue(encoder.encode(chunk))
          controller.close()
        }
      })
      return new NextResponse(readable, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      })
    }

    return NextResponse.json({ reply, leadContextLoaded: leadContextNote || undefined })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Orion] LLM error', msg.slice(0, 300))
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── GET — past sessions ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { getToken } = await import('next-auth/jwt')
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const userId = (token?.sub ?? token?.id ?? 'anonymous') as string

  const conv = await prisma.agentConversation.findFirst({
    where: { agentSlug: 'orion', channelType: 'hub', channelId: userId },
    select: { sessions: true, messages: true },
  })
  return NextResponse.json({
    sessions: (conv?.sessions as any[]) ?? [],
    messages: (conv?.messages as any[]) ?? [],
  })
}

// ── DELETE — close session ────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { getToken } = await import('next-auth/jwt')
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const userId = (token?.sub ?? token?.id ?? 'anonymous') as string

  const conv = await prisma.agentConversation.findFirst({
    where: { agentSlug: 'orion', channelType: 'hub', channelId: userId },
  })

  const currentMsgs = (conv?.messages as Message[]) ?? []
  if (currentMsgs.length === 0) {
    return NextResponse.json({ ok: true, sessions: (conv?.sessions as any[]) ?? [] })
  }

  const firstUserMsg = currentMsgs.find(m => m.role === 'user')?.content ?? ''
  const newSession = {
    id: Date.now().toString(),
    startedAt: conv?.createdAt ?? new Date(),
    endedAt: new Date(),
    preview: firstUserMsg.slice(0, 80),
    messages: currentMsgs,
  }

  const existingSessions = (conv?.sessions as any[]) ?? []
  const updatedSessions = [...existingSessions, newSession].slice(-20)

  await prisma.agentConversation.upsert({
    where: { agentSlug_channelType_channelId: { agentSlug: 'orion', channelType: 'hub', channelId: userId } },
    create: { agentSlug: 'orion', channelType: 'hub', channelId: userId, messages: [], sessions: updatedSessions as any },
    update: { messages: [], sessions: updatedSessions as any, updatedAt: new Date() },
  })

  return NextResponse.json({ ok: true, sessions: updatedSessions })
}
