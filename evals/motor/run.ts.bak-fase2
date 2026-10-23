import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { dispatchTask } from '@/lib/executor/taskDispatcher'
import { sprintWorktreePath, sprintBranchName } from '@/lib/executor/gitWorktree'

// Evals del Motor Agéntico SDD (tareas de código con resultado verificable), MASD-0023-0006-014.
// Corre el pipeline REAL de principio a fin: dispatchTask -> cola del Harness -> worker (masd_worker.py,
// ya corriendo como proceso aparte) -> finalizeExecution (tsc --noEmit real + verificador semántico Sigma
// + merge a la rama de integración del sprint). No se simula nada de eso.
//
// Corre contra un repo AISLADO, solo local (/root/repos/zz-eval-motor, sin "origin" configurado a
// propósito): la Solución de este eval tiene repositorio='zz-eval-motor', así que resolveRepoConfig
// nunca toca el repo del portal. Al terminar el sprint, checkSprintCompletion intenta abrir un PR
// igual que en producción — como no hay "origin", ese intento falla mansamente (capturado por el
// propio pipeline) y no toca GitHub real. Ver evals/motor/casos.ts para el detalle de cada caso.
//
// Uso: set -a && . ./.env && set +a && npx tsx evals/motor/run.ts
const SOL_NOMBRE = 'ZZ Eval Motor Agéntico'
const REPO_SLUG = 'zz-eval-motor'
const AREA_DEV = '947ca771-fe9e-4c3f-bfea-2ef2e27986c6'
const TIMEOUT_MS = 8 * 60_000 // por tarea: el agente de código puede usar hasta 20 rondas de herramientas
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

interface Caso {
  id: string
  titulo: string
  descripcion: string
  // Corre en Node contra el .js compilado del archivo tocado, DESPUÉS del merge al sprint — es el
  // único chequeo de este set que ejecuta la lógica de verdad (ni tsc ni el verificador semántico
  // corren el código, ver hallazgo en el reporte).
  chequeoRuntime: (mod: any) => { ok: boolean; detalle: string }
}

const CASOS: Caso[] = [
  {
    id: 'facil-espar',
    titulo: 'Agregar función esPar en src/mathUtils.ts',
    descripcion: 'En el archivo src/mathUtils.ts (ya existe, con la función sumaLista), agrega una función esPar(n: number): boolean que devuelva true si n es par y false si es impar. Exportala igual que sumaLista.',
    chequeoRuntime: (m) => {
      if (typeof m.esPar !== 'function') return { ok: false, detalle: 'no exporta esPar' }
      const casos: [number, boolean][] = [[4, true], [7, false], [0, true], [-2, true], [-3, false]]
      const malos = casos.filter(([n, esp]) => m.esPar(n) !== esp)
      return { ok: malos.length === 0, detalle: malos.length ? `falló con: ${malos.map(c => c[0]).join(', ')}` : 'correcto en 5/5 casos' }
    },
  },
  {
    id: 'medio-promedio',
    titulo: 'Agregar función promedioLista en src/mathUtils.ts, reutilizando sumaLista',
    descripcion: 'En src/mathUtils.ts ya existe sumaLista(nums: number[]): number. Agrega promedioLista(nums: number[]): number que reutilice sumaLista (no reimplementes la suma) y devuelva 0 si la lista está vacía, para evitar la división por cero.',
    chequeoRuntime: (m) => {
      if (typeof m.promedioLista !== 'function') return { ok: false, detalle: 'no exporta promedioLista' }
      const a = m.promedioLista([2, 4, 6]), b = m.promedioLista([]), c = m.promedioLista([5])
      const ok = a === 4 && b === 0 && c === 5
      return { ok, detalle: `promedioLista([2,4,6])=${a} (esp. 4), ([])=${b} (esp. 0), ([5])=${c} (esp. 5)` }
    },
  },
  {
    id: 'dificil-mediana',
    titulo: 'Agregar función mediana en src/mathUtils.ts, sin mutar el array original',
    descripcion: 'En src/mathUtils.ts agrega mediana(nums: number[]): number que calcule la mediana (ordena una COPIA de la lista; nunca mutes el array que recibe como parámetro, quien la llama puede seguir usando su lista en el orden original después).',
    chequeoRuntime: (m) => {
      if (typeof m.mediana !== 'function') return { ok: false, detalle: 'no exporta mediana' }
      const impar = [5, 1, 3]; const orig = [...impar]
      const rImpar = m.mediana(impar)
      const noMuto = JSON.stringify(impar) === JSON.stringify(orig)
      const par = [4, 1, 3, 2]
      const rPar = m.mediana(par)
      const ok = rImpar === 3 && rPar === 2.5 && noMuto
      return { ok, detalle: `mediana([5,1,3])=${rImpar} (esp. 3), mediana([4,1,3,2])=${rPar} (esp. 2.5), no mutó=${noMuto}` }
    },
  },
]

