import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const OPENCODE_URL  = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_KEY  = process.env.OPENCODE_API_KEY ?? ''
const MAX_HISTORY   = 20
const DEFAULT_MODEL = 'opencode-go/kimi-k2.5'

const DEFAULT_SYSTEM = `Eres Orión, CEO y orquestador de ArchiTechIA. Coordinas, sintetizas y alineas. No tomas partido — buscas consenso, resumes posiciones y defines próximos pasos claros. Siempre respondés en el idioma del usuario.`

type Message = { role: 'user' | 'assistant'; content: string }

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

async function callClaude(model: string, systemPrompt: string, history: Message[]): Promise<string> {
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)

  const sq  = "'"
  const esc = sq + "\\'" + sq
  const safe = (s: string) => s.split(sq).join(esc)

  const historyLines = history
    .slice(0, -1)
    .slice(-10)
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Orion'}: ${m.content}`)
    .join('\n')
  const lastMsg = history[history.length - 1].content
  const fullMsg = historyLines ? `${historyLines}\nUsuario: ${lastMsg}` : lastMsg

  const cmd = `claude --model ${model} --system-prompt '${safe(systemPrompt)}' -p '${safe(fullMsg)}'`
  const result = await execAsync(cmd, { timeout: 90_000 })
  return result.stdout.trim()
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { message, channelType = 'portal', channelId = 'anonymous', stream = false } = body

  if (!message?.trim()) return NextResponse.json({ error: 'message requerido' }, { status: 400 })

  const { systemPrompt, model } = await getAgentConfig()
  const isOpenCode = model.startsWith('opencode-go/') || model.startsWith('opencode/')
  const isClaude   = model.startsWith('claude')

  const history = await loadHistory('orion', channelType, channelId)
  history.push({ role: 'user', content: message.trim() })

  try {
    // ── OpenCode GO streaming (Hub) ──────────────────────────────────
    if (stream && isOpenCode) {
      const modelId = model.split('/').pop()!
      const upstream = await fetch(OPENCODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENCODE_KEY}` },
        body: JSON.stringify({ model: modelId, messages: [{ role: 'system', content: systemPrompt }, ...history], max_tokens: 1024, stream: true }),
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

    // ── Non-streaming (WhatsApp, Oficina) o Claude cualquier canal ───
    let reply = ''

    if (isOpenCode) {
      const modelId = model.split('/').pop()!
      const res = await fetch(OPENCODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENCODE_KEY}` },
        body: JSON.stringify({ model: modelId, messages: [{ role: 'system', content: systemPrompt }, ...history], max_tokens: 1024 }),
        signal: AbortSignal.timeout(30_000),
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

    // Para Claude con stream=true desde Hub: envuelve en SSE simulado
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

    return NextResponse.json({ reply })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Orion] LLM error', msg.slice(0, 300))
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const channelType = searchParams.get('channelType') ?? 'hub'
  const channelId   = searchParams.get('channelId') ?? 'anonymous'
  const conv = await prisma.agentConversation.findUnique({
    where: { agentSlug_channelType_channelId: { agentSlug: 'orion', channelType, channelId } },
    select: { messages: true, updatedAt: true },
  })
  return NextResponse.json({ messages: conv?.messages ?? [], updatedAt: conv?.updatedAt ?? null })
}
