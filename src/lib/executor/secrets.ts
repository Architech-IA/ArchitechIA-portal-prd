import fs from 'fs'
import path from 'path'
import { slugDeploy } from './deploy'

// Variables de entorno por proyecto desplegado (MASD-0023-0006-028): un archivo .env por
// Solución, fuera de la base de datos (evita duplicar el problema de guardar secretos en
// Postgres) y con los mismos permisos que ya protegen el .env del propio portal (600, root).
// Nunca se leen valores de vuelta hacia la UI — solo nombres de variable, como hace GitHub con
// los secrets de Actions. Este módulo corre del lado Node/root, nunca dentro del sandbox de
// run_command — mismo criterio que deploy.ts.

const ENV_DIR = '/root/deploys/env'

export function envFilePath(nombreProyecto: string): string {
  fs.mkdirSync(ENV_DIR, { recursive: true, mode: 0o700 })
  return path.join(ENV_DIR, `${slugDeploy(nombreProyecto)}.env`)
}

function parseEnv(contenido: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const linea of contenido.split('\n')) {
    const t = linea.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1)
  }
  return out
}

function serializeEnv(vars: Record<string, string>): string {
  return Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
}

/** Solo los NOMBRES de variable — nunca los valores. Para mostrar en la UI. */
export function listarNombresVariables(nombreProyecto: string): string[] {
  const p = envFilePath(nombreProyecto)
  if (!fs.existsSync(p)) return []
  return Object.keys(parseEnv(fs.readFileSync(p, 'utf8')))
}

function validarNombre(nombre: string) {
  if (!/^[A-Z_][A-Z0-9_]*$/.test(nombre)) {
    throw new Error(`Nombre de variable inválido: "${nombre}" — solo MAYÚSCULAS, números y guión bajo, sin empezar con número.`)
  }
}

/** Crea o actualiza UNA variable, sin tocar las demás. */
export function guardarVariable(nombreProyecto: string, nombre: string, valor: string): void {
  validarNombre(nombre)
  const p = envFilePath(nombreProyecto)
  const vars = fs.existsSync(p) ? parseEnv(fs.readFileSync(p, 'utf8')) : {}
  vars[nombre] = valor
  fs.writeFileSync(p, serializeEnv(vars), { mode: 0o600 })
}

export function borrarVariable(nombreProyecto: string, nombre: string): void {
  const p = envFilePath(nombreProyecto)
  if (!fs.existsSync(p)) return
  const vars = parseEnv(fs.readFileSync(p, 'utf8'))
  delete vars[nombre]
  fs.writeFileSync(p, serializeEnv(vars), { mode: 0o600 })
}

/** Usado internamente por deploy.ts para pasarle DATABASE_URL, etc. sin pasar por la UI. */
export function guardarVariableInterna(nombreProyecto: string, nombre: string, valor: string): void {
  guardarVariable(nombreProyecto, nombre, valor)
}

/** Ruta al archivo, para pasarla como --env-file a "docker run" — null si el proyecto no tiene ninguna variable cargada. */
export function envFileSiExiste(nombreProyecto: string): string | null {
  const p = envFilePath(nombreProyecto)
  return fs.existsSync(p) ? p : null
}
