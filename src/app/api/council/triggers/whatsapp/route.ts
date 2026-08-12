import { NextRequest, NextResponse } from 'next/server'

const OPENCODE_URL  = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_KEY  = process.env.OPENCODE_API_KEY ?? ''
const MODEL         = 'kimi-k2.5'
const EVOLUTION_URL = 'http://localhost:8080'
const EVOLUTION_KEY = 'evo-scheduling-2026'
const INSTANCE      = 'orion'

const SYSTEM_PROMPT = `You are Orion, orchestrator of the ArchiTechIA council. Analytical, methodical and impartial. Your role: receive tasks, decide the best pattern (Solo/Debate/Pipeline), delegate to specialist agents, and synthesize results. You never take sides. Be concise and decisive. Always respond in the same language the user writes in.`

// In-memory conversation history per phone (last 10 messages)
const sessions = new Map<string, { role: 'user' | 'assistant'; content: string }[]>()
const MAX_HISTORY = 10

async function handleMessage(remoteJid: string, text: string) {
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/^\+/, '')
  console.log(`[WhatsApp→Orión] from=${phone} msg="${text.slice(0, 80)}"`)

  const history = sessions.get(phone) ?? []
  history.push({ role: 'user', content: text })
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY)
  sessions.set(phone, history)

  let reply: string
  try {
    const res = await fetch(OPENCODE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCODE_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history,
        ],
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      console.error('[WhatsApp→Orión] OpenCode error', res.status, (await res.text()).slice(0, 200))
      return
    }
    const data = await res.json()
    reply = data.choices?.[0]?.message?.content?.trim() ?? ''
  } catch (err) {
    console.error('[WhatsApp→Orión] OpenCode fetch error', err)
    return
  }

  if (!reply) return

  history.push({ role: 'assistant', content: reply })
  sessions.set(phone, history)

  try {
    await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
      body: JSON.stringify({ number: remoteJid, text: reply }),
    })
    console.log(`[WhatsApp→Orión] sent reply to ${phone}`)
  } catch (err) {
    console.error('[WhatsApp→Orión] Evolution send error', err)
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const d = body.data as Record<string, unknown> | undefined
  if (!d) return NextResponse.json({ ok: true })

  const key = d.key as Record<string, unknown> | undefined
  if (!key) return NextResponse.json({ ok: true })

  if (key.fromMe) return NextResponse.json({ ok: true })

  const remoteJid = key.remoteJid as string | undefined
  if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@broadcast')) {
    return NextResponse.json({ ok: true })
  }

  const msgContent = d.message as Record<string, unknown> | undefined
  const text =
    (msgContent?.conversation as string) ||
    ((msgContent?.extendedTextMessage as Record<string, unknown>)?.text as string) ||
    null

  if (!text?.trim()) return NextResponse.json({ ok: true })

  handleMessage(remoteJid, text.trim()).catch(console.error)
  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ status: 'ok', agent: 'orion' })
}
