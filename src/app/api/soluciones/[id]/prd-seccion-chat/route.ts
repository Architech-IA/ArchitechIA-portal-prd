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
    schema: `un array de ENTRE 8 Y 15 objetos (nunca menos de 8, ni siquiera en el primer intento — usá más de 12 si hace falta para cubrir todo, ver abajo) {"tipo": "historia" | "caso_uso", "texto": string, "criterioAceptacion": string (concreto y verificable, nunca algo vago como "funciona bien"), "prioridad": "MUST" | "SHOULD" | "COULD" | "WONT"}.

COBERTURA OBLIGATORIA — no es solo el flujo principal feliz, tienen que quedar representados, cuando el contexto lo justifique:
- Cada ítem de "Dentro de alcance" ya definido en el PRD (si te lo pasaron en el contexto) — ninguno puede quedar sin al menos un requisito.
- Cada rol/persona ya definido en el PRD — al menos un requisito pensado para su necesidad específica.
- El ciclo de vida completo del dato o proceso central: creación, consulta/listado, edición y baja/cancelación (no solo "crear").
- Permisos y control de acceso (quién puede hacer qué), si la Solución distingue roles.
- Validaciones y manejo de errores: qué pasa si un dato es inválido, si falla una integración externa, si hay datos duplicados o inconsistentes.
- Integraciones externas mencionadas en el contexto (APIs, otros sistemas) y qué pasa si no responden.
- Reportes, métricas o visibilidad para quien administra o supervisa (si aplica al tipo de Solución).
- Notificaciones o alertas relevantes al flujo (si aplica).
- Configuración/administración básica que el negocio necesitaría (si aplica).

No inventes secciones de alcance que no existan — cubrí SOLO lo que el contexto sugiere que aplica a esta Solución específica, pero cubrilo de verdad en vez de limitarte al caso feliz de un solo flujo.

Las prioridades tienen que estar REALMENTE repartidas entre las 4 opciones: JAMÁS pongas "MUST" en todos los ítems — como referencia, algo como un tercio MUST, un tercio SHOULD, y el resto entre COULD y WONT es una distribución realista.`,
  },
  rnf: { label: 'Requisitos no funcionales', schema: 'un array de 4-6 objetos {"categoria": "performance" | "seguridad" | "compatibilidad" | "escalabilidad" | "otro", "texto": string}' },
  metricas: { label: 'Métricas de éxito (KPIs)', schema: 'un array de 3-5 objetos {"nombre": string, "meta": string (con valor numérico concreto cuando aplique), "comoSeMide": string}' },
  riesgos: { label: 'Riesgos', schema: 'un array de 3-5 strings' },
  dependencias: { label: 'Dependencias', schema: 'un array de 3-5 strings' },
  supuestos: { label: 'Supuestos', schema: 'un array de 3-5 strings' },
  preguntasAbiertas: { label: 'Preguntas abiertas', schema: 'un array de 3-5 strings' },
  // --- Documento de Diseño Técnico (tab hermano del PRD) ---
  dt_arquitectura: { label: 'Arquitectura general', schema: 'un string de 2-4 párrafos: componentes principales, cómo se comunican entre sí y por qué se estructuran así (sin repetir el PRD: esto es el CÓMO, no el qué)' },
  dt_modelo: { label: 'Modelo de datos (entidades clave)', schema: 'un array de 4-10 objetos {"nombre": string, "atributos": string (lista separada por comas de los atributos principales), "relaciones": string (con qué otras entidades se relaciona y cardinalidad)}, derivados de los requisitos funcionales del PRD — cada entidad tiene que existir porque algún requisito la necesita' },
  dt_stack: { label: 'Stack tecnológico', schema: 'un array de 4-8 objetos {"capa": string (ej. Frontend, Backend, Base de datos, IA, Infraestructura, Observabilidad), "tecnologia": string, "justificacion": string (razón concreta ligada a un requisito o restricción del contexto, no marketing)}' },
  dt_integraciones: { label: 'Integraciones externas', schema: 'un array de 1-8 objetos {"sistema": string, "proposito": string, "detalle": string (protocolo, autenticación, formato de datos), "siFalla": string (comportamiento definido si el sistema externo no responde o devuelve error)} — solo las que el PRD/contexto realmente implican, no inventes integraciones' },
  dt_decisiones: { label: 'Decisiones técnicas clave', schema: 'un array de 3-8 objetos {"decision": string, "alternativas": string (qué otras opciones reales se evaluaron), "justificacion": string (por qué esta y no las otras, con el trade-off asumido)}' },
  dt_seguridad: { label: 'Consideraciones de seguridad', schema: 'un string de 2-4 párrafos: autenticación y autorización, manejo de datos sensibles/personales, cifrado, cumplimiento normativo aplicable y amenazas relevantes para ESTA solución' },
  dt_escalabilidad: { label: 'Escalabilidad y rendimiento', schema: 'un string de 2-4 párrafos: carga esperada, cuellos de botella previstos, cómo crece el sistema, y qué se monitorea' },
  // --- Plan de Ejecución (tercer documento del flujo) ---
  pe_qa: { label: 'Plan de pruebas / QA', schema: 'un string de 3-5 párrafos: niveles de prueba (unitarias, integración, extremo a extremo), qué se automatiza y qué es manual, cómo se verifican los criterios de aceptación y los requisitos no funcionales del PRD, cómo es el UAT con el cliente (quién, cuándo) y el criterio de salida para considerar algo listo para producción' },
  pe_ambientes: { label: 'Ambientes y despliegue', schema: 'un array de 2-4 objetos {"ambiente": string (ej. Desarrollo, Staging, Producción), "proposito": string, "despliega": string (quién y cómo despliega en ese ambiente), "promocion": string (condición concreta para promover al siguiente ambiente)}' },
  pe_release: { label: 'Estrategia de release y rollback', schema: 'un string de 2-3 párrafos: cómo se libera a producción (ventanas, por etapas o feature flags), qué se monitorea al liberar, y cuándo y cómo se revierte (criterios de rollback)' },
  pe_raci: { label: 'Equipo y roles (matriz RACI)', schema: 'un array de 6-12 objetos {"actividad": string, "responsable": string, "aprueba": string, "consultado": string, "informado": string} — usá ROLES (ej. Líder técnico, Product owner, Cliente sponsor, Agente ejecutor), no inventes nombres propios de personas; cubrí desde aprobar el PRD y el diseño hasta despliegue, QA y cierre' },
  pe_cambios: { label: 'Gestión de cambios', schema: 'un string de 2-3 párrafos: cómo se solicita, evalúa (impacto en alcance, costo y plazo), aprueba y registra un cambio de alcance; quién decide; y cómo se refleja en el PRD, el diseño técnico y el cronograma' },
  pe_comunicacion: { label: 'Comunicación con el cliente', schema: 'un array de 3-6 objetos {"que": string (qué se comunica), "audiencia": string, "frecuencia": string, "canal": string, "responsable": string}' },
}

