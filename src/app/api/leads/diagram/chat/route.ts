import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callOpenCode } from '@/lib/opencodeChat'

// Chat para DEBATIR el diagrama de arquitectura de un Lead. La IA ve el
// diagrama actual + el contexto del Lead, conversa, y opcionalmente PROPONE
// cambios estructurados. Nada se aplica aca: el frontend previsualiza la
// propuesta y el usuario decide Aplicar o Descartar.

const TIPOS = ['user', 'frontend', 'api', 'backend', 'database', 'queue', 'external']
const MAX_NODOS = 12
const COLS = 12
const ROWS = 6

const SYSTEM = `Sos un arquitecto de software experto en sistemas empresariales latinoamericanos. Estás debatiendo con el usuario un DIAGRAMA DE ARQUITECTURA DE COMPONENTES (no un flujograma) de un cliente.

Recibís el diagrama actual (componentes y conexiones), el contexto del cliente y el historial de la conversación. Tu trabajo: conversar de forma concreta y útil — cuestionar decisiones, señalar riesgos (puntos únicos de falla, seguridad, escalabilidad, acoplamiento, lo que falta o sobra), y proponer mejoras.

REGLAS DE LA CONVERSACIÓN:
- Respondé corto: 2 a 5 oraciones, sin listas largas. Una idea principal por respuesta.
- Basate en el diagrama y el contexto reales; no inventes componentes ni requisitos que no se desprendan de ellos.
- Solo incluí una "propuesta" cuando el usuario pide un cambio, o cuando hay una mejora clara y concreta. Si solo estás opinando o preguntando, "propuesta" es null.
- Si el usuario tiene un componente seleccionado, centrate en ese.

CÓMO PROPONER CAMBIOS (campo "propuesta"):
- Componentes existentes se referencian por su "id" exacto.
- Componentes nuevos: usá un id temporal propio ("nuevo1", "nuevo2"…) y usá ese mismo id en las conexiones nuevas.
- Cuadrícula: x entero 0-11, y entero 0-5. Columnas: x=0-1 usuarios/actores, 2-3 frontend, 4-5 API/gateway, 6-7 backend, 8-9 datos/colas, 10-11 servicios externos. No pongas dos nodos en la misma celda.
- label: máximo 20 caracteres. description: máximo 30 caracteres, opcional. type exacto: user | frontend | api | backend | database | queue | external.
- El diagrama completo no puede pasar de 12 componentes.
- Las conexiones no llevan etiqueta.
- Cada cambio de "propuesta" debe ser mínimo y justificado: no rehagas el diagrama entero.

FORMATO DE SALIDA — devolvé ÚNICAMENTE un objeto JSON, sin markdown ni texto alrededor:
{
  "mensaje": "tu respuesta al usuario",
  "propuesta": null
}
o, cuando proponés cambios:
{
  "mensaje": "tu respuesta al usuario",
  "propuesta": {
    "descripcion": "resumen de una línea del cambio",
    "agregarNodos": [ { "id": "nuevo1", "label": "Cola de mensajes", "description": "RabbitMQ", "type": "queue", "x": 8, "y": 4 } ],
    "modificarNodos": [ { "id": "<id existente>", "label": "...", "description": "...", "type": "...", "x": 6, "y": 2 } ],
    "quitarNodos": [ "<id existente>" ],
    "agregarConexiones": [ { "from": "<id>", "to": "nuevo1" } ],
    "quitarConexiones": [ { "from": "<id>", "to": "<id>" } ]
  }
}
(Los arrays de "propuesta" que no uses van vacíos: [].)`

interface Nodo { id: string; label: string; description?: string; type?: string; x: number; y: number }
interface Arista { id: string; from: string; to: string }
type Rec = Record<string, unknown>

function extractJson(text: string): Rec | null {
  const s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  try { return JSON.parse(s) } catch { /* buscar el primer objeto balanceado */ }
  const start = s.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}' && --depth === 0) {
      try { return JSON.parse(s.slice(start, i + 1)) } catch { return null }
    }
  }
  return null
}

