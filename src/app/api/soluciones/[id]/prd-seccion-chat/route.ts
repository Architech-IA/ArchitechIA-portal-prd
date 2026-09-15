import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const OPENCODE_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_KEY = process.env.OPENCODE_API_KEY ?? ''
// Mismo modelo/convencion que prd-generate y Orion: sin prefijo de proveedor.
const MODEL = 'qwen3.7-max'

// Duplicado a proposito desde prd-generate/route.ts (mismo criterio que ese
// archivo ya documenta: evitar acoplar dos features de IA que evolucionan
// por separado con un import cruzado).
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseHubContent(raw: string | null): string {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.tabs && Array.isArray(parsed.tabs)) {
      return parsed.tabs
        .filter((t: { content?: string }) => t.content && t.content !== '<p></p>')
        .map((t: { name: string; content: string }) => `[${t.name}]\n${stripHtml(t.content)}`)
        .join('\n\n')
    }
  } catch { /* no era TabbedNotes JSON, cae al fallback de abajo */ }
  return stripHtml(raw)
}

function truncar(texto: string, maxChars: number): string {
  if (texto.length <= maxChars) return texto
  return texto.slice(0, maxChars) + '\n[...contenido truncado por longitud...]'
}

function extractJsonObject(text: string): unknown | null {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  try {
    return JSON.parse(stripped)
  } catch { /* intentar extraer el primer objeto balanceado */ }

  const start = stripped.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++
    else if (stripped[i] === '}') {
      depth--
      if (depth === 0) {
        try { return JSON.parse(stripped.slice(start, i + 1)) } catch { return null }
      }
    }
  }
  return null
}

// Debe reflejar seccionesVisibles / AI_OPCIONES_SECCION del frontend
// (pilots/[id]/page.tsx) — misma clave, misma forma de "valor" esperada.
const SECCION_INFO: Record<string, { label: string; schema: string }> = {
  resumen: { label: 'Resumen ejecutivo', schema: 'un string de 4-6 líneas' },
  problema: { label: 'Problema / contexto', schema: 'un string de 2-3 párrafos completos, separados por "\\n\\n"' },
  objetivoGeneral: { label: 'Objetivo general', schema: 'un string de una sola frase, específica y verificable' },
  objetivosEspecificos: { label: 'Objetivos específicos', schema: 'un array de 4-6 strings, cada uno un objetivo medible' },
  dentroDeAlcance: { label: 'Dentro de alcance', schema: 'un array de 4-6 strings: qué SÍ entra en esta versión' },
  fueraDeAlcance: { label: 'Fuera de alcance', schema: 'un array de 4-6 strings: qué explícitamente NO entra' },
  personas: { label: 'Usuarios / personas', schema: 'un array de 3-4 objetos {"rol": string, "necesidad": string}' },
  requisitos: {
    label: 'Requisitos funcionales',
    schema: 'un array de ENTRE 8 Y 12 objetos (nunca menos de 8, ni siquiera en el primer intento) {"tipo": "historia" | "caso_uso", "texto": string, "criterioAceptacion": string (concreto y verificable, nunca algo vago como "funciona bien"), "prioridad": "MUST" | "SHOULD" | "COULD" | "WONT"}. Tienen que cubrir el flujo completo de principio a fin (no solo el caso feliz — incluí también algún caso borde o de error). Las prioridades tienen que estar REALMENTE repartidas entre las 4 opciones: JAMÁS pongas "MUST" en todos los ítems — como referencia, de 8-12 requisitos algo como 3-4 MUST, 3-4 SHOULD, 2-3 COULD y 0-2 WONT es una distribución realista',
  },
  rnf: { label: 'Requisitos no funcionales', schema: 'un array de 4-6 objetos {"categoria": "performance" | "seguridad" | "compatibilidad" | "escalabilidad" | "otro", "texto": string}' },
  metricas: { label: 'Métricas de éxito (KPIs)', schema: 'un array de 3-5 objetos {"nombre": string, "meta": string (con valor numérico concreto cuando aplique), "comoSeMide": string}' },
  riesgos: { label: 'Riesgos', schema: 'un array de 3-5 strings' },
  dependencias: { label: 'Dependencias', schema: 'un array de 3-5 strings' },
  supuestos: { label: 'Supuestos', schema: 'un array de 3-5 strings' },
  preguntasAbiertas: { label: 'Preguntas abiertas', schema: 'un array de 3-5 strings' },
}

