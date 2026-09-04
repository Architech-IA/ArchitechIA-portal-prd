import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// La autenticacion server-to-server la resuelve src/proxy.ts via header
// x-api-key === INTERNAL_API_KEY, mismo mecanismo que el resto de
// /api/executor/*. Este endpoint NUNCA llama a finalizeExecution — un plan
// propuesto es de solo lectura, no toca BacklogItem.status.

// El modelo a veces envuelve el JSON en fences de markdown pese a que el
// system prompt le pide texto plano — se ve en vivo con modelos "razonadores"
// que agregan comentario alrededor aunque se les pida explícitamente que no
// lo hagan. Se extrae el primer objeto {...} balanceado en vez de confiar en
// que la respuesta entera sea JSON parseable tal cual.
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const { execId, status, resultSummary } = body
  if (!execId || !status) {
    return NextResponse.json({ error: 'execId y status son requeridos' }, { status: 400 })
  }
  if (status !== 'DONE' && status !== 'FAILED') {
    return NextResponse.json({ error: 'status debe ser DONE o FAILED' }, { status: 400 })
  }

  const parsed = status === 'DONE' && typeof resultSummary === 'string' ? extractJsonObject(resultSummary) : null
  const planJson = parsed && typeof parsed === 'object' && Array.isArray((parsed as { pasos?: unknown }).pasos)
    ? parsed
    : null

  // Si el agente terminó DONE pero no se pudo parsear un plan bien formado,
  // no se descarta la respuesta: se guarda igual como texto (planJson en
  // null) para que la UI caiga a mostrar texto libre en vez de la lista de
  // pasos estructurada.
  await prisma.$executeRawUnsafe(
    `UPDATE "TaskRemediationPlan" SET status = $2, resultado = $3, "planJson" = $4::jsonb, "updatedAt" = NOW() WHERE "execId" = $1`,
    execId, status, resultSummary ?? '', planJson ? JSON.stringify(planJson) : null
  )
  return NextResponse.json({ ok: true })
}
