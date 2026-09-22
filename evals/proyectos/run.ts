import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import * as R_SES from '@/app/api/proyectos/[id]/sesiones/route'
import * as R_SID from '@/app/api/proyectos/[id]/sesiones/[sid]/route'
import * as R_MSG from '@/app/api/proyectos/[id]/sesiones/[sid]/mensajes/route'
import { CASOS, crearFixture, borrarFixture, type Caso } from './casos'

// Uso (en el VPS, desde la raíz del repo):
//   set -a && . ./.env && set +a && npx tsx evals/proyectos/run.ts
// Variables: EVAL_N=3 (repeticiones por caso), EVAL_SOLO=rec-,adj- (prefijos de id), EVAL_UMBRAL=0.8 (exit 1 si baja)
// Cada caso corre en una sesión nueva que se borra al terminar, para que un caso no contamine a otro.
// El modelo no es determinista: por eso conviene EVAL_N>=3 antes de comparar contra la línea base.

const KEY = process.env.INTERNAL_API_KEY || ''
const N = Math.max(1, Number(process.env.EVAL_N) || 1)
const SOLO = (process.env.EVAL_SOLO || '').split(',').map(s => s.trim()).filter(Boolean)
const UMBRAL = Number(process.env.EVAL_UMBRAL) || 0
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function call(mod: any, metodo: string, params: Record<string, string>, body?: unknown) {
  const headers: Record<string, string> = { 'x-api-key': KEY }
  const init: RequestInit = { method: metodo, headers }
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body) }
  const res: Response = await mod[metodo](new Request('http://x/x', init) as never, { params: Promise.resolve(params) })
  let json: any = null; try { json = await res.json() } catch {}
  return { status: res.status, json }
}
async function esperar(id: string, sid: string) {
  for (let i = 0; i < 120; i++) {
    const r = await call(R_SID, 'GET', { id, sid })
    const u = r.json.mensajes[r.json.mensajes.length - 1]
    if (u && u.rol === 'assistant' && u.estado !== 'GENERANDO') return u
    await sleep(2000)
  }
  throw new Error('timeout')
}

interface Resultado { caso: string; categoria: string; intento: number; ok: boolean; fallos: string[]; ms: number; herramientas: string[]; tokens: number; cachePct: number; cortada: boolean; estado: string; respuesta: string }

async function correr(c: Caso, intento: number, solucionId: string): Promise<Resultado> {
  const t0 = Date.now()
  const s = (await call(R_SES, 'POST', { id: solucionId }, { tipo: 'LIBRE' })).json
  let ult: any = null
  try {
    for (const q of c.turnos) { await call(R_MSG, 'POST', { id: solucionId, sid: s.id }, { contenido: q }); ult = await esperar(solucionId, s.id) }
  } catch (e) { ult = { estado: 'ERROR', contenido: '', error: String(e), metadata: {} } }
  const fallos: string[] = []
  const txt: string = ult.contenido || ''
  if (ult.estado !== 'LISTO') fallos.push(`estado ${ult.estado}: ${ult.error ?? ''}`.slice(0, 120))
  for (const r of c.regla.ok) if (!r.test(txt)) fallos.push(`falta ${r}`)
  for (const r of c.regla.no ?? []) if (r.test(txt)) fallos.push(`no debía aparecer ${r}`)
  const herr: string[] = (ult.metadata?.herramientas ?? []).map((h: any) => h.nombre)
  if (c.exige?.herramientas && herr.length === 0) fallos.push('no usó herramientas')
  if (c.exige?.citas && !/\[(PRD|Diseño|Backlog|Memoria|Adjunto|Sesión|Lead|Plan|Riesgos)/i.test(txt)) fallos.push('sin cita de fuente')
  if (c.exige?.noCortada && ult.metadata?.cortada) fallos.push('respuesta cortada')
  if (c.exige?.minChars && txt.length < c.exige.minChars) fallos.push(`muy corta (${txt.length})`)
  const u = ult.metadata?.uso
  // limpiar la sesión del caso
  await prisma.proyectoMensaje.deleteMany({ where: { sesionId: s.id } })
  await prisma.proyectoSesion.delete({ where: { id: s.id } }).catch(() => {})
  return { caso: c.id, categoria: c.categoria, intento, ok: fallos.length === 0, fallos, ms: Date.now() - t0, herramientas: herr, tokens: u ? u.promptTokens + u.completionTokens : 0,
    cachePct: u && u.promptTokens ? Math.round((u.cachedTokens / u.promptTokens) * 100) : 0, cortada: !!ult.metadata?.cortada, estado: ult.estado, respuesta: txt.slice(0, 400) }
}

async function main() {
  const casos = CASOS.filter(c => SOLO.length === 0 || SOLO.some(p => c.id.startsWith(p)))
  const fx = await crearFixture()
  const res: Resultado[] = []
  try {
    for (const c of casos) for (let i = 1; i <= N; i++) {
      const r = await correr(c, i, fx.solucionId)
      res.push(r)
      console.log(`${r.ok ? '✔' : '✘'} ${r.caso}${N > 1 ? ` #${i}` : ''}  ${(r.ms / 1000).toFixed(0)}s  tools:${r.herramientas.length}  tok:${r.tokens}${r.ok ? '' : '  → ' + r.fallos.join('; ')}`)
    }
  } finally { await borrarFixture(fx.solucionId) }

  const pasan = res.filter(r => r.ok).length
  const tasa = res.length ? pasan / res.length : 0
  const porCat: Record<string, [number, number]> = {}
  for (const r of res) { const x = (porCat[r.categoria] ??= [0, 0]); x[1]++; if (r.ok) x[0]++ }
  console.log('\nPor categoría:'); for (const [k, [a, b]] of Object.entries(porCat)) console.log(`  ${k.padEnd(14)} ${a}/${b}`)
  const med = (f: (r: Resultado) => number) => Math.round(res.reduce((s, r) => s + f(r), 0) / Math.max(1, res.length))
  console.log(`\nAciertos: ${pasan}/${res.length} (${Math.round(tasa * 100)} %) · ${med(r => r.ms / 1000)} s de media · ${med(r => r.tokens)} tokens de media · caché ${med(r => r.cachePct)} % · con herramientas: ${res.filter(r => r.herramientas.length).length}`)
  const dir = path.join(process.cwd(), 'evals', 'resultados'); fs.mkdirSync(dir, { recursive: true })
  const archivo = path.join(dir, `proyectos-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(archivo, JSON.stringify({ fecha: new Date().toISOString(), n: N, tasa, porCategoria: porCat, resultados: res }, null, 2))
  console.log('Guardado en', archivo)
  if (UMBRAL && tasa < UMBRAL) { console.log(`❌ por debajo del umbral ${UMBRAL}`); process.exitCode = 1 }
}
main().catch(e => { console.error('ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
