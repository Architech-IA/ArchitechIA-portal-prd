import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const OPENCODE_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_KEY = process.env.OPENCODE_API_KEY ?? ''
const MAX_HISTORY  = 20  // 10 turns
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

// ── Non-streaming (WhatsApp, internal calls) ───────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { message, channelType = 'portal', channelId = 'anonymous', stream = false } = body

  if (!message?.trim()) return NextResponse.json({ error: 'message requerido' }, { status: 400 })

  const { systemPrompt, model } = await getAgentConfig()
  const modelId = model.startsWith('opencode-go/') ? model.replace('opencode-go/', '') : model

  const history = await loadHistory('orion', channelType, channelId)
  history.push({ role: 'user', content: message.trim() })

  const messages = [{ role: 'system', content: systemPrompt }, ...history]

  if (stream) {
    // SSE streaming for Hub/Agents
    const upstream = await fetch(OPENCODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENCODE_KEY}` },
      body: JSON.stringify({ model: modelId, messages, max_tokens: 1024, stream: true }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!upstream.ok) {
      return NextResponse.json({ error: await upstream.text() }, { status: upstream.status })
    }

    // Collect full reply while streaming to save later
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
            // Extract text from SSE chunks
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
          // Save history after stream ends
          if (fullReply) {
            history.push({ role: 'assistant', content: fullReply })
            saveHistory('orion', channelType, channelId, history).catch(console.error)
          }
        }
      }
    })

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  // Non-streaming
  const res = await fetch(OPENCODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENCODE_KEY}` },
    body: JSON.stringify({ model: modelId, messages, max_tokens: 1024 }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })

  const data = await res.json()
  const reply = data.choices?.[0]?.message?.content?.trim() ?? ''

  if (reply) {
    history.push({ role: 'assistant', content: reply })
    await saveHistory('orion', channelType, channelId, history)
  }

  return NextResponse.json({ reply })
}
