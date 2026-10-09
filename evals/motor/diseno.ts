import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { sprintWorktreePath, sprintBranchName } from '@/lib/executor/gitWorktree'

// Eval «el Motor respeta el diseño» (MASD-0024-0008). Corre el pipeline REAL (portalhub -> Harness -> worker -> tsc + verificador) contra el
// repo aislado zz-eval-motor, con un Diseño técnico guardado en la Solución. Dos casos encadenados:
//   1) diseno-respetado: la tarea NO dice los nombres de los atributos; el diseño sí. El agente tiene que usar codigo/denominacion/precioUnitario/existencias (nombres distintos de los «naturales» a propósito, para medir si de verdad lee el diseño).
//   2) cambio-declarado: la tarea pide un campo que el diseño no tiene. El agente debe hacerlo Y declarar «CAMBIO DE DISEÑO:» en su resumen.
// Con --sin-diseno corre el caso 1 SIN diseño en la Solución (control): muestra qué pasaba antes.
//
// Uso: set -a && . ./.env && set +a && npx tsx evals/motor/diseno.ts [--sin-diseno]
const SOL_NOMBRE = 'ZZ Eval Motor Diseño'
const REPO_SLUG = 'zz-eval-motor'
const AREA_DEV = '947ca771-fe9e-4c3f-bfea-2ef2e27986c6'
const TIMEOUT_MS = 8 * 60_000
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const RS = process.env.PARITY_RS || 'http://127.0.0.1:3100'
const SIN_DISENO = process.argv.includes('--sin-diseno')

const DISENO = {
  estadoDocumento: 'APROBADO',
  arquitectura: 'Biblioteca TypeScript de inventario, sin dependencias externas.',
  entidades: [{ id: 'e1', nombre: 'Producto', atributos: 'codigo (string), denominacion (string), precioUnitario (number, en pesos), existencias (number, unidades)', relaciones: '' }],
  stack: [{ id: 's1', capa: 'Lenguaje', tecnologia: 'TypeScript estricto', justificacion: 'el repo ya lo usa' }],
  integraciones: [],
  decisiones: [{ id: 'd1', decision: 'Los nombres del dominio van en español', alternativas: 'inglés', justificacion: 'el equipo y el cliente trabajan en español' }],
}