type ChatMsg = { role: 'user' | 'assistant'; content: string }

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => ({})) as { seccionKey?: string; valorActual?: unknown; historial?: ChatMsg[] }
  const seccionKey = String(body.seccionKey || '')
  const info = SECCION_INFO[seccionKey]
  if (!info) return NextResponse.json({ error: 'Sección desconocida.' }, { status: 400 })

  const historialEntrada: ChatMsg[] = Array.isArray(body.historial)
    ? body.historial.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    : []
  // Limite defensivo: una entrevista de verdad no deberia pasar de unos
  // pocos turnos (el prompt ya le pide al modelo no preguntar mas de 3
  // veces), esto solo evita mandar un historial gigante si algo se rompe
  // del lado del frontend.
  const historial = historialEntrada.slice(-20)

  const solucion = await prisma.solucion.findUnique({ where: { id } })
  if (!solucion) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const [riesgos, hitos, lead, hubRows] = await Promise.all([
    prisma.riesgo.findMany({ where: { solucionId: id } }),
    prisma.hito.findMany({ where: { solucionId: id } }),
    solucion.leadId ? prisma.lead.findUnique({ where: { id: solucion.leadId } }) : Promise.resolve(null),
    solucion.leadId ? prisma.leadHub.findMany({ where: { leadId: solucion.leadId }, orderBy: { phase: 'asc' } }) : Promise.resolve([]),
  ])

  let fasesTexto = ''
  try {
    const fases = solucion.cronograma ? JSON.parse(solucion.cronograma) : []
    if (Array.isArray(fases) && fases.length > 0) {
      fasesTexto = fases.map((f: { fase?: string; fechaInicio?: string; fechaFin?: string; estado?: string }) =>
        `- ${f.fase || 'Sin nombre'} (${f.estado || 'PENDIENTE'}): ${f.fechaInicio || '?'} → ${f.fechaFin || '?'}`
      ).join('\n')
    }
  } catch { /* cronograma vacio o invalido, se omite */ }

  const riesgosTexto = riesgos.map(r =>
    `- [${r.severidad}/${r.probabilidad}] ${r.titulo}${r.descripcion ? ': ' + r.descripcion : ''}`
  ).join('\n')

  const hitosTexto = hitos.map(h =>
    `- ${h.titulo} (${h.estado})${h.fechaComprometida ? ' — comprometido: ' + h.fechaComprometida : ''}`
  ).join('\n')

  const leadHubTexto = hubRows
    .map(row => parseHubContent(row.content))
    .filter(Boolean)
    .join('\n\n')

  const contexto = [
    `Nombre: ${solucion.nombre}`,
    solucion.descripcion ? `Descripción: ${solucion.descripcion}` : null,
    `Tipo de Solución: ${solucion.tipo}`,
    solucion.planTrabajo ? `Plan de trabajo:\n${truncar(solucion.planTrabajo, 3000)}` : null,
    fasesTexto ? `Cronograma (fases ya definidas):\n${fasesTexto}` : null,
    riesgosTexto ? `Riesgos ya identificados:\n${riesgosTexto}` : null,
    hitosTexto ? `Hitos de cumplimiento:\n${hitosTexto}` : null,
    lead ? `Cliente/Lead asociado: ${lead.companyName} (contacto: ${lead.contactName})` : null,
    leadHubTexto ? `Notas del proceso de preventa (Lead Hub):\n${truncar(leadHubTexto, 4000)}` : null,
  ].filter(Boolean).join('\n\n')

  const systemPrompt = `Sos un analista de producto experto que ayuda a completar UNA sola sección de un PRD (Product Requirements Document) para ArchiTechIA, una consultora de IA, mediante una breve entrevista conversacional — no generás de una sola vez sin preguntar si falta información clave y específica que nadie más podría inferir.

Sección a trabajar: "${info.label}"
El valor final que vas a generar debe ser: ${info.schema}

Contexto conocido de la Solución:
${contexto || '(sin contexto adicional — solo el nombre y tipo de Solución)'}

Contenido que ya existe en esta sección (puede estar vacío — si no está vacío, tu trabajo es completarlo o mejorarlo, no ignorarlo ni repetir lo mismo):
${JSON.stringify(body.valorActual ?? null)}

Reglas de la entrevista:
1. OBLIGATORIO: en el primer turno (cuando todavía no hay ninguna respuesta del usuario en la conversación) SIEMPRE tenés que hacer una pregunta — nunca generes el contenido final en el primer turno, ni siquiera si el contexto ya te parece suficiente. El objetivo de esta función es que haya una entrevista real, no un atajo directo a generar.
2. Cada pregunta debe ser UNA sola, concreta y breve (nunca una lista de preguntas en el mismo turno), y tiene que buscar un dato específico que el contexto NO responde y que cambiaría el contenido (no preguntes algo ya respondido en el contexto o antes en esta conversación).
3. A partir de la segunda respuesta del usuario en adelante, y hasta un máximo de 3 preguntas en total, podés generar el contenido final si ya tenés lo suficiente. Generá también si el usuario pide generar ya, dice que no sabe / no tiene esa información, o ya le hiciste 3 preguntas — haciendo tu mejor inferencia razonable para lo que falte (sin inventar cifras o nombres muy específicos que no estén en el contexto).
4. Cada vez que preguntes, proponé también EXACTAMENTE 5 respuestas posibles distintas entre sí, concretas y directamente utilizables tal cual (no genéricas como "otra opción"), para que la persona pueda elegir una con un clic en vez de escribir. El usuario siempre puede además escribir su propia respuesta libremente, así que las 5 opciones son sugerencias, no las únicas respuestas válidas.
5. Devolvé SIEMPRE y SOLO un objeto JSON (sin markdown, sin texto alrededor), con una de estas dos formas EXACTAS:
   - Para preguntar: {"tipo": "pregunta", "mensaje": "string", "opciones": ["string", "string", "string", "string", "string"]}  (exactamente 5 opciones)
   - Para el contenido final: {"tipo": "contenido", "valor": <el valor con la forma indicada arriba>}`

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...(historial.length > 0
      ? historial
      : [{ role: 'user' as const, content: 'Empezá la entrevista: hacé tu primera pregunta.' }]),
  ]

  try {
    const upstream = await fetch(OPENCODE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCODE_KEY}`,
        // Estable por Solucion+seccion — evita cruzar sesiones entre
        // distintas secciones/entrevistas de un mismo PRD.
        'x-opencode-session': `prd-seccion-${id}-${seccionKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 4096,
      }),
    })
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      console.error('prd-seccion-chat: upstream error', upstream.status, detail)
      return NextResponse.json({ error: 'El modelo no respondió correctamente.' }, { status: 502 })
    }
    const data = await upstream.json()
    const content = data?.choices?.[0]?.message?.content ?? ''
    const parsed = extractJsonObject(content) as { tipo?: string; mensaje?: string; opciones?: unknown; valor?: unknown } | null
    if (!parsed || (parsed.tipo !== 'pregunta' && parsed.tipo !== 'contenido')) {
      return NextResponse.json({ error: 'No se pudo interpretar la respuesta del modelo.' }, { status: 502 })
    }
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Error al conversar con la IA para esta sección.' }, { status: 500 })
  }
}