const stripHtml = (s: string | null) => (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const entero = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def
}
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// Normaliza y valida la propuesta del modelo contra el diagrama real: ids que
// existan, celdas libres, sin duplicados, tope de nodos. Devuelve null si no
// queda ningun cambio valido.
function normalizarPropuesta(raw: unknown, nodos: Nodo[], aristas: Arista[]) {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Rec
  const arr = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter((x): x is Rec => !!x && typeof x === 'object') : [])
  const existentes = new Set(nodos.map(n => n.id))

  const quitarNodos = (Array.isArray(p.quitarNodos) ? p.quitarNodos : [])
    .filter((id): id is string => typeof id === 'string' && existentes.has(id))
  const quitar = new Set(quitarNodos)

  const modificarNodos = arr(p.modificarNodos)
    .filter(m => typeof m.id === 'string' && existentes.has(m.id as string) && !quitar.has(m.id as string))
    .map(m => {
      const o: Rec = { id: m.id }
      if (texto(m.label, 20)) o.label = texto(m.label, 20)
      if (m.description !== undefined) o.description = texto(m.description, 30)
      if (typeof m.type === 'string' && TIPOS.includes(m.type)) o.type = m.type
      if (m.x !== undefined && m.y !== undefined) { o.x = entero(m.x, 0, COLS - 1, 0); o.y = entero(m.y, 0, ROWS - 1, 0) }
      return o
    })
    .filter(o => Object.keys(o).length > 1)

  // celdas ocupadas tras quitar nodos (las de nodos modificados se liberan y reocupan abajo)
  const ocupadas = new Set(nodos.filter(n => !quitar.has(n.id)).map(n => `${Math.round(n.x)},${Math.round(n.y)}`))
  const libre = (x: number, y: number) => {
    let cx = x, cy = y, t = 0
    while (ocupadas.has(`${cx},${cy}`) && t < 80) { cy++; if (cy >= ROWS) { cy = 0; cx = Math.min(COLS - 1, cx + 1) } t++ }
    ocupadas.add(`${cx},${cy}`)
    return { x: cx, y: cy }
  }

  const cupo = Math.max(0, MAX_NODOS - (nodos.length - quitarNodos.length))
  const idTemporal = new Map<string, string>()
  const agregarNodos: Nodo[] = arr(p.agregarNodos).slice(0, cupo).map((n, i) => {
    const real = `n${Date.now()}-${i}`
    if (typeof n.id === 'string') idTemporal.set(n.id, real)
    const pos = libre(entero(n.x, 0, COLS - 1, 5), entero(n.y, 0, ROWS - 1, 2))
    return {
      id: real, label: texto(n.label, 20) || 'Nuevo componente', description: texto(n.description, 30) || undefined,
      type: typeof n.type === 'string' && TIPOS.includes(n.type) ? n.type : undefined, ...pos,
    }
  })

  const resolver = (id: unknown): string | null => {
    if (typeof id !== 'string') return null
    if (idTemporal.has(id)) return idTemporal.get(id)!
    return existentes.has(id) && !quitar.has(id) ? id : null
  }
  const mismaArista = (a: { from: string; to: string }, b: { from: string; to: string }) =>
    (a.from === b.from && a.to === b.to) || (a.from === b.to && a.to === b.from)

  const agregarConexiones: { from: string; to: string }[] = []
  for (const c of arr(p.agregarConexiones)) {
    const from = resolver(c.from), to = resolver(c.to)
    if (!from || !to || from === to) continue
    const nueva = { from, to }
    if (aristas.some(e => mismaArista(e, nueva)) || agregarConexiones.some(e => mismaArista(e, nueva))) continue
    agregarConexiones.push(nueva)
  }

  const quitarConexiones = arr(p.quitarConexiones)
    .map(c => ({ from: c.from, to: c.to }))
    .filter((c): c is { from: string; to: string } => typeof c.from === 'string' && typeof c.to === 'string')
    .filter(c => aristas.some(e => mismaArista(e, c)))

  if (!agregarNodos.length && !modificarNodos.length && !quitarNodos.length && !agregarConexiones.length && !quitarConexiones.length) return null
  return {
    descripcion: texto(p.descripcion, 160) || 'Cambios propuestos al diagrama',
    agregarNodos, modificarNodos, quitarNodos, agregarConexiones, quitarConexiones,
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    leadId?: string; mensaje?: string; seleccionado?: string | null
    historial?: { role?: string; content?: string }[]
    diagram?: { title?: string; nodes?: Nodo[]; edges?: Arista[] }
  }
  const { leadId } = body
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : ''
  if (!leadId) return NextResponse.json({ error: 'leadId requerido' }, { status: 400 })
  if (!mensaje) return NextResponse.json({ error: 'mensaje requerido' }, { status: 400 })

  const nodos: Nodo[] = Array.isArray(body.diagram?.nodes) ? body.diagram!.nodes!.filter(n => n && typeof n.id === 'string') : []
  const aristas: Arista[] = Array.isArray(body.diagram?.edges) ? body.diagram!.edges!.filter(e => e && typeof e.from === 'string' && typeof e.to === 'string') : []

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { companyName: true, scope: true, solucionAsociada: true, notes: true, tipo: true },
  })
  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

  const fases = await prisma.leadHub.findMany({
    where: { leadId }, select: { phase: true, content: true }, orderBy: { createdAt: 'asc' },
  })
  const notasFases = fases
    .filter(p => p.content && p.phase !== 'COMPONENT_DIAGRAM')
    .map(p => {
      let t = p.content ?? ''
      try {
        const parsed = JSON.parse(t) as { tabs?: { name: string; content: string }[] }
        if (parsed.tabs) t = parsed.tabs.map(x => `[${x.name}] ${stripHtml(x.content)}`).join(' | ')
      } catch { t = stripHtml(t) }
      return `${p.phase}: ${t.slice(0, 500)}`
    }).join('\n')

  const contexto = [
    `Empresa: ${lead.companyName}`,
    lead.solucionAsociada ? `Solución: ${lead.solucionAsociada}` : '',
    lead.tipo ? `Tipo: ${lead.tipo}` : '',
    lead.scope ? `Alcance: ${stripHtml(lead.scope).slice(0, 400)}` : '',
    lead.notes ? `Notas generales: ${stripHtml(lead.notes).slice(0, 400)}` : '',
    notasFases ? `Notas de fases:\n${notasFases}` : '',
  ].filter(Boolean).join('\n')

  const porId = new Map(nodos.map(n => [n.id, n]))
  const diagramaTxt = [
    `Título: ${body.diagram?.title || '(sin título)'}`,
    `Componentes (${nodos.length}):`,
    ...nodos.map(n => `- id=${n.id} | ${n.label} | tipo=${n.type ?? 'sin tipo'} | ${n.description ?? ''} | celda(${Math.round(n.x)},${Math.round(n.y)})`),
    `Conexiones (${aristas.length}):`,
    ...aristas.map(e => `- ${porId.get(e.from)?.label ?? e.from} (${e.from}) — ${porId.get(e.to)?.label ?? e.to} (${e.to})`),
  ].join('\n')
  const sel = body.seleccionado && porId.get(body.seleccionado)
    ? `\nComponente seleccionado por el usuario: ${porId.get(body.seleccionado)!.label} (id=${body.seleccionado})` : ''

  // Historial en un solo mensaje de usuario (callOpenCode es de un turno): se ve
  // la charla previa y la pregunta actual, con el diagrama vigente al final.
  const previo = (Array.isArray(body.historial) ? body.historial : []).slice(-10)
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Vos'}: ${(m.content as string).slice(0, 1200)}`).join('\n')

  const user = `CONTEXTO DEL CLIENTE:\n${contexto}\n\nDIAGRAMA ACTUAL:\n${diagramaTxt}${sel}\n\n`
    + (previo ? `CONVERSACIÓN PREVIA:\n${previo}\n\n` : '')
    + `MENSAJE ACTUAL DEL USUARIO:\n${mensaje}`

  try {
    const out = await callOpenCode(SYSTEM, user, `lead-diagram-chat-${leadId}`, { maxTokens: 3000 })
    const j = extractJson(out)
    // Si el modelo no devolvio JSON, se muestra como texto plano sin propuesta.
    const msg = typeof j?.mensaje === 'string' && j.mensaje.trim() ? j.mensaje.trim() : (j ? '' : out.trim())
    if (!msg) return NextResponse.json({ error: 'La IA no devolvió una respuesta utilizable. Probá de nuevo.' }, { status: 502 })
    return NextResponse.json({ mensaje: msg, propuesta: j ? normalizarPropuesta(j.propuesta, nodos, aristas) : null })
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err)
    console.error('[diagram/chat]', m.slice(0, 400))
    return NextResponse.json({ error: m }, { status: 500 })
  }
}
