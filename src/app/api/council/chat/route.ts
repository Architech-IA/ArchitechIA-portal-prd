import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const ORION_SYSTEM = `Eres Orión, el agente estratégico central de ArchiTechIA. En este canal, conversas directamente con un socio o directivo de la empresa.

Tu función aquí es escuchar, entender y estructurar ideas de proyectos, iniciativas o mejoras que el socio quiere proponer. Haces preguntas clarificadoras cuando es necesario: ¿cuál es el objetivo?, ¿qué área lo ejecutaría?, ¿qué tareas concretas implica?, ¿qué prioridad tiene?

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
  const safeSystem = ORION_SYSTEM.replace(/'/g, "'\\''")
  const safeUser = userPrompt.replace(/'/g, "'\\''")
  const { stdout } = await execAsync(`claude --system-prompt '${safeSystem}' -p '${safeUser}'`, { timeout: 60000 })
  return NextResponse.json({ reply: stdout.trim() })
}
