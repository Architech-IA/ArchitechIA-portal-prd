import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callOpenCode } from '@/lib/opencodeChat'

// "Generar con IA" del tab Arquitectura de la solucion. Junta TODO lo que el
// portal sabe del proyecto (solucion, PRD, diseno tecnico, plan de ejecucion,
// plan de trabajo, cronograma, riesgos, hitos, backlog, lead, notas de fases,
// interacciones, propuestas, diagrama del lead, reuniones) y le pide al modelo
// un diagrama de componentes para el lienzo. No guarda nada: devuelve nodos y
// conexiones para que el usuario los revise y use "Guardar cambios".

type NodeType = 'frontend' | 'backend' | 'database' | 'api' | 'ia' | 'queue' | 'cache' | 'externo'
const TIPOS: NodeType[] = ['frontend', 'backend', 'database', 'api', 'ia', 'queue', 'cache', 'externo']

// Mismas medidas que components/ArchitectureCanvas.tsx (NODE_W=140, NODE_H=64)
const PASO_X = 180
const PASO_Y = 100

const SYSTEM = `Eres un arquitecto de software experto en sistemas empresariales. Recibes TODO el contexto disponible de un proyecto (PRD, diseño técnico, plan de ejecución, notas comerciales, backlog, riesgos, etc.) y produces el diagrama de ARQUITECTURA DE COMPONENTES del sistema a construir.

No es un flujograma de procesos: es un diagrama de componentes técnicos y sus conexiones, como los de AWS/Azure.

Reglas:
- Fundamenta cada componente en el contexto. Si el Diseño Técnico ya define stack, entidades o integraciones, respétalos. Si hay un diagrama actual, consérvalo y complétalo/corrígelo en vez de rehacerlo de cero.
- No inventes tecnologías que el contexto contradiga. Cuando el contexto no dice la tecnología, propón la más razonable y deja claro el rol en "description".
- Incluye las integraciones externas, canales (por ejemplo WhatsApp, correo), proveedores de IA, colas, cachés y almacenamiento que el contexto mencione o exija.
- Entre 6 y 16 componentes. Cada uno con:
  - "label": nombre corto, máximo 22 caracteres
  - "description": tecnología o rol, máximo 40 caracteres
  - "type": exactamente uno de: frontend | backend | database | api | ia | queue | cache | externo
  - "x" entero 0-9 e "y" entero 0-5 (celda de la cuadrícula; no repitas celda).
- Columnas (x) de izquierda a derecha: 0-1 interfaces y canales de usuario; 2-3 API / gateway / autenticación; 4-5 backend y lógica de negocio (incluye IA/LLM); 6-7 datos, caché y colas; 8-9 servicios externos e integraciones de terceros. Reparte verticalmente (y) y centra: un solo nodo en una columna va en y=2; dos van en y=1 e y=3.
- "edges": conexiones { "from", "to" } entre ids de nodos. Sin etiquetas. No repitas un par en ambos sentidos.
- "resumen": 2 a 4 frases explicando las decisiones y qué partes del contexto las motivaron.
- "supuestos": lista de cosas que asumiste por falta de información (puede ir vacía).

Devuelve ÚNICAMENTE un JSON válido, sin markdown ni comentarios:
{ "resumen": "...", "supuestos": ["..."], "nodes": [ { "id": "n1", "label": "...", "description": "...", "type": "frontend", "x": 0, "y": 2 } ], "edges": [ { "from": "n1", "to": "n2" } ] }`

const RUIDO = new Set(['id', 'backlogItemId', 'itemId', 'createdAt', 'updatedAt'])

function limpiarHtml(s: string): string {
  return s
    .replace(/<\/(p|h[1-6]|div|li)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
}

// JSON (o texto) -> texto legible con las claves como etiquetas, sin ids
function aTexto(v: unknown, depth = 0): string {
  if (v == null) return ''
  if (typeof v === 'string') return limpiarHtml(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map(x => aTexto(x, depth + 1)).filter(Boolean).map(t => (depth > 0 ? t : `- ${t}`)).join(depth > 0 ? ' | ' : '\n')
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !RUIDO.has(k))
      .map(([k, x]) => { const t = aTexto(x, depth + 1); return t ? `${k}: ${t}` : '' })
      .filter(Boolean)
      .join(depth > 0 ? '; ' : '\n')
  }
  return ''
}

