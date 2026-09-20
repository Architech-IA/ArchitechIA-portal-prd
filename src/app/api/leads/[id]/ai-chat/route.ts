import { NextRequest, NextResponse } from 'next/server'
import { callOpenCodeMessages } from '@/lib/opencodeChat'
import { contextoLead, FASES_LEAD } from '@/lib/leadContext'
import { htmlATextoPlano, sanearHtml } from '@/lib/textoAHtml'

// Asistente de IA del Hub de Lead. Tres modos sobre la pestana de notas que la
// persona esta viendo, todos con el contexto completo del lead:
//  - generar: entrevista corta (1 a 3 preguntas) y redacta el contenido de la pestana
//  - mejorar: la persona dice que esta mal y la IA corrige el texto existente
//  - asesor: conversacion libre sobre el proceso (proximos pasos, riesgos, mensajes...)
// No guarda nada: devuelve el resultado y el cliente decide como aplicarlo.

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const BASE = `Eres el copiloto comercial de ArchiTechIA (empresa de software y automatización con IA). Ayudas a quien lleva un lead a través del pipeline: Identificación → Contacto → Diagnóstico → Demo → Propuesta → Negociación → Resultado.

Reglas generales:
- Usa ÚNICAMENTE el contexto entregado. No inventes datos del cliente (cifras, nombres, fechas, presupuestos, compromisos). Si falta un dato, dilo o pregúntalo.
- Escribe en español, con tono profesional y directo.
- Las notas del vendedor son la fuente de verdad; no las contradigas sin decirlo.`

const FORMATO_HTML = `El contenido va como HTML simple, usando SOLO estas etiquetas: <p>, <h2>, <h3>, <ul>, <ol>, <li> (con <p> adentro), <strong>, <em>. Sin atributos, sin estilos, sin markdown.`

function extraerJson(t: string): Record<string, unknown> | null {
  const s = t.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  try { return JSON.parse(s) } catch {}
  const ini = s.indexOf('{')
  if (ini < 0) return null
  let depth = 0
  for (let i = ini; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}') { depth--; if (depth === 0) { try { return JSON.parse(s.slice(ini, i + 1)) } catch { return null } } }
  }
  return null
}

