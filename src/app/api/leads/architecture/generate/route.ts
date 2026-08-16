import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SYSTEM = `Sos un arquitecto de software experto en sistemas empresariales latinoamericanos.
Dado el contexto de un proyecto de software, generás un mapa de arquitectura isométrico en JSON.

REGLAS DEL GRID 6×6 (gridX y gridY de 0 a 5):
- Ningún nodo puede compartir posición (gridX, gridY)
- Máximo 12 nodos — preferí 6 a 10 para legibilidad
- Layout sugerido:
  • Usuario/cliente: esquina superior izquierda (gridX 0–1, gridY 0–1)
  • Frontend / canal de entrada: zona superior central (gridX 1–3, gridY 0–1)
  • API / Gateway: zona central (gridX 2–3, gridY 2–3)
  • Servidores de lógica: zona central-derecha (gridX 3–4, gridY 2–4)
  • Bases de datos / caché: zona inferior derecha (gridX 4–5, gridY 3–5)
  • Colas / brokers: zona central-inferior (gridX 2–3, gridY 4–5)
  • Servicios externos: borde derecho (gridX 5, gridY 0–3)

TIPOS DE NODOS: server | database | api | frontend | queue | cache | external | user
TIPOS DE CONEXIÓN: data (flujo de datos) | control (configuración/orquestación) | event (eventos asíncronos)

FORMATO DE SALIDA — devolvé ÚNICAMENTE el JSON, sin explicaciones ni markdown:
{
  "title": "...",
  "description": "...",
  "nodes": [
    { "id": "n1", "type": "user", "label": "...", "description": "...", "payload": "...", "gridX": 0, "gridY": 0 }
  ],
  "edges": [
    { "id": "e1", "from": "n1", "to": "n2", "label": "...", "type": "data" }
  ]
}`

function stripMd(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

export async function POST(req: NextRequest) {
  const { leadId } = await req.json().catch(() => ({}))
  if (!leadId) return NextResponse.json({ error: 'leadId requerido' }, { status: 400 })

  // ── Load context ──────────────────────────────────────────────────────────
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { companyName: true, scope: true, solucionAsociada: true, notes: true, tipo: true },
  })
  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

  const phases = await prisma.leadHub.findMany({
    where: { leadId },
    select: { phase: true, content: true },
    orderBy: { createdAt: 'asc' },
  })

  // Build context string, stripping HTML tags for cleanliness
  const stripHtml = (s: string | null) => (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  const phaseNotes = phases
    .filter(p => p.content)
    .map(p => {
      // content might be TabbedNotes JSON
      let text = p.content ?? ''
      try {
        const parsed = JSON.parse(text) as { tabs?: { name: string; content: string }[] }
        if (parsed.tabs) {
          text = parsed.tabs.map(t => `[${t.name}] ${stripHtml(t.content)}`).join(' | ')
        }
      } catch {
        text = stripHtml(text)
      }
      return `${p.phase}: ${text.slice(0, 600)}`
    })
    .join('\n')

  const context = [
    `Empresa: ${lead.companyName}`,
    lead.solucionAsociada ? `Solución: ${lead.solucionAsociada}` : '',
    lead.tipo ? `Tipo: ${lead.tipo}` : '',
    lead.scope ? `Alcance: ${stripHtml(lead.scope).slice(0, 400)}` : '',
    lead.notes ? `Notas generales: ${stripHtml(lead.notes).slice(0, 400)}` : '',
    phaseNotes ? `\nNotas de fases:\n${phaseNotes}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `Contexto del proyecto:\n${context}\n\nGenerá el mapa de arquitectura del sistema que se necesita construir para este cliente.`

  // ── Call Claude CLI ───────────────────────────────────────────────────────
  try {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    const sq  = "'"
    const esc = sq + '\\' + "'" + sq
    const safe = (s: string) => s.split(sq).join(esc)

    const cmd = `claude --model claude-sonnet-5 --system-prompt '${safe(SYSTEM)}' -p '${safe(prompt)}'`
    const { stdout } = await execAsync(cmd, { timeout: 90_000 })

    const raw = stripMd(stdout.trim())
    const data = JSON.parse(raw)

    // Validate minimal shape
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      throw new Error('JSON inválido: falta nodes o edges')
    }

    // Ensure all IDs are unique strings (safety)
    data.nodes = data.nodes.map((n: Record<string, unknown>, i: number) => ({ ...n, id: n.id ?? `n${i}` }))
    data.edges = data.edges.map((e: Record<string, unknown>, i: number) => ({ ...e, id: e.id ?? `e${i}` }))

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[arch/generate]', msg.slice(0, 500))
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
