import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SYSTEM = `Sos un arquitecto de software experto en sistemas empresariales latinoamericanos.
Dado el contexto de un proyecto, generás un diagrama de ARQUITECTURA DE COMPONENTES en JSON.

El diagrama muestra los componentes tecnicos del sistema y como se conectan.
NO es un flujograma. NO muestra pasos ni flujos de proceso.
Es un diagrama de arquitectura como los de Azure, AWS o draw.io.

POSICIONAMIENTO — los componentes se ubican en un plano 2D (coordenadas x, y de 0 a 10):
  Zona superior (y=0-1):     Usuarios / clientes / navegadores
  Zona media-alta (y=2-3):   Frontend — apps web, portales, dashboards
  Zona central (y=4-5):      API / Gateway / Backend / servicios principales
  Zona media-baja (y=6-7):   Base de datos, cache, colas, almacenamiento
  Zona inferior (y=8-9):     Servicios externos, integraciones, cloud

En el eje X (0-10) distribuís los componentes horizontalmente segun sea natural.
No hay un orden fijo de izquierda a derecha — posicioná cada componente donde tenga sentido.
Ejemplo: si hay 3 microservicios en el backend, ponelos en y=4 con x=2, x=5, x=8.

REGLAS:
- Minimo 5 nodos, maximo 12 nodos — solo los componentes clave del stack
- x e y son numeros de 0 a 10 (decimales permitidos, ej: 3.5)
- Dos nodos no deben estar en la misma posicion exacta (separalos al menos 1.5 unidades)
- label: nombre corto del componente, maximo 20 caracteres
- description: tecnologia o rol brevísimo, maximo 30 caracteres (opcional)
- Las conexiones representan que dos componentes se comunican o dependen entre si
- NO pongas labels en las conexiones

FORMATO DE SALIDA — devolvé UNICAMENTE el JSON, sin explicaciones ni markdown:
{
  "title": "...",
  "description": "...",
  "nodes": [
    { "id": "n1", "label": "Usuario", "description": "Navegador web", "x": 5, "y": 0 },
    { "id": "n2", "label": "Portal Web", "description": "React / Next.js", "x": 5, "y": 2.5 },
    { "id": "n3", "label": "API Gateway", "description": "Express / REST", "x": 3, "y": 5 },
    { "id": "n4", "label": "PostgreSQL", "description": "Base de datos", "x": 3, "y": 7 },
    { "id": "n5", "label": "WhatsApp API", "description": "Integración", "x": 7, "y": 5 }
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

    // Normalize positions: clamp x,y to [0,10] and resolve collisions
    const usedPos: Array<{ x: number; y: number }> = []
    data.nodes = data.nodes.map((n: Record<string, unknown>, i: number) => {
      n = { ...n, id: n.id ?? `n${i}` }
      let x = Math.max(0, Math.min(10, parseFloat(String(n.x)) || 5))
      let y = Math.max(0, Math.min(9, parseFloat(String(n.y)) || i * 2))
      // Resolve collision: nudge until free
      let tries = 0
      while (usedPos.some(p => Math.abs(p.x - x) < 1.5 && Math.abs(p.y - y) < 1.5) && tries < 20) {
        x = Math.min(10, x + 1.5)
        if (x > 9) { x = 0; y = Math.min(9, y + 1.5) }
        tries++
      }
      usedPos.push({ x, y })
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
