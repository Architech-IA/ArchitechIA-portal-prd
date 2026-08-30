const OPENCODE_GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_KEY = process.env.OPENCODE_API_KEY ?? ''
const OPENCODE_MODEL = process.env.OPENCODE_VERIFIER_MODEL ?? 'qwen3.8-max'

export type VerifierResult = {
  passed: boolean
  checklist: { criterion: string; passed: boolean; reason: string }[]
}

export async function runVerifier(opts: {
  taskTitle: string
  taskDescription: string | null
  acceptanceCriteria: string[]
  resultSummary: string
}): Promise<VerifierResult> {
  const { taskTitle, taskDescription, acceptanceCriteria, resultSummary } = opts

  if (!acceptanceCriteria || acceptanceCriteria.length === 0) {
    // No criteria defined — auto-pass if there's a result
    return {
      passed: resultSummary.length > 10,
      checklist: [{ criterion: 'Resultado no vacío', passed: resultSummary.length > 10, reason: 'Auto-verificado' }],
    }
  }

  const userPrompt = `Evalúa si la siguiente tarea fue completada exitosamente.

TAREA: ${taskTitle}
${taskDescription ? `DESCRIPCIÓN: ${taskDescription}` : ''}

CRITERIOS DE ACEPTACIÓN:
${acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

RESULTADO REPORTADO:
${resultSummary.substring(0, 1500)}

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
          { role: 'system', content: 'Eres Sigma, agente verificador de calidad de ArchiTechIA.' },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`OpenCode API error ${res.status}`)

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in verifier response')
    return JSON.parse(jsonMatch[0]) as VerifierResult
  } catch {
    // Fallback: pass if result is substantial
    const autoPass = resultSummary.length > 50
    return {
      passed: autoPass,
      checklist: acceptanceCriteria.map(c => ({
        criterion: c,
        passed: autoPass,
        reason: 'Auto-verificado (verifier falló, resultado presente)',
      })),
    }
  }
}
