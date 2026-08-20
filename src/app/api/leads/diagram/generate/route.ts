import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SYSTEM = `Sos un arquitecto de software experto en sistemas empresariales latinoamericanos.
Dado el contexto de un proyecto, generás un diagrama de ARQUITECTURA DE COMPONENTES en JSON.

El diagrama muestra los componentes tecnicos del sistema y como se conectan.
NO es un flujograma. NO muestra pasos ni flujos de proceso.
Es un diagrama de arquitectura como los de Azure, AWS o draw.io.

POSICIONAMIENTO — cuadricula HORIZONTAL con coordenadas ENTERAS x (0-11) e y (0-5):
  El eje X representa las capas de izquierda a derecha:
    x=0-1:  Usuarios / clientes / navegadores / actores externos
    x=2-3:  Frontend — apps web, portales, dashboards, apps moviles
    x=4-5:  API / Gateway / BFF / autenticacion
    x=6-7:  Backend — servicios, microservicios, logica de negocio
    x=8-9:  Datos — bases de datos, cache, colas, almacenamiento
    x=10-11: Servicios externos / cloud / integraciones de terceros

  El eje Y distribuye verticalmente los componentes dentro de cada columna.
  Ejemplo: si hay 2 servicios backend, uno va en x=6,y=1 y otro en x=6,y=3.
  Centrar los nodos verticalmente: con 1 nodo en una columna usá y=2, con 2 usá y=1 e y=3.

REGLAS:
- Minimo 5 nodos, maximo 12 nodos — solo los componentes clave del stack
- x debe ser ENTERO de 0 a 11, y debe ser ENTERO de 0 a 5 — sin decimales
- Dos nodos no pueden compartir la misma celda (x,y) — separalos siempre
- label: nombre corto del componente, maximo 20 caracteres
- description: tecnologia o rol brevísimo, maximo 30 caracteres (opcional)
- Las conexiones representan que dos componentes se comunican o dependen entre si
- NO pongas labels en las conexiones

FORMATO DE SALIDA — devolvé UNICAMENTE el JSON, sin explicaciones ni markdown:
{
  "title": "...",
  "description": "...",
  "nodes": [
    { "id": "n1", "label": "Usuario", "description": "Navegador web", "x": 0, "y": 2 },
    { "id": "n2", "label": "Portal Web", "description": "React / Next.js", "x": 2, "y": 2 },
    { "id": "n3", "label": "API Gateway", "description": "Express / REST", "x": 4, "y": 2 },
    { "id": "n4", "label": "Servicio Core", "description": "Node.js", "x": 6, "y": 1 },
    { "id": "n5", "label": "Notificaciones", "description": "Worker", "x": 6, "y": 3 },
    { "id": "n6", "label": "PostgreSQL", "description": "Base de datos", "x": 8, "y": 2 },
    { "id": "n7", "label": "WhatsApp API", "description": "Integración", "x": 10, "y": 2 }
  ],
  "edges": [
    { "id": "e1", "from": "n1", "to": "n2" },
    { "id": "e2", "from": "n2", "to": "n3" },
    { "id": "e3", "from": "n3", "to": "n4" },
    { "id": "e4", "from": "n3", "to": "n5" }
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

  const prompt = `Contexto del proyecto:\n${context}\n\nGenerá el diagrama de arquitectura de componentes del sistema a construir para este cliente. Usá posicionamiento 2D libre para que se vea como una arquitectura real, no como un flujograma.`

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

    // Normalize positions: snap to integer grid [0-9], resolve collisions
    const usedPos = new Set<string>()
    data.nodes = data.nodes.map((n: Record<string, unknown>, i: number) => {
      n = { ...n, id: n.id ?? `n${i}` }
      let x = Math.max(0, Math.min(11, Math.round(parseFloat(String(n.x)) || 5)))
      let y = Math.max(0, Math.min(5,  Math.round(parseFloat(String(n.y)) || (i % 3) * 2)))
      // Resolve collision by nudging x then wrapping to next row
      let tries = 0
      while (usedPos.has(`${x},${y}`) && tries < 30) {
        y = y + 1
        if (y > 5) { y = 0; x = Math.min(11, x + 1) }
        tries++
      }
      usedPos.add(`${x},${y}`)
      return { ...n, x, y }
    })

    // Strip edge labels, keep only from/to/id
    data.edges = data.edges.map((e: Record<string, unknown>, i: number) => ({
      id: e.id ?? `e${i}`, from: e.from, to: e.to,
    }))

    return NextResponse.json({ data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[diagram/generate]', msg.slice(0, 500))
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