// Que forma de "valor" espera cada seccion — usado SOLO para validar lo que
// el modelo devuelve antes de aceptarlo (ver validarValorContenido). Debe
// reflejar SECCION_INFO de arriba y valorActualDeSeccion/aplicarContenidoIA
// del frontend (pilots/[id]/page.tsx).
// 'requisito_item' es distinto a los demas: no es una seccion del PRD, es
// el DEBATE sobre UN requisito puntual ya existente (boton de IA dentro de
// cada fila R1/R2/... de Requisitos funcionales). No pasa por SECCION_INFO
// (su system prompt es otro, ver mas abajo).
type SeccionKind = 'texto' | 'lista' | 'personas' | 'requisitos' | 'rnf' | 'metricas' | 'requisito_item' | 'dt_tabla'
const SECCION_KIND: Record<string, SeccionKind> = {
  resumen: 'texto', problema: 'texto', objetivoGeneral: 'texto',
  objetivosEspecificos: 'lista', dentroDeAlcance: 'lista', fueraDeAlcance: 'lista',
  personas: 'personas', requisitos: 'requisitos', rnf: 'rnf', metricas: 'metricas',
  riesgos: 'lista', dependencias: 'lista', supuestos: 'lista', preguntasAbiertas: 'lista',
  requisito_item: 'requisito_item',
  dt_arquitectura: 'texto', dt_seguridad: 'texto', dt_escalabilidad: 'texto',
  dt_modelo: 'dt_tabla', dt_stack: 'dt_tabla', dt_integraciones: 'dt_tabla', dt_decisiones: 'dt_tabla',
  pe_qa: 'texto', pe_release: 'texto', pe_cambios: 'texto',
  pe_ambientes: 'dt_tabla', pe_raci: 'dt_tabla', pe_comunicacion: 'dt_tabla',
}

