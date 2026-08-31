import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type RealCheckResult = {
  ran: boolean
  passed: boolean
  errors: string[]
}

/**
 * Corre `tsc --noEmit` REAL sobre el repo y se fija si alguno de los errores
 * de compilación menciona un archivo que esta tarea escribió de verdad
 * (según el toolLog de write_file). No es una opinión de un LLM leyendo el
 * diff — es el compilador de TypeScript diciendo si el código compila.
 *
 * Antes de esto, el único "testing" de una tarea CODE era que un modelo
 * leyera el resultado y opinara si estaba bien — nunca se corrió el código
 * ni se verificó que compilara.
 *
 * Si la tarea no escribió ningún .ts/.tsx (ej. un .html suelto, o es una
 * tarea LLM sin herramientas), no aplica — se devuelve passed:true sin
 * correr nada, para no bloquear tareas que no son de código TypeScript.
 */
export async function runRealCodeChecks(
  toolLog: { tool: string; args: Record<string, unknown> }[] | undefined,
  repoRoot: string
): Promise<RealCheckResult> {
  const writtenFiles = (toolLog ?? [])
    .filter((t) => t.tool === 'write_file' && typeof t.args?.rel_path === 'string')
    .map((t) => t.args.rel_path as string)
    .filter((f) => /\.(ts|tsx)$/.test(f))

  if (writtenFiles.length === 0) {
    return { ran: false, passed: true, errors: [] }
  }

  try {
    await execFileAsync('npx', ['tsc', '--noEmit'], {
      cwd: repoRoot,
      timeout: 180_000,
      maxBuffer: 10 * 1024 * 1024,
    })
    return { ran: true, passed: true, errors: [] }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    const output = e.stdout || e.stderr || e.message || String(err)
    const relevantLines = output
      .split('\n')
      .filter((line) => writtenFiles.some((f) => line.includes(f)))
    return {
      ran: true,
      passed: relevantLines.length === 0,
      errors: relevantLines.length > 0 ? relevantLines : [output.substring(0, 2000)],
    }
  }
}
