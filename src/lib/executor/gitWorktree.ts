import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const execFileAsync = promisify(execFile)
const WORKTREES_DIR = '/root/worktrees'
const GIT_IDENTITY = ['-c', 'user.email=masd@architechia.local', '-c', 'user.name=Motor Agéntico SDD']

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 })
  return stdout
}

export function sprintBranchName(sprintCode: string): string {
  return `masd/sprint-${sprintCode}`
}
export function taskBranchName(taskCode: string): string {
  return `masd/${taskCode}`
}
export function sprintWorktreePath(sprintCode: string): string {
  return path.join(WORKTREES_DIR, `sprint-${sprintCode}`)
}
export function taskWorktreePath(taskCode: string): string {
  return path.join(WORKTREES_DIR, taskCode)
}

export class MergeConflictError extends Error {
  conflictedFiles: string[]
  taskBranch: string
  constructor(taskBranch: string, conflictedFiles: string[]) {
    super(`Conflicto real al mergear ${taskBranch}: ${conflictedFiles.join(', ') || '(sin detalle)'}`)
    this.name = 'MergeConflictError'
    this.taskBranch = taskBranch
    this.conflictedFiles = conflictedFiles
  }
}

async function branchExists(branch: string, repoRoot: string): Promise<boolean> {
  try {
    await git(['rev-parse', '--verify', branch], repoRoot)
    return true
  } catch {
    return false
  }
}

/**
 * Asegura que exista la rama y el worktree de integración del sprint
 * (masd/sprint-<code>), ramificada desde main la primera vez que una tarea
 * CODE del sprint se dispara. Este worktree vive en un directorio aparte
 * (/root/worktrees/sprint-<code>) — nunca se toca el working tree principal
 * de `repoRoot` (que en el caso del portal es donde corre el servidor
 * Next.js en vivo).
 *
 * `repoRoot` es el repo LOCAL contra el que se opera — el del portal, o el
 * de un producto/demo independiente (ver repoConfig.ts / resolveRepoConfig)
 * según a qué Solución pertenezca el sprint. Antes esta función siempre
 * asumía el repo del proceso (process.cwd()); ahora cada llamador resuelve
 * primero el repo correcto y lo pasa explícitamente — así el mismo motor de
 * auto-dispatch puede crear worktrees/ramas/PRs contra cualquier repo, no
 * solo contra portal-architechia.
 */
export async function ensureSprintIntegrationBranch(sprintCode: string, repoRoot: string): Promise<{ branch: string; worktreePath: string }> {
  const branch = sprintBranchName(sprintCode)
  const wtPath = sprintWorktreePath(sprintCode)
  fs.mkdirSync(WORKTREES_DIR, { recursive: true })
  if (!(await branchExists(branch, repoRoot))) {
    await git(['branch', branch, 'main'], repoRoot)
  }
  if (!fs.existsSync(wtPath)) {
    await git(['worktree', 'add', wtPath, branch], repoRoot)
  }
  return { branch, worktreePath: wtPath }
}

/**
 * Crea un worktree aislado para una tarea CODE, ramificado desde baseRef.
 * baseRef es la rama de integración del sprint, o la rama de otra tarea de
 * la que ésta depende (dependsOnTaskId) si ya existe — así la tarea
 * dependiente ve de verdad los archivos que escribió la anterior, no solo
 * su resultado en texto (eso ya lo resuelve buildTaskContext aparte).
 */
export async function createTaskWorktree(taskCode: string, baseRef: string, repoRoot: string): Promise<{ branch: string; worktreePath: string }> {
  const branch = taskBranchName(taskCode)
  const wtPath = taskWorktreePath(taskCode)
  fs.mkdirSync(WORKTREES_DIR, { recursive: true })
  if (fs.existsSync(wtPath)) {
    await git(['worktree', 'remove', wtPath, '--force'], repoRoot).catch(() => {})
  }
  if (await branchExists(branch, repoRoot)) {
    await git(['branch', '-D', branch], repoRoot).catch(() => {})
  }
  await git(['worktree', 'add', '-b', branch, wtPath, baseRef], repoRoot)

  // node_modules no es parte del historial git — sin esto, tsc/npx no
  // tendrian nada que ejecutar dentro del worktree. Symlink al real en vez
  // de instalar de nuevo por tarea (mismas dependencias, no cambian). Si el
  // repo (ej. uno independiente recien creado) todavia no tiene
  // node_modules propio, no hay nada que symlinkear todavia — la propia
  // tarea CODE es la que va a traer el primer package.json.
  const realNodeModules = path.join(repoRoot, 'node_modules')
  const nodeModulesLink = path.join(wtPath, 'node_modules')
  if (fs.existsSync(realNodeModules) && !fs.existsSync(nodeModulesLink)) {
    fs.symlinkSync(realNodeModules, nodeModulesLink, 'dir')
  }

  return { branch, worktreePath: wtPath }
}

