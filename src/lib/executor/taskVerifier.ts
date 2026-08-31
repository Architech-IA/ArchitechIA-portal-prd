const OPENCODE_GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_KEY = process.env.OPENCODE_API_KEY ?? ''
const OPENCODE_MODEL = process.env.OPENCODE_VERIFIER_MODEL ?? 'qwen3.7-max'

export type VerifierResult = {
  passed: boolean
  checklist: { criterion: string; passed: boolean; reason: string }[]
}

/**
 * Verifica si una tarea fue completada correctamente.
 *
 * IMPORTANTE: nunca usa la LONGITUD del resultado como proxy de calidad.
 * Se probo en vivo que ese criterio esta roto en los dos sentidos: aprobaba
 * placeholders vacios tipo "(sin output)" (12 caracteres, "no vacío" = pasa)
 * y reprobaba respuestas cortas pero perfectamente correctas como "#2563EB"
 * (7 caracteres, "no vacío" = falla). La longitud no mide si la respuesta
 * responde lo que se pidio.
 *
 * Si no hay criterios de aceptacion explicitos (el caso comun hoy — no hay
 * nada que los popule todavia desde el council plan), se usa el propio
 * titulo/descripcion de la tarea como criterio implicito y se le pide al
 * modelo verificador que juzgue eso, en vez de saltarse la verificacion real.
 */
export async function runVerifier(opts: {
  taskTitle: string
  taskDescription: string | null
  acceptanceCriteria: string[]
  resultSummary: string
}): Promise<VerifierResult> {
  const { taskTitle, taskDescription, resultSummary } = opts

  const criteria = opts.acceptanceCriteria?.length
    ? opts.acceptanceCriteria
    : [`El resultado responde realmente a lo que pide la tarea "${taskTitle}"${taskDescription ? `: ${taskDescription}` : ''}. No alcanza con que el resultado no este vacio — tiene que responder lo pedido.`]

  const userPrompt = `Evalúa si la siguiente tarea fue completada exitosamente. No juzgues por la longitud de la respuesta — una respuesta corta puede ser perfectamente correcta, y una respuesta larga puede no responder nada de lo pedido.

TAREA: ${taskTitle}
${taskDescription ? `DESCRIPCIÓN: ${taskDescription}` : ''}

CRITERIOS DE ACEPTACIÓN:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

RESULTADO REPORTADO:
${resultSummary.substring(0, 3000) || '(el resultado llegó vacío)'}

Responde ÚNICAMENTE con JSON válido en este formato:
{
  "passed": true/false,
  "checklist": [
    {"criterion": "...", "passed": true/false, "reason": "..."}
  ]
}
Sin markdown, sin explicación adicional. Solo el JSON.`

  try {
    const res = await fetch(OPENCODE_GO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCODE_KEY}`,
      },
      body: JSON.stringify({
        model: OPENCODE_MODEL,
        messages: [
          { role: 'system', content: 'Eres Sigma, agente verificador de calidad de ArchiTechIA. Juzgás si un resultado responde de verdad lo que se pidió, nunca por longitud del texto.' },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!res.ok) throw new Error(`OpenCode API error ${res.status}`)

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in verifier response')
    return JSON.parse(jsonMatch[0]) as VerifierResult
  } catch (err) {
    // El verificador en si no pudo correr (red caida, JSON invalido, etc).
    // Esto NO es "aprobado" ni "reprobado" por el contenido — es "no se pudo
    // verificar", y se marca como tal (passed: false + motivo explicito) en
    // vez de fingir un veredicto con un umbral de caracteres arbitrario.
    // Preferir un falso negativo (pedirle a un humano que revise algo que
    // en realidad estaba bien) es mas seguro que un falso positivo (dejar
    // pasar como DONE algo que nunca se verifico de verdad).
    const reason = `No se pudo verificar automáticamente (${err instanceof Error ? err.message : String(err)}) — requiere revisión manual`
    return {
      passed: false,
      checklist: criteria.map((c) => ({ criterion: c, passed: false, reason })),
    }
  }
}