async function dispatchTask(taskId: string) {
  const r = await fetch(RS + '/api/executor/dispatch', { method: 'POST', headers: { 'x-api-key': process.env.INTERNAL_API_KEY ?? '', 'content-type': 'application/json' }, body: JSON.stringify({ taskId }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`dispatch ${r.status}: ${JSON.stringify(j)}`)
}

interface Caso { id: string; titulo: string; descripcion: string; exigeMarca: boolean; chequeo: (m: any) => { ok: boolean; detalle: string } }
const CASOS: Caso[] = [
  {
    id: 'diseno-respetado', exigeMarca: false,
    titulo: 'Crear el modelo Producto en src/modelo.ts según el diseño técnico del proyecto',
    descripcion: 'Crea el archivo src/modelo.ts con la interfaz Producto, exportada, y una función crearProducto(datos) que valide y devuelva un Producto. Debe lanzar un Error si el precio o el stock son negativos. Sigue el diseño técnico del proyecto para los nombres y tipos de los campos.',
    chequeo: (m) => {
      if (typeof m.crearProducto !== 'function') return { ok: false, detalle: 'no exporta crearProducto' }
      let r: any
      try { r = m.crearProducto({ codigo: 'A-1', denominacion: 'Tornillo', precioUnitario: 150, existencias: 40 }) } catch (e) { return { ok: false, detalle: `crearProducto lanzó con datos válidos: ${e instanceof Error ? e.message : e}` } }
      const claves = Object.keys(r ?? {}).filter(k => k !== 'descuento').sort().join(',')
      const camposOk = claves === 'codigo,denominacion,existencias,precioUnitario' && r.codigo === 'A-1' && r.denominacion === 'Tornillo' && r.precioUnitario === 150 && r.existencias === 40
      let lanza = false
      try { m.crearProducto({ codigo: 'A-2', denominacion: 'X', precioUnitario: -1, existencias: 1 }) } catch { lanza = true }
      return { ok: camposOk && lanza, detalle: `campos devueltos: [${claves}] (esperados: codigo,denominacion,existencias,precioUnitario); rechaza precio negativo: ${lanza}` }
    },
  },
  {
    id: 'cambio-declarado', exigeMarca: true,
    titulo: 'Agregar el campo descuento a Producto en src/modelo.ts',
    descripcion: 'En src/modelo.ts agrega a Producto un campo opcional descuento (porcentaje entre 0 y 100) y haz que crearProducto lo acepte y lo devuelva. Debe lanzar un Error si el descuento está fuera de 0–100.',
    chequeo: (m) => {
      if (typeof m.crearProducto !== 'function') return { ok: false, detalle: 'no exporta crearProducto' }
      let r: any
      try { r = m.crearProducto({ codigo: 'A-1', denominacion: 'Tornillo', precioUnitario: 150, existencias: 40, descuento: 10 }) } catch (e) { return { ok: false, detalle: `lanzó con descuento válido: ${e instanceof Error ? e.message : e}` } }
      let lanza = false
      try { m.crearProducto({ codigo: 'A-1', denominacion: 'Tornillo', precioUnitario: 150, existencias: 40, descuento: 150 }) } catch { lanza = true }
      return { ok: r?.descuento === 10 && lanza, detalle: `descuento devuelto: ${r?.descuento} (esp. 10); rechaza 150: ${lanza}` }
    },
  },
]

async function borrar(solucionId: string) {
  await prisma.$executeRawUnsafe(`DELETE FROM "TaskExecution" WHERE "backlogItemId" IN (SELECT id FROM "BacklogItem" WHERE "solucionId"=$1)`, solucionId)
  await prisma.$executeRawUnsafe(`DELETE FROM "SprintDecision" WHERE "sprintId" IN (SELECT s.id FROM "Sprint" s JOIN "Epic" e ON s."epicId"=e.id WHERE e."solucionId"=$1)`, solucionId)
  await prisma.$executeRawUnsafe(`DELETE FROM "BacklogItem" WHERE "solucionId"=$1`, solucionId)
  await prisma.$executeRawUnsafe(`DELETE FROM "Sprint" WHERE "epicId" IN (SELECT id FROM "Epic" WHERE "solucionId"=$1)`, solucionId)
  await prisma.$executeRawUnsafe(`DELETE FROM "Epic" WHERE "solucionId"=$1`, solucionId)
  await prisma.$executeRawUnsafe(`DELETE FROM "Notification" WHERE link='/backlog' AND title LIKE $1`, '%zz-eval-motor%').catch(() => {})
  await prisma.$executeRawUnsafe(`DELETE FROM "Solucion" WHERE id=$1`, solucionId)
}

async function main() {
  for (const s of await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "Solucion" WHERE nombre=$1`, SOL_NOMBRE)) await borrar(s.id)
  const sprintCode = `ZZDI-${Date.now().toString().slice(-6)}`
  const casos = SIN_DISENO ? CASOS.slice(0, 1) : CASOS
  const [sol] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Solucion" (id, nombre, tipo, estado, descripcion, repositorio, "disenoTecnico", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'PROJECT', 'ACTIVO', 'Fixture del eval de diseño (repo aislado, se borra al terminar).', $2, $3, NOW(), NOW()) RETURNING id`,
    SOL_NOMBRE, REPO_SLUG, SIN_DISENO ? null : JSON.stringify(DISENO))
  const [epic] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Epic" (id, "solucionId", name, description, "startDate", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, 'Epic de evals', 'Temporal.', NOW(), NOW(), NOW()) RETURNING id`, sol.id)
  const [sprint] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Sprint" (id, "sprintCode", "solucionId", name, goal, "startDate", status, "epicId", "ownerAreaId", "responsibleName", "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, 'Sprint de evals', 'Diseño respetado.', NOW(), 'ACTIVE', $3, $4, 'Claude', NOW()) RETURNING id`, sprintCode, sol.id, epic.id, AREA_DEV)

  const ids: Record<string, string> = {}
  let dep: string | null = null
  for (const [i, c] of casos.entries()) {
    const filas: { id: string }[] = await prisma.$queryRawUnsafe(
      `INSERT INTO "BacklogItem" (id, title, description, type, priority, status, "sprintId", "solucionId", "areaId", "taskCode", "dependsOnTaskId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'DESARROLLO', 'MEDIUM', 'BACKLOG', $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id`,
      c.titulo, c.descripcion, sprint.id, sol.id, AREA_DEV, `${sprintCode}-${String(i + 1).padStart(3, '0')}`, dep)
    ids[c.id] = filas[0].id; dep = filas[0].id
  }
  console.log(`Sprint ${sprintCode} (${SIN_DISENO ? 'SIN diseño — control' : 'CON diseño'}) — ${casos.length} tarea(s)`)
  const terminal = new Set(['DONE', 'FAILED', 'BLOCKED', 'CANCELLED'])
  for (const c of casos) {
    await dispatchTask(ids[c.id])
    const t0 = Date.now(); let estado = 'IN_PROGRESS'
    while (Date.now() - t0 < TIMEOUT_MS) {
      const [row] = await prisma.$queryRawUnsafe<{ status: string }[]>(`SELECT status FROM "BacklogItem" WHERE id=$1`, ids[c.id])
      estado = row.status
      if (terminal.has(estado)) break
      await sleep(3000)
    }
    console.log(`  ${c.id}: ${estado}`)
  }

  console.log('\nResultados:')
  const resultados: Record<string, unknown>[] = []
  for (const c of casos) {
    const [bi] = await prisma.$queryRawUnsafe<{ status: string }[]>(`SELECT status FROM "BacklogItem" WHERE id=$1`, ids[c.id])
    const [ex] = await prisma.$queryRawUnsafe<{ resultSummary: string | null; durationMs: number | null; artifacts: any }[]>(
      `SELECT "resultSummary", "durationMs", artifacts FROM "TaskExecution" WHERE "backlogItemId"=$1 ORDER BY "startedAt" DESC LIMIT 1`, ids[c.id])
    const traza = await prisma.$queryRawUnsafe<{ message: string }[]>(`SELECT message FROM "TaskExecutionEvent" WHERE "taskId"=$1 ORDER BY "createdAt"`, ids[c.id]).catch(() => [])
    const marca = /CAMBIO DE DISEÑO:/.test(ex?.resultSummary ?? '')
    const avisoTraza = traza.some(t => t.message.includes('declaró un cambio de diseño'))
    const bloque = (ex?.artifacts as any)?.checklist?.some((x: any) => /dise[ñn]o t[eé]cnico documentado/.test(x.criterion ?? ''))
    let runtime: { ok: boolean; detalle: string } | null = null
    if (bi.status === 'DONE' || bi.status === 'FAILED') {
      try {
        const wt = sprintWorktreePath(sprintCode)
        execFileSync('npx', ['tsc'], { cwd: wt, timeout: 60_000 })
        const compiled = path.join(wt, 'dist', 'modelo.js')
        delete require.cache[require.resolve(compiled)]
        runtime = c.chequeo(require(compiled))
      } catch (e) { runtime = { ok: false, detalle: `no se pudo ejecutar: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}` } }
    }
    console.log(`  ${runtime?.ok ? '✔' : '✘'} ${c.id}: ${bi.status} · runtime:${runtime?.ok ? 'ok' : 'FALLÓ'} (${runtime?.detalle}) · criterio de diseño en el verificador:${bloque ? 'sí' : 'no'} · marca «CAMBIO DE DISEÑO» en el resumen:${marca ? 'sí' : 'no'}${c.exigeMarca ? (marca ? ' (esperada)' : ' (FALTA)') : ''} · aviso en la traza:${avisoTraza ? 'sí' : 'no'}${ex?.artifacts?.usage?.total_tokens ? ` · ${ex.artifacts.usage.total_tokens} tokens` : ''}`)
    console.log(`      resumen: ${(ex?.resultSummary ?? '').replace(/\s+/g, ' ').slice(0, 260)}`)
    resultados.push({ caso: c.id, estado: bi.status, runtime, marca, avisoTraza, criterioDiseno: !!bloque, resumen: ex?.resultSummary })
  }
  const dir = path.join(process.cwd(), 'evals', 'resultados'); fs.mkdirSync(dir, { recursive: true })
  const archivo = path.join(dir, `diseno-${SIN_DISENO ? 'control-' : ''}${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(archivo, JSON.stringify({ fecha: new Date().toISOString(), sprintCode, sinDiseno: SIN_DISENO, resultados }, null, 2))
  console.log('Guardado en', archivo)

  const repoRoot = `/root/repos/${REPO_SLUG}`
  try { execFileSync('git', ['worktree', 'remove', sprintWorktreePath(sprintCode), '--force'], { cwd: repoRoot }) } catch {}
  try { execFileSync('git', ['branch', '-D', sprintBranchName(sprintCode)], { cwd: repoRoot }) } catch {}
  for (const [i] of casos.entries()) { try { execFileSync('git', ['worktree', 'remove', `/root/worktrees/${sprintCode}-${String(i + 1).padStart(3, '0')}`, '--force'], { cwd: repoRoot }) } catch {} }
  await borrar(sol.id)
  console.log('Fixture y ramas limpiadas.')
}
main().catch(e => { console.error('ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
