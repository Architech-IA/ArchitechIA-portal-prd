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

// GITHUB_ORG puede ser una Organización real de GitHub o, como es el caso hoy (Architech-IA es
// una cuenta de tipo User, no Org), la cuenta del propio usuario dueño del token. Los dos casos
// crean un repo por endpoints DISTINTOS (POST /orgs/{org}/repos vs POST /user/repos) — usar el
// de Organización contra una cuenta de tipo User siempre da 404, sin importar el nombre ni el
// token. Bug real encontrado end-to-end probando la herramienta crear_repositorio del asistente
// de Proyectos: la creación automática de repos nunca había funcionado. Se resuelve una sola vez
// y se cachea en memoria del proceso (no cambia mientras el server esté arriba).
let cuentaEsUser: boolean | null = null
async function esCuentaDeUsuario(): Promise<boolean> {
  if (cuentaEsUser !== null) return cuentaEsUser
  const res = await githubApi('/user')
  if (!res.ok) { cuentaEsUser = false; return false } // si no se puede resolver, se asume Org (comportamiento previo)
  const data = await res.json()
  cuentaEsUser = data.type === 'User' && String(data.login).toLowerCase() === GITHUB_ORG.toLowerCase()
  return cuentaEsUser
}

/**
 * Convierte cualquier texto (ej. el nombre de la Solución) en un nombre válido de repo de
 * GitHub: minúsculas, solo [a-z0-9-], sin guiones repetidos ni en las puntas, acotado a 60
 * caracteres (el límite real de GitHub es 100, pero un nombre así de largo ya sería un error).
 */
export function slugRepo(texto: string): string {
  const s = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return s.slice(0, 60) || 'proyecto'
}

/**
 * Crea el repo en GitHub bajo GITHUB_ORG si todavía no existe, y lo clona
 * localmente en EXTERNAL_REPOS_DIR/<repositorio>. Se usa auto_init:true al
 * crearlo para que nazca con un commit inicial en main — sin eso,
 * ensureSprintIntegrationBranch no tiene de dónde ramificar (un repo
 * completamente vacío no tiene ninguna rama todavía).
 *
 * Idempotente: si el repo ya está clonado localmente, no vuelve a tocar
 * GitHub. Devuelve si lo tuvo que crear de cero en GitHub (creado=true) o si
 * ya existía (por acá o porque alguien lo creó a mano antes).
 */
export async function ensureExternalRepo(repositorio: string, privado = true): Promise<{ repoPath: string; creado: boolean }> {
  const localPath = path.join(EXTERNAL_REPOS_DIR, repositorio)
  if (fs.existsSync(localPath)) return { repoPath: localPath, creado: false }

  fs.mkdirSync(EXTERNAL_REPOS_DIR, { recursive: true })

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error(
      `No se puede crear/clonar el repositorio independiente "${repositorio}": falta GITHUB_TOKEN en el entorno.`
    )
  }

  const checkRes = await githubApi(`/repos/${GITHUB_ORG}/${repositorio}`)
  let creado = false
  if (checkRes.status === 404) {
    const paraUsuario = await esCuentaDeUsuario()
    const createRes = await githubApi(paraUsuario ? '/user/repos' : `/orgs/${GITHUB_ORG}/repos`, {
      method: 'POST',
      body: JSON.stringify({
        name: repositorio,
        private: privado,
        auto_init: true,
        description: 'Producto/demo independiente generado por el Motor Agéntico SDD de ArchiTechIA',
      }),
    })
    if (!createRes.ok) {
      throw new Error(
        `No se pudo crear el repositorio ${GITHUB_ORG}/${repositorio} en GitHub (${paraUsuario ? 'como cuenta de usuario' : 'como organización'}): ${createRes.status} ${await createRes.text()}`
      )
    }
    creado = true
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

  return { repoPath: localPath, creado }
}

/**
 * Crea (o reutiliza si ya existe) un repositorio de GitHub para una Solución y lo asocia —
 * usado por la herramienta crear_repositorio del asistente de Proyectos (lib/proyectos/
 * herramientas.ts), así como por cualquier otro flujo que quiera dar de alta un repo nuevo sin
 * pasar por el Hub de la Solución. Si la Solución YA tiene un repositorio asociado, no lo
 * pisa — hay que sacarlo primero a mano si de verdad se quiere reemplazar (evita perder la
 * asociación con un repo real por un error de tipeo o una confirmación ambigua del modelo).
 */
export async function crearRepositorioParaSolucion(
  solucionId: string, nombreSolicitado: string, privado = true
): Promise<{ repoName: string; url: string; creado: boolean }> {
  const [sol] = await prisma.$queryRawUnsafe<{ repositorio: string | null }[]>(
    `SELECT repositorio FROM "Solucion" WHERE id = $1`, solucionId)
  if (!sol) throw new Error('La Solución no existe.')
  if (sol.repositorio?.trim()) {
    throw new Error(`Esta Solución ya tiene un repositorio asociado (${sol.repositorio}). Si hay que cambiarlo, se saca primero a mano desde el Hub de la Solución.`)
  }

  const repoName = slugRepo(nombreSolicitado)
  const { creado } = await ensureExternalRepo(repoName, privado)
  await prisma.$executeRawUnsafe(`UPDATE "Solucion" SET repositorio = $1, "updatedAt" = NOW() WHERE id = $2`, repoName, solucionId)
  return { repoName, url: `https://github.com/${GITHUB_ORG}/${repoName}`, creado }
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
// El campo Solucion.repositorio lo carga una persona a mano desde el Hub de la Solución
// (pestaña Código/General), que pide la URL completa de GitHub (placeholder
// "https://github.com/Architech-IA/..." y lo usa como link "abrir repositorio"). Este módulo,
// en cambio, necesita solo el NOMBRE del repo (lo usa como nombre de carpeta local y como
// segmento de la API de GitHub) — antes de este fix, pegar la URL tal como pide la UI rompía
// el Motor la primera vez que corría una tarea CODE de esa Solución (intentaba clonar
// ".../Architech-IA/https://github.com/...", 404 real). Ahora acepta cualquiera de las dos
// formas: si detecta una URL de github.com, se queda solo con el "owner/repo" del final.
function nombreDeRepo(valor: string): string {
  const m = valor.match(/github\.com[:/]+([^/]+)\/([^/.]+?)(?:\.git)?\/?$/i)
  return m ? m[2] : valor
}

export async function resolveRepoConfig(solucionId: string | null): Promise<RepoConfig> {
  if (!solucionId) return { repoPath: PORTAL_REPO_PATH, repoSlug: 'portal' }

  const rows = await prisma.$queryRawUnsafe<{ repositorio: string | null }[]>(
    `SELECT repositorio FROM "Solucion" WHERE id = $1`, solucionId
  )
  const crudo = rows[0]?.repositorio?.trim()
  if (!crudo || crudo === 'portal-architechia') {
    return { repoPath: PORTAL_REPO_PATH, repoSlug: 'portal' }
  }
  const repositorio = nombreDeRepo(crudo)
  if (repositorio === 'portal-architechia') {
    return { repoPath: PORTAL_REPO_PATH, repoSlug: 'portal' }
  }

  const { repoPath } = await ensureExternalRepo(repositorio)
  return { repoPath, repoSlug: repositorio }
}