// Campos obligatorios (no vacios) por seccion-tabla del Diseño Técnico.
const DT_REQUERIDOS: Record<string, string[]> = {
  dt_modelo: ['nombre', 'atributos'],
  dt_stack: ['capa', 'tecnologia', 'justificacion'],
  dt_integraciones: ['sistema', 'proposito', 'siFalla'],
  dt_decisiones: ['decision', 'alternativas', 'justificacion'],
  pe_ambientes: ['ambiente', 'proposito', 'promocion'],
  pe_raci: ['actividad', 'responsable', 'aprueba'],
  pe_comunicacion: ['que', 'audiencia', 'frecuencia', 'responsable'],
}

// El modelo a veces devuelve tipo:"contenido" con datos incompletos (ítems
// vacíos, menos requisitos de los pedidos, todo con la misma prioridad,
// etc.) — sin esto, esa basura se aplicaba en silencio al PRD porque el
// frontend solo chequeaba que `tipo` fuera un valor válido, nunca la forma
// real de `valor`. Devuelve `null` si esta OK, o un mensaje describiendo
// que esta mal (se lo mostramos al usuario en vez de aplicar algo roto).
function validarValorContenido(seccionKey: string, valor: unknown): string | null {
  const kind = SECCION_KIND[seccionKey]
  const esTextoNoVacio = (v: unknown) => typeof v === 'string' && v.trim().length > 0

  switch (kind) {
    case 'texto':
      if (!esTextoNoVacio(valor)) return 'no devolvió texto para esta sección.'
      return null

    case 'lista': {
      if (!Array.isArray(valor) || valor.length === 0) return 'no devolvió ninguna lista de ítems.'
      if (valor.some(v => !esTextoNoVacio(v))) return 'devolvió algún ítem vacío en la lista.'
      return null
    }

    case 'personas': {
      if (!Array.isArray(valor) || valor.length === 0) return 'no devolvió ninguna persona.'
      if ((valor as Record<string, unknown>[]).some(p => !esTextoNoVacio(p?.rol) || !esTextoNoVacio(p?.necesidad))) {
        return 'devolvió alguna persona con rol o necesidad vacíos.'
      }
      return null
    }

    case 'requisitos': {
      if (!Array.isArray(valor)) return 'no devolvió una lista de requisitos.'
      if (valor.length < 8) return `devolvió solo ${valor.length} requisito(s); se esperaban al menos 8.`
      const prioridadesValidas = new Set(['MUST', 'SHOULD', 'COULD', 'WONT'])
      const items = valor as Record<string, unknown>[]
      for (const r of items) {
        if (!esTextoNoVacio(r?.texto) || !esTextoNoVacio(r?.criterioAceptacion)) {
          return 'devolvió algún requisito sin texto o sin criterio de aceptación.'
        }
        if (!prioridadesValidas.has(String(r?.prioridad))) return 'devolvió algún requisito con una prioridad inválida.'
      }
      const prioridadesUsadas = new Set(items.map(r => r.prioridad))
      if (prioridadesUsadas.size < 2) return 'devolvió todos los requisitos con la misma prioridad (sin variedad MoSCoW).'
      return null
    }

    case 'rnf': {
      if (!Array.isArray(valor) || valor.length === 0) return 'no devolvió requisitos no funcionales.'
      if ((valor as Record<string, unknown>[]).some(r => !esTextoNoVacio(r?.texto))) return 'devolvió algún requisito no funcional sin texto.'
      return null
    }

    case 'metricas': {
      if (!Array.isArray(valor) || valor.length === 0) return 'no devolvió métricas.'
      if ((valor as Record<string, unknown>[]).some(m => !esTextoNoVacio(m?.nombre))) return 'devolvió alguna métrica sin nombre.'
      return null
    }

    case 'dt_tabla': {
      if (!Array.isArray(valor) || valor.length === 0) return 'no devolvió ningún ítem para esta sección.'
      const req = DT_REQUERIDOS[seccionKey] ?? []
      for (const it of valor as Record<string, unknown>[]) {
        const faltante = req.find(c => !esTextoNoVacio(it?.[c]))
        if (faltante) return `devolvió algún ítem sin el campo "${faltante}".`
      }
      return null
    }

    // El debate de un requisito puntual ahora edita UN SOLO campo por vez
    // (texto O criterioAceptacion, nunca los dos juntos — pedido explícito
    // del usuario), asi que "valor" es directamente el string revisado de
    // ese campo, mismo shape que 'texto'.
    case 'requisito_item':
      if (!esTextoNoVacio(valor)) return 'no devolvió el contenido revisado para este campo del requisito.'
      return null

    default:
      return null
  }
}

