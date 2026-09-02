import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

const execFileAsync = promisify(execFile)

const PORTAL_REPO_PATH = path.resolve(process.cwd())
const EXTERNAL_REPOS_DIR = '/root/repos'
const GITHUB_ORG = process.env.GITHUB_ORG ?? 'Architech-IA'

export interface RepoConfig {
  /** Ruta local del repo donde este motor debe crear worktrees/ramas. */
  repoPath: string
  /** Identificador corto de a qué repo corresponde (solo para logging). */
  repoSlug: string
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 })
  return stdout
}

async function githubApi(urlPath: string, opts: RequestInit = {}): Promise<Response> {
  const token = process.env.GITHUB_TOKEN
  return fetch(`https://api.github.com${urlPath}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  })
}

/**
 * Crea el repo en GitHub bajo GITHUB_ORG si todavía no existe, y lo clona
 * localmente en EXTERNAL_REPOS_DIR/<repositorio>. Se usa auto_init:true al
 * crearlo para que nazca con un commit inicial en main — sin eso,
 * ensureSprintIntegrationBranch no tiene de dónde ramificar (un repo
 * completamente vacío no tiene ninguna rama todavía).
 *
 * Idempotente: si el repo ya está clonado localmente, no vuelve a tocar
 * GitHub. Solo se llama para Soluciones cuyo `repositorio` es distinto de
 * "portal-architechia" (ver resolveRepoConfig) — el dimensionamiento
 * "portal vs. producto independiente" lo pregunta Orión en el Kickoff.
 */
async function ensureExternalRepo(repositorio: string): Promise<string> {
  const localPath = path.join(EXTERNAL_REPOS_DIR, repositorio)
  if (fs.existsSync(localPath)) return localPath

  fs.mkdirSync(EXTERNAL_REPOS_DIR, { recursive: true })

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error(
      `No se puede crear/clonar el repositorio independiente "${repositorio}": falta GITHUB_TOKEN en el entorno.`
    )
  }

  const checkRes = await githubApi(`/repos/${GITHUB_ORG}/${repositorio}`)
  if (checkRes.status === 404) {
    const createRes = await githubApi(`/orgs/${GITHUB_ORG}/repos`, {
      method: 'POST',
      body: JSON.stringify({
        name: repositorio,
        private: true,
        auto_init: true,
        description: 'Producto/demo independiente generado por el Motor Agéntico SDD de ArchiTechIA',
      }),
    })
    if (!createRes.ok) {
      throw new Error(
        `No se pudo crear el repositorio ${GITHUB_ORG}/${repositorio} en GitHub: ${createRes.status} ${await createRes.text()}`
      )
    }
  } else if (!checkRes.ok) {
    throw new Error(`Error consultando el repositorio ${GITHUB_ORG}/${repositorio} en GitHub: ${checkRes.status}`)
  }

  await execFileAsync(
    'git',
    ['clone', `https://${token}@github.com/${GITHUB_ORG}/${repositorio}.git`, localPath],
    { maxBuffer: 10 * 1024 * 1024 }
  )
  // El token queda embebido en la URL solo durante el clone (necesario para
  // autenticar sobre HTTPS) — se reescribe el remote sin él para que no
  // quede en texto plano en .git/config del checkout local.
  await git(['remote', 'set-url', 'origin', `https://github.com/${GITHUB_ORG}/${repositorio}.git`], localPath)

  // Si el repo tiene package.json (por ejemplo si alguien ya empezó a
  // scaffoldearlo a mano), instala dependencias una vez acá — así los
  // worktrees de cada tarea pueden symlinkear node_modules en vez de
  // instalar de nuevo por tarea. Si no hay package.json (repo recién creado
  // por auto_init, solo con un README), no hay nada que instalar todavía;
  // la primera tarea de tipo CODE de esa Solución es la que trae el
  // package.json inicial.
  if (fs.existsSync(path.join(localPath, 'package.json'))) {
    try {
      await execFileAsync('npm', ['install'], { cwd: localPath, maxBuffer: 20 * 1024 * 1024 })
    } catch (err) {
      console.error(`[REPO_CONFIG] npm install falló en ${repositorio} (no bloqueante):`, err)
    }
  }

  return localPath
}

/**
 * Resuelve dónde debe vivir el código de una tarea/sprint según la
 * Solución a la que pertenece. Por default (o si la Solución no especifica
 * repositorio, o dice explícitamente "portal-architechia") usa el propio
 * repo del portal — el proceso donde corre este mismo motor. Si la
 * Solución se definió como producto/demo/MVP independiente (dimensionamiento
 * que Orión pregunta en el Kickoff, ver src/app/api/council/chat/route.ts),
 * crea/clona ese repo aparte y todo el ciclo de worktrees + PR de esa
 * Solución opera ahí, nunca contra el portal.
 */
export async function resolveRepoConfig(solucionId: string | null): Promise<RepoConfig> {
  if (!solucionId) return { repoPath: PORTAL_REPO_PATH, repoSlug: 'portal' }

  const rows = await prisma.$queryRawUnsafe<{ repositorio: string | null }[]>(
    `SELECT repositorio FROM "Solucion" WHERE id = $1`, solucionId
  )
  const repositorio = rows[0]?.repositorio?.trim()
  if (!repositorio || repositorio === 'portal-architechia') {
    return { repoPath: PORTAL_REPO_PATH, repoSlug: 'portal' }
  }

  const repoPath = await ensureExternalRepo(repositorio)
  return { repoPath, repoSlug: repositorio }
}
