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
 * tarea LLM sin herramientas) NI corrió run_command (instalar/scaffolding),
 * no aplica — se devuelve passed:true sin correr nada, para no bloquear
 * tareas que no tocan código TypeScript.
 *
 * run_command (MASD-0023, herramientas 1 y 2: shell restringido + scaffolding) escribe
 * archivos directo por su cuenta (ej. npx create-next-app), sin pasar por write_file — así que
 * writtenFiles no los ve. Si se usó run_command, se corre tsc igual, y como no hay una lista de
 * "archivos que esta tarea tocó" para filtrar, se trata CUALQUIER error de tsc como relevante
 * (no hay forma de distinguir "esto ya estaba roto" de "esto lo rompió el scaffolding" sin esa
 * lista — más estricto es más seguro que dejar pasar un scaffold que no compila).
 */
export async function runRealCodeChecks(
  toolLog: { tool: string; args: Record<string, unknown> }[] | undefined,
  repoRoot: string
): Promise<RealCheckResult> {
  const writtenFiles = (toolLog ?? [])
    .filter((t) => t.tool === 'write_file' && typeof t.args?.rel_path === 'string')
    .map((t) => t.args.rel_path as string)
    .filter((f) => /\.(ts|tsx)$/.test(f))
  const usoComando = (toolLog ?? []).some((t) => t.tool === 'run_command')

  if (writtenFiles.length === 0 && !usoComando) {
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
    if (writtenFiles.length === 0) {
      // Solo hubo run_command: sin lista de archivos propios para filtrar, se reporta la salida
      // completa de tsc (acotada) como el error real.
      return { ran: true, passed: false, errors: [output.substring(0, 3000)] }
    }
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