async function limpiarRestosPrevios() {
  const sol = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "Solucion" WHERE nombre=$1`, SOL_NOMBRE)
  for (const s of sol) await borrarSolucion(s.id)
}

async function borrarSolucion(solucionId: string) {
  await prisma.$executeRawUnsafe(`DELETE FROM "TaskExecution" WHERE "backlogItemId" IN (SELECT id FROM "BacklogItem" WHERE "solucionId"=$1)`, solucionId)
  await prisma.$executeRawUnsafe(`DELETE FROM "SprintDecision" WHERE "sprintId" IN (SELECT s.id FROM "Sprint" s JOIN "Epic" e ON s."epicId"=e.id WHERE e."solucionId"=$1)`, solucionId)
  await prisma.$executeRawUnsafe(`DELETE FROM "BacklogItem" WHERE "solucionId"=$1`, solucionId)
  await prisma.$executeRawUnsafe(`DELETE FROM "Sprint" WHERE "epicId" IN (SELECT id FROM "Epic" WHERE "solucionId"=$1)`, solucionId)
  await prisma.$executeRawUnsafe(`DELETE FROM "Epic" WHERE "solucionId"=$1`, solucionId)
  await prisma.$executeRawUnsafe(`DELETE FROM "Notification" WHERE link='/backlog' AND title LIKE $1`, '%zz-eval-motor%').catch(() => {})
  await prisma.$executeRawUnsafe(`DELETE FROM "Solucion" WHERE id=$1`, solucionId)
}

async function main() {
  await limpiarRestosPrevios()
  const sprintCode = `ZZEV-${Date.now().toString().slice(-6)}`

  const [sol] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Solucion" (id, nombre, tipo, estado, descripcion, repositorio, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'PROJECT', 'ACTIVO', 'Fixture de evals del Motor Agéntico (repo aislado, se borra al terminar).', $2, NOW(), NOW()) RETURNING id`,
    SOL_NOMBRE, REPO_SLUG)
  const [epic] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Epic" (id, "solucionId", name, description, "startDate", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'Epic de evals', 'Epic temporal para los evals del Motor.', NOW(), NOW(), NOW()) RETURNING id`,
    sol.id)
  const [sprint] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Sprint" (id, "sprintCode", "solucionId", name, goal, "startDate", status, "epicId", "ownerAreaId", "responsibleName", "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, 'Sprint de evals', 'Casos de control de código.', NOW(), 'ACTIVE', $3, $4, 'Claude', NOW()) RETURNING id`,
    sprintCode, sol.id, epic.id, AREA_DEV)

  // Las 3 tareas tocan el mismo archivo (src/mathUtils.ts): se encadenan con dependsOnTaskId,
  // igual que haría el grafo automático de tareas reales, para que cada worktree parta de la
  // versión del archivo que dejó la anterior — sin esto, tres worktrees en paralelo desde el
  // mismo punto de partida chocan al mergear (conflicto real, visto en la primera corrida:
  // no era un bug, era el diseño del eval corriendo 3 ediciones concurrentes del mismo archivo).
  const taskIds: Record<string, string> = {}
  let depId: string | null = null
  for (const [i, c] of CASOS.entries()) {
    const taskCode = `${sprintCode}-${String(i + 1).padStart(3, '0')}`
    const dependsOn: string | null = depId
    const filas: { id: string }[] = await prisma.$queryRawUnsafe(
      `INSERT INTO "BacklogItem" (id, title, description, type, priority, status, "sprintId", "solucionId", "areaId", "taskCode", "dependsOnTaskId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'DESARROLLO', 'MEDIUM', 'BACKLOG', $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id`,
      c.titulo, c.descripcion, sprint.id, sol.id, AREA_DEV, taskCode, dependsOn)
    const nuevoId: string = filas[0].id
    taskIds[c.id] = nuevoId
    depId = nuevoId
  }

  console.log(`Sprint ${sprintCode} — ${CASOS.length} tareas encadenadas, despachando en orden...`)
  for (const c of CASOS) {
    const r = await dispatchTask(taskIds[c.id])
    console.log(`  ${c.id}: despachada (agente ${r.agentName}, estrategia ${r.strategy})`)
    // Encadenadas: hay que esperar a que ÉSTA llegue a un estado terminal antes de despachar la
    // siguiente (dispatchTask ya rechaza despachar una tarea cuya dependencia no está DONE).
    const t0 = Date.now()
    const terminal = new Set(['DONE', 'FAILED', 'BLOCKED', 'CANCELLED'])
    let estado = 'IN_PROGRESS'
    while (Date.now() - t0 < TIMEOUT_MS) {
      const [row] = await prisma.$queryRawUnsafe<{ status: string }[]>(`SELECT status FROM "BacklogItem" WHERE id=$1`, taskIds[c.id])
      estado = row.status
      if (terminal.has(estado)) break
      await sleep(3000)
    }
    console.log(`    → ${estado}`)
  }

  // Espera a que TODAS lleguen a un estado terminal
  const t0 = Date.now()
  const terminal = new Set(['DONE', 'FAILED', 'BLOCKED', 'CANCELLED'])
  const estados: Record<string, string> = {}
  while (Date.now() - t0 < TIMEOUT_MS) {
    const rows = await prisma.$queryRawUnsafe<{ id: string; status: string }[]>(
      `SELECT id, status FROM "BacklogItem" WHERE "sprintId"=$1`, sprint.id)
    for (const r of rows) estados[r.id] = r.status
    if (rows.every(r => terminal.has(r.status))) break
    await sleep(4000)
  }

  console.log('\nResultados por caso:')
  const resultados: Record<string, unknown>[] = []
  for (const c of CASOS) {
    const taskId = taskIds[c.id]
    const [bi] = await prisma.$queryRawUnsafe<{ status: string; resultado: string | null; fechaInicio: Date | null; fechaFin: Date | null }[]>(
      `SELECT status, resultado, "fechaInicio", "fechaFin" FROM "BacklogItem" WHERE id=$1`, taskId)
    const [exec] = await prisma.$queryRawUnsafe<{ agentName: string | null; durationMs: number | null; artifacts: unknown }[]>(
      `SELECT "agentName", "durationMs", artifacts FROM "TaskExecution" WHERE "backlogItemId"=$1 ORDER BY "startedAt" DESC LIMIT 1`, taskId)
    const artifacts = (exec?.artifacts ?? {}) as { checklist?: { criterion: string; passed: boolean; reason: string }[]; toolLog?: unknown[] }
    const checklist = artifacts.checklist ?? []
    const tscOk = checklist.find(x => x.criterion?.includes('tsc'))
    const verifierItems = checklist.filter(x => !x.criterion?.includes('tsc'))
    const verifierOk = verifierItems.length === 0 ? null : verifierItems.every(x => x.passed)

    let runtime: { ok: boolean; detalle: string } | null = null
    if (bi.status === 'DONE') {
      try {
        const wt = sprintWorktreePath(sprintCode)
        execFileSync('npx', ['tsc'], { cwd: wt, timeout: 60_000 })
        const compiled = path.join(wt, 'dist', 'mathUtils.js')
        delete require.cache[require.resolve(compiled)]
        const mod = require(compiled)
        runtime = c.chequeoRuntime(mod)
      } catch (e) {
        runtime = { ok: false, detalle: `no se pudo ejecutar: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}` }
      }
    }

    const linea = `  ${runtime?.ok ? '✔' : bi.status === 'DONE' ? '✘' : '·'} ${c.id}: ${bi.status}` +
      (tscOk ? ` · tsc:${tscOk.passed ? 'ok' : 'FALLÓ'}` : '') +
      (verifierOk !== null ? ` · verificador:${verifierOk ? 'ok' : 'FALLÓ'}` : '') +
      (runtime ? ` · runtime:${runtime.ok ? 'ok' : 'FALLÓ'} (${runtime.detalle})` : '') +
      (exec?.durationMs ? ` · ${Math.round(exec.durationMs / 1000)}s` : '') +
      (artifacts.toolLog ? ` · ${artifacts.toolLog.length} llamadas a herramientas` : '')
    console.log(linea)
    resultados.push({ caso: c.id, estado: bi.status, agente: exec?.agentName, tsc: tscOk?.passed ?? null, verificador: verifierOk, runtime, durationMs: exec?.durationMs, herramientas: artifacts.toolLog?.length ?? 0, resultado: (bi.resultado ?? '').slice(0, 500) })
  }

  const dir = path.join(process.cwd(), 'evals', 'resultados'); fs.mkdirSync(dir, { recursive: true })
  const archivo = path.join(dir, `motor-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(archivo, JSON.stringify({ fecha: new Date().toISOString(), sprintCode, resultados }, null, 2))
  console.log('Guardado en', archivo)

  // Limpieza: worktree/rama de integración del sprint (las de cada tarea ya las borra finalizeExecution)
  const repoRoot = `/root/repos/${REPO_SLUG}`
  const wt = sprintWorktreePath(sprintCode)
  try { execFileSync('git', ['worktree', 'remove', wt, '--force'], { cwd: repoRoot }) } catch {}
  try { execFileSync('git', ['branch', '-D', sprintBranchName(sprintCode)], { cwd: repoRoot }) } catch {}
  for (const c of CASOS) { // por si alguna quedó BLOCKED (conflicto) con su worktree propio vivo
    try { execFileSync('git', ['worktree', 'remove', `/root/worktrees/${sprintCode}-${String(CASOS.indexOf(c) + 1).padStart(3, '0')}`, '--force'], { cwd: repoRoot }) } catch {}
  }
  await borrarSolucion(sol.id)
  console.log('Fixture (Solución/Epic/Sprint/tareas) y ramas de git limpiadas.')
}
main().catch(e => { console.error('ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