const opcionesDe = (v: unknown, max = 5): string[] =>
  Array.isArray(v) ? v.map(x => String(x)).filter(Boolean).slice(0, max) : []

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({})) as {
    modo?: 'generar' | 'mejorar' | 'asesor'; phaseKey?: string
    tab?: { name?: string; html?: string }; historial?: ChatMsg[]
  }
  const modo = body.modo
  if (modo !== 'generar' && modo !== 'mejorar' && modo !== 'asesor') return NextResponse.json({ error: 'Modo inválido.' }, { status: 400 })
  const phaseKey = String(body.phaseKey || '')
  const fase = FASES_LEAD.find(f => f.key === phaseKey)
  if (!fase) return NextResponse.json({ error: 'Fase desconocida.' }, { status: 400 })

  const ctx = await contextoLead(id, phaseKey)
  if (!ctx) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

  const historial: ChatMsg[] = (Array.isArray(body.historial) ? body.historial : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
  const tabNombre = (body.tab?.name || 'Nota').slice(0, 60)
  const tabTexto = htmlATextoPlano(String(body.tab?.html || '')).slice(0, 8000)

  let system: string
  if (modo === 'generar') {
    system = `${BASE}

Tu tarea: redactar el contenido de la pestaña «${tabNombre}» de la fase «${fase.label}» del lead. Una nota de esta fase normalmente recoge: ${fase.guia}.

Contexto del lead:
${ctx.texto}

Contenido actual de la pestaña «${tabNombre}» (puede estar vacío):
${tabTexto || '(vacía)'}

Reglas de la entrevista:
1. OBLIGATORIO: en el primer turno (cuando aún no hay respuestas de la persona) haz UNA pregunta concreta sobre un dato que el contexto NO responde y que cambiaría el contenido. No generes el contenido final en el primer turno.
2. Una sola pregunta por turno, breve. Máximo 3 preguntas en total; desde la segunda respuesta puedes generar si ya tienes lo suficiente. Genera también si la persona pide generar ya o dice que no sabe.
3. Cada vez que preguntes, ofrece EXACTAMENTE 5 respuestas posibles, distintas y utilizables tal cual.
4. El contenido final debe aprovechar el contexto (no repitas lo obvio), ser útil para el siguiente paso de la venta y marcar como "Por confirmar" TODO lo que no esté en el contexto ni te haya dicho la persona (asistentes, fechas, qué se mostró o se acordó): jamás lo des por hecho. Si la persona pidió generar ya sin responder tus preguntas, redáctalo como borrador prudente. ${FORMATO_HTML}
5. Devuelve SIEMPRE y SOLO un objeto JSON, sin markdown ni texto alrededor:
   - Preguntar: {"tipo": "pregunta", "mensaje": "string", "opciones": ["string", "string", "string", "string", "string"]}
   - Contenido final: {"tipo": "contenido", "valor": "<HTML>"}`
  } else if (modo === 'mejorar') {
    system = `${BASE}

Tu tarea: MEJORAR el texto de la pestaña «${tabNombre}» de la fase «${fase.label}», siguiendo lo que la persona te diga (que no se entiende, que algo sobra, que falta detalle, que el tono no sirve, que es muy largo, etc.).

Contexto del lead:
${ctx.texto}

Texto ACTUAL de la pestaña «${tabNombre}» (es lo que hay que corregir):
${tabTexto || '(vacío)'}

Reglas:
1. Aplica EXACTAMENTE lo pedido y conserva todo lo que no critica; no reescribas todo si solo pidió tocar una parte.
2. No inventes datos que no estén en el texto o el contexto. Si para aplicar el pedido falta un dato, haz UNA pregunta en vez de inventarlo.
3. Si el pedido es claro, devuelve directamente el texto corregido. Pregunta solo si es ambiguo, y nunca más de una pregunta seguida.
4. "cambios" resume en 1 o 2 frases qué modificaste. El "valor" es el texto COMPLETO ya corregido, no solo lo modificado. ${FORMATO_HTML}
5. Devuelve SIEMPRE y SOLO un objeto JSON, sin markdown ni texto alrededor:
   - Texto corregido: {"tipo": "contenido", "valor": "<HTML>", "cambios": "string"}
   - Aclarar: {"tipo": "pregunta", "mensaje": "string", "opciones": ["string", "string", "string", "string", "string"]}`
  } else {
    system = `${BASE}

Tu tarea: conversar con quien lleva este lead y ayudarle en TODO el proceso: qué falta en cada fase, siguiente paso concreto, riesgos y objeciones, cómo prepararse para una reunión o demo, cómo enfocar la propuesta y la negociación, y redactar mensajes o correos al cliente cuando lo pida.

Contexto completo del lead:
${ctx.texto}

Texto de la pestaña «${tabNombre}» que se está viendo (fase «${fase.label}»):
${tabTexto || '(vacío)'}

Reglas:
- Sé concreto y accionable: nada de consejos genéricos. Apóyate en los datos del contexto y cítalos ("según la nota de Diagnóstico…").
- Si algo importante no está en el contexto, dilo y sugiere cómo averiguarlo. Si te piden fechas o plazos, parte de la fecha de hoy.
- Respuestas de máximo unas 250 palabras. Texto plano con saltos de línea; para listas usa "- ". Sin markdown pesado.
- Si te piden un mensaje o correo, entrégalo listo para copiar, sin inventar datos.
- Devuelve SIEMPRE y SOLO un objeto JSON, sin markdown ni texto alrededor:
  {"tipo": "respuesta", "mensaje": "string", "opciones": ["seguimiento corto 1", "seguimiento corto 2", "seguimiento corto 3"]}
  ("opciones": entre 3 y 4 preguntas o acciones de seguimiento útiles, de máximo 60 caracteres cada una)`
  }

  const mensajes: ChatMsg[] = historial.length > 0 ? historial : [{
    role: 'user',
    content: modo === 'generar' ? 'Empieza la entrevista: haz tu primera pregunta.' : 'Hola, ¿en qué me puedes ayudar con este lead?',
  }]

  try {
    const salida = await callOpenCodeMessages(system, mensajes, `lead-ai-${id}-${phaseKey}-${modo}`, { maxTokens: 2800, timeoutMs: 120_000 })
    const j = extraerJson(salida)

    if (modo === 'asesor') {
      // Si el modelo no respeto el JSON, se usa su texto tal cual en vez de fallar
      const mensaje = j && typeof j.mensaje === 'string' && j.mensaje.trim() ? j.mensaje.trim() : salida.trim()
      return NextResponse.json({ tipo: 'respuesta', mensaje, opciones: j ? opcionesDe(j.opciones, 4) : [] })
    }

    if (!j || (j.tipo !== 'pregunta' && j.tipo !== 'contenido')) {
      return NextResponse.json({ error: 'No se pudo interpretar la respuesta de la IA. Inténtalo de nuevo.' }, { status: 502 })
    }
    if (j.tipo === 'pregunta') {
      const mensaje = typeof j.mensaje === 'string' ? j.mensaje.trim() : ''
      if (!mensaje) return NextResponse.json({ error: 'La IA no devolvió la pregunta. Inténtalo de nuevo.' }, { status: 502 })
      return NextResponse.json({ tipo: 'pregunta', mensaje, opciones: opcionesDe(j.opciones) })
    }
    const html = sanearHtml(typeof j.valor === 'string' ? j.valor : '')
    if (!htmlATextoPlano(html)) return NextResponse.json({ error: 'La IA devolvió un contenido vacío. Inténtalo de nuevo.' }, { status: 502 })
    return NextResponse.json({ tipo: 'contenido', valor: html, cambios: typeof j.cambios === 'string' ? j.cambios.trim() : '' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[leads/ai-chat]', msg.slice(0, 400))
    const amable = /timeout|aborted/i.test(msg) ? 'La IA tardó demasiado en responder. Inténtalo de nuevo.'
      : /\b50[0-9]\b/.test(msg) ? 'El proveedor de IA no está disponible ahora mismo (error temporal). Inténtalo de nuevo en un momento.'
      : msg
    return NextResponse.json({ error: amable }, { status: 502 })
  }
}