/**
 * Al cerrar una tarea CODE en DONE: commitea lo que haya en su worktree (si
 * hubo cambios reales) y lo mergea a la rama de integración del sprint.
 *
 * Si el merge tiene un CONFLICTO REAL (dos tareas del mismo sprint tocaron
 * el mismo archivo de forma incompatible), NO se traga el error: aborta el
 * merge para dejar el worktree del sprint limpio, y tira MergeConflictError
 * con los archivos en conflicto — el worktree de la TAREA se deja intacto
 * (no se borra) para que el codigo no se pierda y quede disponible para
 * resolucion manual. El llamador (finalizeExecution) es responsable de NO
 * dejar la tarea como DONE si esto pasa — antes se tragaba el error acá
 * mismo y la tarea quedaba DONE aunque su codigo nunca llegara al sprint.
 */
export async function commitAndMergeTask(opts: {
  taskCode: string
  taskWorktreePath: string
  taskBranch: string
  sprintWorktreePath: string
  repoRoot: string
}): Promise<{ merged: boolean }> {
  const { taskCode, taskWorktreePath, taskBranch, sprintWorktreePath, repoRoot } = opts

  const status = await git(['status', '--porcelain'], taskWorktreePath)
  if (status.trim().length > 0) {
    await git(['add', '-A'], taskWorktreePath)
    await git([...GIT_IDENTITY, 'commit', '-m', `${taskCode}: cambios generados por el agente`], taskWorktreePath)
  }

  let merged = false
  const log = await git(['log', `main..${taskBranch}`, '--oneline'], repoRoot)
  if (log.trim().length > 0) {
    try {
      await git([...GIT_IDENTITY, 'merge', '--no-ff', taskBranch, '-m', `Merge ${taskCode} a la rama de integración del sprint`], sprintWorktreePath)
      merged = true
    } catch {
      // git merge devuelve exit code != 0 en conflicto real (execFile tira
      // excepcion). Confirmar que es un conflicto de verdad (no otra falla)
      // listando los archivos sin resolver, y dejar todo en estado limpio.
      const conflicted = await git(['diff', '--name-only', '--diff-filter=U'], sprintWorktreePath)
      const conflictedFiles = conflicted.split('\n').map((f) => f.trim()).filter(Boolean)
      await git(['merge', '--abort'], sprintWorktreePath).catch(() => {})
      throw new MergeConflictError(taskBranch, conflictedFiles)
    }
  }

  // Solo se borra el worktree de la tarea si de verdad se integro (o no
  // habia nada que integrar). Si hubo conflicto, ya se tiro la excepcion
  // arriba y esta linea no se alcanza — el worktree/rama de la tarea queda
  // vivo para revision manual.
  await git(['worktree', 'remove', taskWorktreePath, '--force'], repoRoot).catch(() => {})
  return { merged }
}

/** Ante una tarea FAILED: solo borra el worktree, sin mergear nada. */
export async function discardTaskWorktree(taskWorktreePath: string, repoRoot: string): Promise<void> {
  await git(['worktree', 'remove', taskWorktreePath, '--force'], repoRoot).catch(() => {})
}

/**
 * Abre (o reutiliza si ya existe) el PR de la rama de integración del
 * sprint hacia main. Nunca mergea sola — el merge a main siempre queda
 * para revisión humana.
 *
 * El owner/repo de GitHub se derivan del remote "origin" del propio
 * `repoRoot` — funciona igual para el portal que para cualquier repo
 * independiente clonado por ensureExternalRepo (repoConfig.ts), sin
 * necesidad de que este archivo sepa nada sobre qué repo es cada uno.
 */
export async function openSprintPR(opts: {
  sprintBranch: string
  sprintWorktreePath: string
  title: string
  body: string
  repoRoot: string
}): Promise<{ url: string } | null> {
  const { sprintBranch, sprintWorktreePath, title, body, repoRoot } = opts
  await git(['push', '-u', 'origin', sprintBranch, '--force'], sprintWorktreePath)

  const remoteUrl = (await git(['remote', 'get-url', 'origin'], repoRoot)).trim()
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/)
  if (!match) return null
  const [, owner, repo] = match

  const token = process.env.GITHUB_TOKEN
  if (!token) return null

  const existingRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${sprintBranch}&state=open`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
  )
  const existing = await existingRes.json()
  if (Array.isArray(existing) && existing.length > 0) {
    return { url: existing[0].html_url }
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, head: sprintBranch, base: 'main' }),
  })
  if (!res.ok) {
    throw new Error(`GitHub API error creando PR: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  return { url: data.html_url }
}
