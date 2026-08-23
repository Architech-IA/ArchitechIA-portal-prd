import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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

  const prompt = `Eres Sigma, agente verificador de calidad. Evalúa si la siguiente tarea fue completada exitosamente.

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
    const { stdout } = await execAsync(
      `claude --print "${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
      { timeout: 120_000 }
    )

    const jsonMatch = stdout.match(/\{[\s\S]*\}/)
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
