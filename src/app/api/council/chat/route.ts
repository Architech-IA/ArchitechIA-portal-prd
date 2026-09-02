import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'

const OPENCODE_GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_KEY    = process.env.OPENCODE_API_KEY ?? ''
const OPENCODE_MODEL  = process.env.OPENCODE_EXECUTOR_MODEL ?? 'qwen3.7-max'

function stripReasoningTags(text: string): string {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const dangling = cleaned.toLowerCase().indexOf('<think>')
  return (dangling !== -1 ? cleaned.slice(0, dangling) : cleaned).trim()
}

const ORION_SYSTEM = `Eres Orión, el agente estratégico central de ArchiTechIA. En este canal, conversas directamente con un socio o directivo de la empresa.

Tu función aquí es escuchar, entender y estructurar ideas de proyectos, iniciativas o mejoras que el socio quiere proponer. Haces preguntas clarificadoras cuando es necesario: ¿cuál es el objetivo?, ¿qué área lo ejecutaría?, ¿qué tareas concretas implica?, ¿qué prioridad tiene?

Si la iniciativa implica desarrollar software nuevo, siempre preguntá también el dimensionamiento: ¿esto es un módulo/feature que vive DENTRO del portal ArchiTechIA (portal-architechia), o es un producto, demo o MVP independiente que debería vivir en su propio repositorio y desplegarse por separado? Esta decisión determina dónde termina viviendo el código, así que no la asumas sin preguntar salvo que sea obviamente una mejora al portal mismo.

Cuando el socio haya terminado de describir la iniciativa, le ofreces extraer la propuesta formal. Eres conciso, estratégico y hablas con autoridad. No te extiendes innecesariamente. Máximo 3-4 oraciones por respuesta.`

function buildPrompt(messages: { role: string; content: string }[]): string {
  if (messages.length === 0) return ''
  const history = messages.slice(0, -1)
    .map(m => `${m.role === 'user' ? 'Socio' : 'Orión'}: ${m.content}`)
    .join('\n')
  const last = messages[messages.length - 1]
  const ctx = history ? `Conversación previa:\n${history}\n\nResponde al siguiente mensaje del socio:` : 'El socio abre la conversación con:'
  return `${ctx}\nSocio: ${last.content}`
}

export async function POST(req: NextRequest) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0)
    return NextResponse.json({ error: 'messages requerido' }, { status: 400 })

  const userPrompt = buildPrompt(messages)
  const res = await fetch(OPENCODE_GO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENCODE_KEY}` },
    body: JSON.stringify({
      model: OPENCODE_MODEL,
      messages: [
        { role: 'system', content: ORION_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    return NextResponse.json({ error: `OpenCode API error ${res.status}` }, { status: 500 })
  }
  const data = await res.json()
  return NextResponse.json({ reply: stripReasoningTags(data.choices?.[0]?.message?.content ?? '') })
}
