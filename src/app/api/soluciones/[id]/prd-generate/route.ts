import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const OPENCODE_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_KEY = process.env.OPENCODE_API_KEY ?? ''
const MODEL = 'opencode-go/kimi-k2.5'

const SECCIONES_POR_TIPO: Record<string, string[]> = {
  DEMO: ['problema', 'objetivo', 'fueraDeAlcance', 'requisitos'],
  PROJECT: ['problema', 'objetivo', 'fueraDeAlcance', 'requisitos', 'metricas', 'riesgos', 'personas', 'supuestos'],
  PARTNERSHIP: ['problema', 'objetivo', 'fueraDeAlcance', 'requisitos', 'metricas', 'riesgos', 'personas', 'supuestos'],
  INTERN: ['problema', 'objetivo', 'fueraDeAlcance', 'requisitos', 'personas', 'supuestos'],
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const solucion = await prisma.solucion.findUnique({ where: { id } })
  if (!solucion) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const secciones = SECCIONES_POR_TIPO[solucion.tipo] ?? SECCIONES_POR_TIPO.PROJECT
  const contexto = [
    `Nombre: ${solucion.nombre}`,
    solucion.descripcion ? `Descripción: ${solucion.descripcion}` : null,
    `Tipo de Solución: ${solucion.tipo}`,
    solucion.planTrabajo ? `Plan de trabajo:\n${solucion.planTrabajo}` : null,
  ].filter(Boolean).join('\n\n')

  const tieneContexto = Boolean(solucion.descripcion?.trim() || solucion.planTrabajo?.trim())

  const systemPrompt = `Sos un analista de producto que redacta borradores de PRD (Product Requirements Document) para ArchiTechIA, una consultora de IA.
Con el contexto que te den, generá un borrador de PRD en español, conciso y concreto — nunca genérico o de relleno.
Devolvé SOLO un objeto JSON (sin markdown, sin texto alrededor) con esta forma exacta:
{
  "problema": "string",
  "objetivo": "string",
  "fueraDeAlcance": "string",
  "requisitos": [ { "tipo": "historia" | "caso_uso", "texto": "string", "criterioAceptacion": "string" } ],
  "metricas": "string",
  "riesgos": "string",
  "personas": "string",
  "supuestos": "string"
}
Incluí SOLO estas claves (usá string vacío "" para las que no apliquen): ${secciones.join(', ')}.
Generá entre 3 y 6 requisitos como historias de usuario (formato "Como [rol], quiero [acción], para [beneficio]"), cada uno con su criterio de aceptación concreto.
Si el contexto es escaso, hacé tu mejor inferencia razonable a partir del nombre y tipo de Solución, pero no inventes detalles muy específicos (nombres de personas, cifras exactas) que no estén en el contexto.`

  try {
    const upstream = await fetch(OPENCODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENCODE_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generá el borrador de PRD con este contexto:\n\n${contexto || '(sin contexto adicional — solo el nombre y tipo de Solución)'}` },
        ],
        max_tokens: 2048,
      }),
    })
    if (!upstream.ok) {
      return NextResponse.json({ error: 'El modelo no respondió correctamente.' }, { status: 502 })
    }
    const data = await upstream.json()
    const content = data?.choices?.[0]?.message?.content ?? ''
    const parsed = extractJsonObject(content) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json({ error: 'No se pudo interpretar la respuesta del modelo.' }, { status: 502 })
    }
    return NextResponse.json({ prd: parsed, tieneContexto })
  } catch {
    return NextResponse.json({ error: 'Error al generar el PRD con IA.' }, { status: 500 })
  }
}
