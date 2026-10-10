import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { sprintWorktreePath, sprintBranchName } from '@/lib/executor/gitWorktree'

// Eval «una tarea que no termina no pierde su trabajo» (MASD-0024-0010). Pipeline REAL contra el repo aislado zz-eval-motor:
//   intento 1: la tarea pide un archivo con un error de tipos a propósito -> tsc falla -> FAILED. El archivo debe quedar en masd/parcial/<código>.
//   intento 2: se corrige la descripción ("corrige el error de src/roto.ts") y se relanza -> el agente debe ver el archivo ya hecho (continuación), terminar en DONE,
//              integrarse al sprint y borrarse la rama parcial.
// Uso: set -a && . ./.env && set +a && npx tsx evals/motor/parcial.ts
const SOL_NOMBRE = 'ZZ Eval Motor Parcial'
const REPO_SLUG = 'zz-eval-motor'
const REPO = `/root/repos/${REPO_SLUG}`
const AREA_DEV = '947ca771-fe9e-4c3f-bfea-2ef2e27986c6'
const RS = process.env.PARITY_RS || 'http://127.0.0.1:3100'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fallos = 0
const ok = (c: boolean, m: string, x?: unknown) => { if (!c) fallos++; console.log(`${c ? '  ok  ' : ' FALLA'} ${m}${!c && x !== undefined ? ' → ' + String(x).slice(0, 260) : ''}`) }
const git = (args: string[]) => { try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim() } catch (e) { return '' } }

