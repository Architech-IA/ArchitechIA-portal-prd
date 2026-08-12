import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const OPENCODE_GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_URL    = 'https://opencode.ai/zen/v1/chat/completions'
const OPENCODE_KEY    = process.env.OPENCODE_API_KEY ?? ''

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { slug } = await params
  const body = await req.json().catch(() => ({}))
  const { message, history = [] } = body
  if (!message?.trim()) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })

  const agent = await prisma.agent.findUnique({ where: { slug } })
  if (!agent) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })

  const systemPrompt = agent.systemPrompt
    ?? `Eres ${agent.name}, agente de ArchiTechIA. Rol: ${agent.role}. Área: ${agent.area ?? 'General'}.`

  const model     = agent.llmModel ?? 'opencode-go/qwen3.8-max'
  const isGoModel = model.startsWith('opencode-go/')
  const isOcModel = model.startsWith('opencode/')

  // Build messages array with full history
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...(history as { role: string; content: string }[]).slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  if (isGoModel || isOcModel) {
    // OpenCode GO / OpenCode HTTP API
    const apiUrl   = isGoModel ? OPENCODE_GO_URL : OPENCODE_URL
    const modelId  = model.split('/').pop()!

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENCODE_KEY}`,
        },
        body: JSON.stringify({ model: modelId, messages, max_tokens: 2048 }),
        signal: AbortSignal.timeout(90_000),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('[AgentChat] OpenCode API error', res.status, err.slice(0, 200))
        return NextResponse.json({ error: `Error API (${res.status})` }, { status: 500 })
      }
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content ?? 'Sin respuesta'
      return NextResponse.json({ reply })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[AgentChat] OpenCode fetch error', msg.slice(0, 200))
      return NextResponse.json({ error: 'Error de conexión con OpenCode.' }, { status: 500 })
    }
  }

  // Claude CLI for claude/* models
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)

  const sq  = "'"
  const esc = sq + "\\'" + sq
  const safe = (s: string) => s.split(sq).join(esc)

  // Build history for Claude CLI (prepend to user message)
  const historyLines = (history as { role: string; content: string }[])
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'Usuario' : agent.name}: ${m.content}`)
    .join('\n')
  const fullMessage = historyLines ? `${historyLines}\nUsuario: ${message}` : message

  const modelFlag = model ? `--model ${model} ` : ''
  const cmd = `claude ${modelFlag}--system-prompt '${safe(systemPrompt)}' -p '${safe(fullMessage)}'`

  try {
    const res = await execAsync(cmd, { timeout: 60000 })
    return NextResponse.json({ reply: res.stdout.trim() })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[AgentChat] Claude CLI error', msg.slice(0, 200))
    return NextResponse.json({ error: 'Error al llamar al agente.' }, { status: 500 })
  }
}
