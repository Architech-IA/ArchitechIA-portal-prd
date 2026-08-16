import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SYSTEM = `Sos un arquitecto de software experto en sistemas empresariales latinoamericanos.
Dado el contexto de un proyecto de software, generás un mapa de arquitectura isométrico en JSON.

REGLAS CRÍTICAS DEL GRID 7×7 (gridX y gridY de 0 a 6):
- MÁXIMO 7 NODOS — elegí solo los componentes clave del sistema, no todos los detalles
- NINGÚN nodo puede compartir posición (gridX, gridY) — posiciones únicas obligatorio
- Separación mínima: dos nodos no pueden estar en posiciones adyacentes (diferencia < 2 en ambos ejes)
- Los labels deben ser CORTOS: máximo 18 caracteres

LAYOUT OBLIGATORIO — respetar estas zonas:
  • Usuario / cliente externo → gridX: 0, gridY: 0
  • Frontend / app / portal  → gridX: 1, gridY: 2
  • API Gateway / BFF        → gridX: 3, gridY: 2
  • Servidor lógica negocio  → gridX: 4, gridY: 1  o  gridX: 5, gridY: 2
  • Base de datos principal  → gridX: 5, gridY: 4
  • Cola / broker / eventos  → gridX: 3, gridY: 5
  • Servicio externo         → gridX: 6, gridY: 0  o  gridX: 6, gridY: 3
  (Usá esas posiciones exactas o cercanas, nunca agrupes varios nodos en la misma zona)

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

    // Cap to 8 nodes max
    if (data.nodes.length > 8) {
      data.nodes = data.nodes.slice(0, 8)
      const keepIds = new Set(data.nodes.map((n: Record<string, unknown>) => n.id))
      data.edges = data.edges.filter((e: Record<string, unknown>) => keepIds.has(e.from) && keepIds.has(e.to))
    }

    // Deduplicate positions — if two nodes share (gridX, gridY), shift the second one
    const usedPositions = new Set<string>()
    data.nodes = data.nodes.map((n: Record<string, unknown>, i: number) => {
      n = { ...n, id: n.id ?? `n${i}` }
      let gx = Math.max(0, Math.min(6, Number(n.gridX) || 0))
      let gy = Math.max(0, Math.min(6, Number(n.gridY) || 0))
      // Find an unoccupied cell
      outer: for (let d = 0; d <= 6; d++) {
        for (let dx = -d; dx <= d; dx++) {
          for (let dy = -d; dy <= d; dy++) {
            if (Math.abs(dx) !== d && Math.abs(dy) !== d) continue
            const nx = gx + dx, ny = gy + dy
            if (nx < 0 || nx > 6 || ny < 0 || ny > 6) continue
            const key = `${nx},${ny}`
            if (!usedPositions.has(key)) {
              usedPositions.add(key)
              n = { ...n, gridX: nx, gridY: ny }
              break outer
            }
          }
        }
      }
      return n
    })

    // Ensure all edge IDs are unique strings
    data.edges = data.edges.map((e: Record<string, unknown>, i: number) => ({ ...e, id: e.id ?? `e${i}` }))

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[arch/generate]', msg.slice(0, 500))
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