async function despachar(taskId: string) {
  const r = await fetch(RS + '/api/executor/dispatch', { method: 'POST', headers: { 'x-api-key': process.env.INTERNAL_API_KEY ?? '', 'content-type': 'application/json' }, body: JSON.stringify({ taskId }) })
  if (!r.ok) throw new Error(`dispatch ${r.status}: ${await r.text()}`)
}
async function esperar(taskId: string) {
  const t0 = Date.now()
  while (Date.now() - t0 < 8 * 60_000) {
    const [r] = await prisma.$queryRawUnsafe<{ status: string }[]>(`SELECT status FROM "BacklogItem" WHERE id=$1`, taskId)
    if (['DONE', 'FAILED', 'BLOCKED', 'CANCELLED'].includes(r.status)) return r.status
    await sleep(3000)
  }
  return 'TIMEOUT'
}
const traza = (taskId: string) => prisma.$queryRawUnsafe<{ message: string }[]>(`SELECT message FROM "TaskExecutionEvent" WHERE "taskId"=$1 ORDER BY "createdAt"`, taskId)

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
  const sprintCode = `ZZPA-${Date.now().toString().slice(-6)}`
  const codigo = `${sprintCode}-001`
  const [sol] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Solucion" (id, nombre, tipo, estado, descripcion, repositorio, "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, 'PROJECT', 'ACTIVO', 'Fixture del eval de trabajo parcial (se borra al terminar).', $2, NOW(), NOW()) RETURNING id`, SOL_NOMBRE, REPO_SLUG)
  const [epic] = await prisma.$queryRawUnsafe<{ id: string }[]>(`INSERT INTO "Epic" (id, "solucionId", name, description, "startDate", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, 'Epic de evals', 'Temporal.', NOW(), NOW(), NOW()) RETURNING id`, sol.id)
  const [sprint] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Sprint" (id, "sprintCode", "solucionId", name, goal, "startDate", status, "epicId", "ownerAreaId", "responsibleName", "createdAt") VALUES (gen_random_uuid()::text, $1, $2, 'Sprint de evals', 'Trabajo parcial.', NOW(), 'ACTIVE', $3, $4, 'Claude', NOW()) RETURNING id`, sprintCode, sol.id, epic.id, AREA_DEV)
  const [t] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "BacklogItem" (id, title, description, type, priority, status, "sprintId", "solucionId", "areaId", "taskCode", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, 'Crear src/roto.ts', $1, 'DESARROLLO', 'MEDIUM', 'BACKLOG', $2, $3, $4, $5, NOW(), NOW()) RETURNING id`,
    'Crea src/roto.ts exportando la función doble(n: number): number. ES UNA PRUEBA DEL SISTEMA: escribe a propósito UN error de tipos dentro de la función (por ejemplo, asigna el string "x" a una variable declarada como number) y no lo corrijas. Termina cuando el archivo exista.',
    sprint.id, sol.id, AREA_DEV, codigo)

  console.log(`Sprint ${sprintCode}, tarea ${codigo}`)
  console.log('— Intento 1: la tarea falla (error de tipos a propósito)')
  await despachar(t.id)
  const e1 = await esperar(t.id)
  ok(e1 === 'FAILED', 'la tarea falla por el error de tipos', e1)
  const parcial = `masd/parcial/${codigo}`
  ok(git(['rev-parse', '--verify', parcial]) !== '', `existe la rama ${parcial}`)
  ok(git(['ls-tree', '-r', '--name-only', parcial]).split('\n').includes('src/roto.ts'), 'la rama parcial contiene src/roto.ts', git(['ls-tree', '-r', '--name-only', parcial]))
  const [r1] = await prisma.$queryRawUnsafe<{ resultado: string | null }[]>(`SELECT resultado FROM "BacklogItem" WHERE id=$1`, t.id)
  ok(/TRABAJO PARCIAL CONSERVADO/.test(r1.resultado ?? ''), 'el resultado de la tarea explica que el trabajo se conservó', (r1.resultado ?? '').slice(-300))
  ok((await traza(t.id)).some(x => /trabajo parcial conservado en la rama/.test(x.message)), 'la traza registra el trabajo parcial')
  ok(!fs.existsSync(`/opt/masd/worktrees/${codigo}`) && !fs.existsSync(`/root/worktrees/${codigo}`), 'el worktree de la tarea ya no ocupa lugar')

  console.log('— Intento 2: se corrige la descripción y se relanza; debe continuar, no empezar de cero')
  await prisma.$executeRawUnsafe(`UPDATE "BacklogItem" SET description=$2, status='BACKLOG' WHERE id=$1`, t.id,
    'src/roto.ts ya existe pero tiene un error de tipos. Corrígelo para que el archivo compile (la función doble(n: number): number debe devolver n * 2). No lo reescribas desde cero: arregla solo el error.')
  await despachar(t.id)
  const e2 = await esperar(t.id)
  ok(e2 === 'DONE', 'la tarea termina en DONE al corregir el error', e2)
  const tz = await traza(t.id)
  ok(tz.some(x => /continúa el trabajo parcial/.test(x.message)), 'la traza dice que continúa el trabajo parcial', tz.map(x => x.message).join(' | ').slice(-300))
  const [ex] = await prisma.$queryRawUnsafe<{ contextUsed: string | null }[]>(`SELECT "contextUsed" FROM "TaskExecution" WHERE "backlogItemId"=$1 ORDER BY "startedAt" DESC LIMIT 1`, t.id)
  ok(git(['rev-parse', '--verify', parcial]) === '', 'la rama parcial se borra al integrarse')
  const enSprint = git(['show', `${sprintBranchName(sprintCode)}:src/roto.ts`])
  ok(/doble/.test(enSprint) && !/"x"/.test(enSprint), 'src/roto.ts quedó integrado al sprint y ya sin el error', enSprint.slice(0, 200))
  const [u2] = await prisma.$queryRawUnsafe<{ artifacts: any }[]>(`SELECT artifacts FROM "TaskExecution" WHERE "backlogItemId"=$1 ORDER BY "startedAt" DESC LIMIT 1`, t.id)
  console.log(`  (intento 2: ${u2?.artifacts?.usage?.total_tokens ?? '?'} tokens en ${u2?.artifacts?.usage?.calls ?? '?'} llamadas)`)

  try { execFileSync('git', ['worktree', 'remove', sprintWorktreePath(sprintCode), '--force'], { cwd: REPO }) } catch {}
  try { execFileSync('git', ['branch', '-D', sprintBranchName(sprintCode)], { cwd: REPO }) } catch {}
  for (const b of [parcial, `masd/${codigo}`]) { try { execFileSync('git', ['branch', '-D', b], { cwd: REPO }) } catch {} }
  await borrar(sol.id)
  console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLA(S)`)
}
main().catch(e => { console.error('ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
