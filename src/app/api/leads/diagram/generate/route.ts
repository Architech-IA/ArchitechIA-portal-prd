import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SYSTEM = `Sos un arquitecto de software experto en sistemas empresariales latinoamericanos.
Dado el contexto de un proyecto, genera un diagrama simple de componentes del sistema en JSON.

SISTEMA DE CAPAS — los componentes se ubican en columnas de izquierda a derecha:
  layer 0 -> Usuario / cliente (quien usa el sistema)
  layer 1 -> Frontend (app web, movil, portal)
  layer 2 -> API / Gateway (punto de entrada backend)
  layer 3 -> Servidor / logica de negocio
  layer 4 -> Base de datos / cache / cola
  layer 5 -> Servicios externos / terceros

REGLAS:
- Entre 5 y 10 nodos - solo los componentes principales del sistema
- row empieza en 0 dentro de cada layer (0, 1, 2 maximo 3 por layer)
- label: nombre corto del componente, maximo 18 caracteres
- description: tecnologia o rol brevisimo, maximo 30 caracteres (opcional)
- Las conexiones representan simplemente que dos componentes se comunican

FORMATO DE SALIDA - devolver UNICAMENTE el JSON, sin markdown ni explicaciones:
{
  "title": "...",
  "description": "...",
  "nodes": [
    { "id": "n1", "label": "Usuario", "description": "Navegador web", "layer": 0, "row": 0 }
  ],
  "edges": [
    { "id": "e1", "from": "n1", "to": "n2", "label": "HTTPS" }
  ]
}`

function stripMd(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

export async function POST(req: NextRequest) {
  const { leadId } = await req.json().catch(() => ({}))
  if (!leadId) return NextResponse.json({ error: 'leadId requerido' }, { status: 400 })

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

  const stripHtml = (s: string | null) => (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  const phaseNotes = phases
    .filter(p => p.content && p.phase !== 'COMPONENT_DIAGRAM')
    .map(p => {
      let text = p.content ?? ''
      try {
        const parsed = JSON.parse(text) as { tabs?: { name: string; content: string }[] }
        if (parsed.tabs) text = parsed.tabs.map(t => `[${t.name}] ${stripHtml(t.content)}`).join(' | ')
      } catch { text = stripHtml(text) }
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

  const prompt = `Contexto del proyecto:\n${context}\n\nGenerá el diagrama de arquitectura de componentes del sistema a construir para este cliente.`

  try {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    const sq  = "'"
    const esc = sq + '\\' + "'" + sq
    const safe = (s: string) => s.split(sq).join(esc)

    const cmd = `claude --model claude-sonnet-5 --system-prompt '${safe(SYSTEM)}' -p '${safe(prompt)}'`
    const { stdout } = await execAsync(cmd, { timeout: 90_000 })

    const raw  = stripMd(stdout.trim())
    const data = JSON.parse(raw)

    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      throw new Error('JSON inválido: falta nodes o edges')
    }

    // Cap nodes
    if (data.nodes.length > 12) {
      data.nodes = data.nodes.slice(0, 12)
      const keepIds = new Set(data.nodes.map((n: Record<string, unknown>) => n.id))
      data.edges = data.edges.filter((e: Record<string, unknown>) => keepIds.has(e.from) && keepIds.has(e.to))
    }

    // Normalize positions and dedupe (layer, row)
    const usedPos = new Set<string>()
    data.nodes = data.nodes.map((n: Record<string, unknown>, i: number) => {
      n = { ...n, id: n.id ?? `n${i}` }
      let layer = Math.max(0, Math.min(5, Number(n.layer) || 0))
      let row   = Math.max(0, Math.min(4, Number(n.row)   || 0))
      for (let r = row; r <= row + 4; r++) {
        const key = `${layer},${r}`
        if (!usedPos.has(key)) { usedPos.add(key); row = r; break }
      }
      return { ...n, layer, row }
    })

    data.edges = data.edges.map((e: Record<string, unknown>, i: number) => ({ ...e, id: e.id ?? `e${i}` }))

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[diagram/generate]', msg.slice(0, 500))
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