type ChatMsg = { role: 'user' | 'assistant'; content: string }

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => ({})) as {
    seccionKey?: string; valorActual?: unknown; historial?: ChatMsg[]; itemId?: string
    // Solo aplica al debate de un requisito puntual: cuál de los dos campos
    // se está debatiendo. Nunca los dos a la vez (pedido explícito del
    // usuario — antes se editaban juntos).
    campo?: 'texto' | 'criterioAceptacion'
    // Contexto del requisito completo (el campo que NO se está debatiendo
    // ahora), para que el modelo entienda el requisito entero aunque solo
    // pueda tocar uno de los dos campos.
    contextoRequisito?: { texto?: unknown; criterioAceptacion?: unknown }
    contextoPrd?: { dentroDeAlcance?: unknown; objetivosEspecificos?: unknown; personas?: unknown; requisitos?: unknown; requisitosNoFuncionales?: unknown; stack?: unknown; integraciones?: unknown }
  }
  const seccionKey = String(body.seccionKey || '')
  const esDebateItem = seccionKey === 'requisito_item'
  const campoDebate: 'texto' | 'criterioAceptacion' = body.campo === 'criterioAceptacion' ? 'criterioAceptacion' : 'texto'
  const docLabel = seccionKey.startsWith('pe_')
    ? 'un Plan de Ejecución (cómo se organiza el equipo para ejecutar: pruebas, despliegue, roles, cambios y comunicación; complementa al PRD y al Diseño Técnico)'
    : seccionKey.startsWith('dt_')
    ? 'un Documento de Diseño Técnico (el CÓMO se construye la solución; complementa al PRD, que define el qué)'
    : 'un PRD (Product Requirements Document)'
  const campoLabel = campoDebate === 'texto' ? 'la historia de usuario / caso de uso' : 'el criterio de aceptación'
  const info = esDebateItem
    ? { label: `Requisito funcional (debate de ${campoLabel})`, schema: `un string: ${campoLabel} revisado` }
    : SECCION_INFO[seccionKey]
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

  // Solo se usa para "requisitos" — el usuario reporto que la entrevista se
  // estaba quedando corta (no cubria todo el alcance, escenarios, personas
  // ni funcionalidades ya definidas en OTRAS secciones del mismo PRD). El
  // frontend manda esto ademas del contexto de la Solucion en si.
  const asStringArray = (v: unknown): string[] => Array.isArray(v) ? v.map(x => String(x)).filter(s => s.trim()) : []
  const alcanceLista = asStringArray(body.contextoPrd?.dentroDeAlcance)
  const objetivosLista = asStringArray(body.contextoPrd?.objetivosEspecificos)
  const personasLista = asStringArray(body.contextoPrd?.personas)
  const requisitosLista = asStringArray(body.contextoPrd?.requisitos)
  const rnfLista = asStringArray(body.contextoPrd?.requisitosNoFuncionales)
  const esDiseno = seccionKey.startsWith('dt_')
  const esPlan = seccionKey.startsWith('pe_')
  const stackLista = asStringArray(body.contextoPrd?.stack)
  const integracionesLista = asStringArray(body.contextoPrd?.integraciones)

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
    seccionKey === 'requisitos' && alcanceLista.length > 0
      ? `Dentro de alcance ya definido en este PRD (CADA UNO de estos ítems tiene que quedar cubierto por al menos un requisito):\n${alcanceLista.map(t => `- ${t}`).join('\n')}`
      : null,
    seccionKey === 'requisitos' && objetivosLista.length > 0
      ? `Objetivos específicos ya definidos en este PRD:\n${objetivosLista.map(t => `- ${t}`).join('\n')}`
      : null,
    seccionKey === 'requisitos' && personasLista.length > 0
      ? `Personas/usuarios ya definidos en este PRD (cada rol relevante tiene que tener al menos un requisito pensado para su necesidad):\n${personasLista.map(t => `- ${t}`).join('\n')}`
      : null,
    (esDiseno || esPlan) && requisitosLista.length > 0
      ? `Requisitos funcionales del PRD (el diseño técnico tiene que poder sostener CADA UNO; no inventes funcionalidad que no esté acá):\n${requisitosLista.map(t => `- ${t}`).join('\n')}`
      : null,
    (esDiseno || esPlan) && rnfLista.length > 0
      ? `Requisitos no funcionales del PRD (restricciones que el diseño tiene que cumplir):\n${rnfLista.map(t => `- ${t}`).join('\n')}`
      : null,
    (esDiseno || esPlan) && alcanceLista.length > 0
      ? `Dentro de alcance del PRD:\n${alcanceLista.map(t => `- ${t}`).join('\n')}`
      : null,
    esPlan && stackLista.length > 0
      ? `Stack tecnológico definido en el Diseño Técnico:\n${stackLista.map(t => `- ${t}`).join('\n')}`
      : null,
    esPlan && integracionesLista.length > 0
      ? `Integraciones externas definidas en el Diseño Técnico (el plan de pruebas y despliegue tiene que contemplarlas):\n${integracionesLista.map(t => `- ${t}`).join('\n')}`
      : null,
  ].filter(Boolean).join('\n\n')

  const systemPrompt = esDebateItem ? `Sos un analista de producto senior que DEBATE y refina, junto con quien lo escribió, ${campoLabel} de UN requisito funcional que YA EXISTE en un PRD (Product Requirements Document) de ArchiTechIA — esto no es una entrevista para generar algo desde cero, el requisito ya está escrito y tu rol es cuestionarlo, señalar huecos concretos, y proponer mejoras puntuales.

IMPORTANTE: tu trabajo es EXCLUSIVAMENTE sobre ${campoLabel}. El otro campo del requisito NO es tuyo para modificar — se muestra abajo solo como contexto, para que tu propuesta sea coherente con el resto del requisito.

Historia de usuario / caso de uso (texto) actual:
${JSON.stringify((body.contextoRequisito?.texto ?? (campoDebate === 'texto' ? body.valorActual : null)) ?? null)}

Criterio de aceptación actual:
${JSON.stringify((body.contextoRequisito?.criterioAceptacion ?? (campoDebate === 'criterioAceptacion' ? body.valorActual : null)) ?? null)}

Contexto conocido de la Solución:
${contexto || '(sin contexto adicional — solo el nombre y tipo de Solución)'}

Reglas del debate:
1. Cada turno tuyo es UNA sola idea, siempre sobre ${campoLabel}: o señalás una debilidad concreta (ambigüedad, caso no cubierto${campoDebate === 'criterioAceptacion' ? ', algo poco medible/verificable' : ''}) y proponés una mejora puntual, o hacés una pregunta puntual si necesitás más info del usuario para refinarlo. Nunca una lista de varias objeciones juntas, y nunca propongas cambios al otro campo.
2. Generá el contenido final revisado (solo ${campoLabel}) cuando el usuario esté de acuerdo con una mejora, pida aplicar los cambios, o diga que ya está bien como está (en ese último caso, devolvé el mismo contenido, sin inventar cambios).
3. Nunca hagas más de 3 intervenciones de debate antes de ofrecer una versión final (aunque el usuario no esté de acuerdo con nada, en la 3ra ofrecé tu mejor version igual).
4. Cada vez que uses tipo "pregunta" (tu turno de debate, sea objeción o pregunta), proponé también EXACTAMENTE 5 respuestas/posturas posibles para que el usuario elija con un clic, ademas de poder escribir la propia.
5. Devolvé SIEMPRE y SOLO un objeto JSON (sin markdown, sin texto alrededor), con una de estas dos formas EXACTAS:
   - Para seguir debatiendo: {"tipo": "pregunta", "mensaje": "string", "opciones": ["string", "string", "string", "string", "string"]}
   - Para la versión final: {"tipo": "contenido", "valor": "string"}  (SOLO ${campoLabel}, un string plano, no un objeto)` : `Sos un analista de producto experto que ayuda a completar UNA sola sección de ${docLabel} para ArchiTechIA, una consultora de IA, mediante una breve entrevista conversacional — no generás de una sola vez sin preguntar si falta información clave y específica que nadie más podría inferir.

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
      : [{ role: 'user' as const, content: esDebateItem ? `Empezá el debate: dame tu primera observación u objeción sobre ${campoLabel} de este requisito.` : 'Empezá la entrevista: hacé tu primera pregunta.' }]),
  ]

  try {
    const upstream = await fetch(OPENCODE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCODE_KEY}`,
        // Estable por Solucion+seccion — evita cruzar sesiones entre
        // distintas secciones/entrevistas de un mismo PRD.
        // Estable por Solucion+seccion (o por requisito puntual, si aplica)
        // — evita cruzar sesiones entre distintas secciones/entrevistas, o
        // entre el debate de un requisito y el de otro, de un mismo PRD.
        'x-opencode-session': `prd-seccion-${id}-${seccionKey}${body.itemId ? `-${body.itemId}` : ''}${esDebateItem ? `-${campoDebate}` : ''}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        // "requisitos" ahora pide cubrir alcance/personas/CRUD/permisos/
        // errores/integraciones/reportes ademas del flujo principal, hasta
        // 15 items — 4096 se quedaba corto para eso.
        max_tokens: seccionKey === 'requisitos' ? 7168 : 4096,
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
    // Antes esto se devolvía tal cual y el frontend lo aplicaba al PRD sin
    // chequear nada mas que "tipo" — si el modelo entregaba menos ítems de
    // los pedidos, campos vacíos, o (en requisitos) todo con la misma
    // prioridad, quedaba aplicado en silencio. Ahora se valida la forma real
    // de "valor" antes de aceptarlo.
    if (parsed.tipo === 'contenido') {
      const problema = validarValorContenido(seccionKey, parsed.valor)
      if (problema) {
        console.error('prd-seccion-chat: contenido invalido', seccionKey, problema)
        return NextResponse.json({ error: `La IA generó contenido incompleto (${problema}). Probá de nuevo.` }, { status: 502 })
      }
    }
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Error al conversar con la IA para esta sección.' }, { status: 500 })
  }
}