function jsonATexto(raw: string | null | undefined, max: number): string {
  if (!raw) return ''
  let t: string
  try { t = aTexto(JSON.parse(raw)) } catch { t = limpiarHtml(raw) }
  return t.length > max ? t.slice(0, max) + '…' : t
}

function notasFase(content: string | null): string {
  if (!content) return ''
  try {
    const p = JSON.parse(content) as { tabs?: { name?: string; content?: string }[] }
    if (Array.isArray(p.tabs)) return p.tabs.map(t => `[${t.name || 'Nota'}] ${limpiarHtml(t.content || '')}`).filter(t => t.length > 8).join(' | ')
  } catch {}
  return limpiarHtml(content)
}

function seccion(titulo: string, cuerpo: string, fuentes: string[], max: number): string {
  const t = cuerpo.trim()
  if (!t) return ''
  fuentes.push(titulo)
  return `## ${titulo}\n${t.length > max ? t.slice(0, max) + '…' : t}\n`
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sol = await prisma.solucion.findUnique({
    where: { id },
    include: {
      riesgos: true, hitos: true,
      backlogItems: { select: { title: true, status: true, type: true, priority: true }, orderBy: { createdAt: 'asc' }, take: 80 },
      epics: { select: { name: true, description: true } },
      sprints: { select: { name: true, goal: true, status: true } },
    },
  })
  if (!sol) return NextResponse.json({ error: 'Solución no encontrada' }, { status: 404 })

  const fuentes: string[] = []
  const partes: string[] = []

  partes.push(seccion('Solución', [
    `Nombre: ${sol.nombre}`, `Tipo: ${sol.tipo}`, `Estado: ${sol.estado}`,
    sol.empresa ? `Empresa: ${sol.empresa}` : '', sol.repositorio ? `Repositorio: ${sol.repositorio}` : '',
    sol.descripcion ? `Descripción: ${limpiarHtml(sol.descripcion)}` : '',
  ].filter(Boolean).join('\n'), fuentes, 2000))

  partes.push(seccion('PRD', jsonATexto(sol.prd, 14000), fuentes, 14000))
  partes.push(seccion('Diseño técnico', jsonATexto(sol.disenoTecnico, 9000), fuentes, 9000))
  partes.push(seccion('Plan de ejecución', jsonATexto(sol.planEjecucion, 5000), fuentes, 5000))
  partes.push(seccion('Plan de trabajo', limpiarHtml(sol.planTrabajo || ''), fuentes, 4000))
  partes.push(seccion('Cronograma', jsonATexto(sol.cronograma, 2000), fuentes, 2000))
  partes.push(seccion('Riesgos', sol.riesgos.map(r => `- ${r.titulo} (${r.severidad})${r.descripcion ? `: ${limpiarHtml(r.descripcion)}` : ''}`).join('\n'), fuentes, 2500))
  partes.push(seccion('Hitos', sol.hitos.map(h => `- ${h.titulo}${h.descripcion ? `: ${limpiarHtml(h.descripcion)}` : ''}`).join('\n'), fuentes, 1500))
  partes.push(seccion('Épicas y sprints', [
    ...sol.epics.map(e => `Épica: ${e.name}${e.description ? ` - ${limpiarHtml(e.description).slice(0, 200)}` : ''}`),
    ...sol.sprints.map(s => `Sprint: ${s.name}${s.goal ? ` - ${limpiarHtml(s.goal).slice(0, 200)}` : ''}`),
  ].join('\n'), fuentes, 3000))
  partes.push(seccion('Backlog (tareas)', sol.backlogItems.map(b => `- [${b.type}/${b.status}] ${b.title}`).join('\n'), fuentes, 5000))

  // Diagrama actual del lienzo (para conservarlo y completarlo)
  let actual = ''
  try {
    const a = sol.arquitectura ? JSON.parse(sol.arquitectura) : null
    const nodes = Array.isArray(a) ? a : Array.isArray(a?.nodes) ? a.nodes : []
    const conns = Array.isArray(a?.connections) ? a.connections : []
    if (nodes.length) {
      const nombre = new Map<string, string>(nodes.map((n: { id: string; label: string }) => [n.id, n.label]))
      actual = `Componentes: ${nodes.map((n: { label: string; type: string }) => `${n.label} (${n.type})`).join(', ')}\nConexiones: ${
        conns.map((c: { from: string; to: string }) => `${nombre.get(c.from) ?? '?'} -> ${nombre.get(c.to) ?? '?'}`).join('; ') || 'ninguna'}`
    }
  } catch {}
  partes.push(seccion('Diagrama actual del lienzo de arquitectura', actual, fuentes, 3000))

  // Lead asociado: datos comerciales, notas de fases, interacciones, propuestas, diagrama del lead, archivos
  if (sol.leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: sol.leadId },
      include: {
        cliente: { select: { nombre: true } },
        proposals: { select: { title: true, description: true, amount: true, status: true, tasks: { select: { title: true, completed: true } } } },
        activities: { select: { type: true, description: true, date: true }, orderBy: { createdAt: 'desc' }, take: 25 },
      },
    })
    if (lead) {
      partes.push(seccion('Lead / cliente', [
        `Empresa: ${lead.companyName}`, lead.cliente?.nombre ? `Cliente: ${lead.cliente.nombre}` : '',
        `Contacto: ${lead.contactName}`, `Fuente: ${lead.source}`, `Valor estimado: ${lead.estimatedValue}`,
        lead.tipo ? `Tipo: ${lead.tipo}` : '', lead.solucionAsociada ? `Solución asociada: ${lead.solucionAsociada}` : '',
        lead.scope ? `Alcance: ${limpiarHtml(lead.scope)}` : '', lead.notes ? `Notas: ${limpiarHtml(lead.notes)}` : '',
      ].filter(Boolean).join('\n'), fuentes, 3500))

      const fases = await prisma.leadHub.findMany({
        where: { leadId: sol.leadId }, orderBy: { createdAt: 'asc' },
        select: { phase: true, content: true, files: { select: { name: true } } },
      })
      partes.push(seccion('Notas de las fases del lead', fases.filter(f => f.phase !== 'COMPONENT_DIAGRAM')
        .map(f => `${f.phase}: ${notasFase(f.content)}`).filter(t => t.length > 12).join('\n'), fuentes, 9000))
      const archivos = fases.flatMap(f => f.files.map(x => `${f.phase}: ${x.name}`))
      partes.push(seccion('Archivos adjuntos del lead (solo nombres)', archivos.join('\n'), fuentes, 1200))

      const dg = fases.find(f => f.phase === 'COMPONENT_DIAGRAM')
      if (dg?.content) {
        try {
          const d = JSON.parse(dg.content) as { nodes?: { label: string; description?: string }[]; edges?: { from: string; to: string }[] }
          if (Array.isArray(d.nodes) && d.nodes.length) {
            const nom = new Map((d.nodes as { id?: string; label: string }[]).map(n => [n.id ?? '', n.label]))
            partes.push(seccion('Diagrama de componentes del lead (borrador comercial)',
              `Componentes: ${d.nodes.map(n => `${n.label}${n.description ? ` [${n.description}]` : ''}`).join(', ')}\nConexiones: ${(d.edges || []).map(e => `${nom.get(e.from) ?? '?'} -> ${nom.get(e.to) ?? '?'}`).join('; ')}`, fuentes, 2500))
          }
        } catch {}
      }

      partes.push(seccion('Interacciones con el cliente', lead.activities.map(a => `- [${a.type}] ${limpiarHtml(a.description)}`).join('\n'), fuentes, 4000))
      partes.push(seccion('Propuestas comerciales', lead.proposals.map(p =>
        `- ${p.title} (${p.status}, ${p.amount}): ${limpiarHtml(p.description)}${p.tasks.length ? ` | Tareas: ${p.tasks.map(t => t.title).join(', ')}` : ''}`).join('\n'), fuentes, 5000))

      // Reuniones cuyo titulo menciona a la empresa (no hay vinculo directo reunion-lead todavia)
      const reuniones = await prisma.meeting.findMany({
        where: { title: { contains: lead.companyName, mode: 'insensitive' } },
        select: { title: true, description: true, notes: true, hub: true, date: true },
        orderBy: { date: 'desc' }, take: 6,
      })
      partes.push(seccion('Reuniones relacionadas (por nombre de la empresa)', reuniones.map(m => {
        let hubTxt = ''
        try {
          const h = JSON.parse(m.hub || '{}') as { puntos?: { texto?: string }[]; notas?: string; decisiones?: { texto?: string }[] }
          hubTxt = [
            (h.puntos || []).map(p => p.texto).filter(Boolean).join('; '),
            notasFase(h.notas || ''),
            (h.decisiones || []).map(d => d.texto).filter(Boolean).join('; '),
          ].filter(Boolean).join(' | ')
        } catch {}
        return `- ${m.title}: ${[m.description ? limpiarHtml(m.description) : '', m.notes ? limpiarHtml(m.notes) : '', hubTxt].filter(Boolean).join(' | ')}`
      }).join('\n'), fuentes, 5000))
    }
  }

  const contexto = partes.filter(Boolean).join('\n').slice(0, 60000)
  if (fuentes.length <= 1) {
    return NextResponse.json({ error: 'Hay muy poco contexto para generar la arquitectura. Completa el PRD, el Diseño Técnico o las notas del lead primero.' }, { status: 422 })
  }

  try {
    const salida = await callOpenCode(SYSTEM,
      `Contexto completo del proyecto:\n\n${contexto}\n\nGenera el diagrama de arquitectura de componentes.`,
      `arq-${id}`, { maxTokens: 4500, timeoutMs: 150_000 })
    const limpio = salida.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const ini = limpio.indexOf('{'), fin = limpio.lastIndexOf('}')
    const data = JSON.parse(ini >= 0 && fin > ini ? limpio.slice(ini, fin + 1) : limpio)
    if (!Array.isArray(data.nodes) || data.nodes.length === 0) throw new Error('La respuesta no trae componentes')

    const usadas = new Set<string>()
    const ids = new Set<string>()
    const nodes = (data.nodes as Record<string, unknown>[]).slice(0, 16).map((n, i) => {
      let id = typeof n.id === 'string' && n.id && !ids.has(n.id) ? n.id : `n${i + 1}`
      while (ids.has(id)) id = `${id}_`
      ids.add(id)
      let gx = Math.max(0, Math.min(9, Math.round(Number(n.x)) || 0))
      let gy = Math.max(0, Math.min(5, Math.round(Number(n.y)) || 0))
      for (let t = 0; usadas.has(`${gx},${gy}`) && t < 60; t++) { gy++; if (gy > 5) { gy = 0; gx = Math.min(9, gx + 1) } }
      usadas.add(`${gx},${gy}`)
      const label = String(n.label ?? 'Componente').slice(0, 22)
      const tipo = TIPOS.includes(n.type as NodeType) ? (n.type as NodeType) : 'externo'
      return { id, label, type: tipo, x: 16 + gx * PASO_X, y: 16 + gy * PASO_Y }
    })
    const pares = new Set<string>()
    const connections = (Array.isArray(data.edges) ? data.edges : [])
      .filter((e: Record<string, unknown>) => typeof e.from === 'string' && typeof e.to === 'string' && ids.has(e.from as string) && ids.has(e.to as string) && e.from !== e.to)
      .filter((e: Record<string, unknown>) => {
        const k = [e.from, e.to].sort().join('|')
        if (pares.has(k)) return false
        pares.add(k); return true
      })
      .map((e: Record<string, unknown>, i: number) => ({ id: `c${i + 1}${Math.random().toString(36).slice(2, 6)}`, from: e.from as string, to: e.to as string }))

    return NextResponse.json({
      nodes, connections,
      resumen: typeof data.resumen === 'string' ? data.resumen : '',
      supuestos: Array.isArray(data.supuestos) ? data.supuestos.filter((s: unknown) => typeof s === 'string').slice(0, 8) : [],
      fuentes,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[soluciones/arquitectura-generate]', msg.slice(0, 400))
    return NextResponse.json({ error: msg.includes('JSON') ? 'El modelo devolvió un formato inválido. Intenta de nuevo.' : msg }, { status: 502 })
  }
}
