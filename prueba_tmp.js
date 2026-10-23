const fs = require('fs')
const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient()
const env = Object.fromEntries(fs.readFileSync('/root/portal-architechia/.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.split('=')[0], l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]))
const H = { 'x-api-key': env.INTERNAL_API_KEY, 'content-type': 'application/json' }
const API = 'http://127.0.0.1:3100', DIS = 'cmv1m8uxoe0orvptq8ehruymo'
const j = async (m, u, b) => { const r = await fetch(API + u, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); try { return { s: r.status, v: JSON.parse(t) } } catch { return { s: r.status, v: t } } }
const J = v => JSON.stringify(v, (k, x) => typeof x === 'bigint' ? Number(x) : x)
;(async () => {
  const [ej] = await p.$queryRawUnsafe(`SELECT "areaId" FROM "BacklogItem" WHERE "areaId" IS NOT NULL LIMIT 1`)
  const antes = (await j('GET', `/api/proyectos/${DIS}/alertas`)).v.length
  try {
    // una sesión de desarrollo con 13 h sin actividad, con una tarea tomada que quedó en curso
    const c = await j('POST', `/api/proyectos/${DIS}/sesiones`, { titulo: '[prueba] sesión abandonada', tipo: 'DESARROLLO' })
    const sid = c.v.id
    await p.$executeRawUnsafe(`UPDATE "ProyectoSesion" SET "updatedAt" = NOW() - interval '13 hours' WHERE id = $1`, sid)
    await p.$executeRawUnsafe(`INSERT INTO "BacklogItem" (id, title, description, type, priority, status, "taskCode", "solucionId", "areaId", "fechaEjecucion", "createdAt", "updatedAt") VALUES ('prueba-seg-1', 'Tarea de una sesión abandonada', 'prueba', 'TASK', 'LOW', 'IN_PROGRESS', 'PRUEBA-SEG-001', $1, $2, NOW(), NOW(), NOW())`, DIS, ej.areaId)
    await p.$executeRawUnsafe(`INSERT INTO "ProyectoSesionTarea" (id, "sesionId", "tareaId", "solucionId") VALUES ('prueba-seg-l1', $1, 'prueba-seg-1', $2)`, sid, DIS)
    await p.$executeRawUnsafe(`INSERT INTO "TaskExecution" (id, "backlogItemId", "agentName", status) VALUES ('prueba-seg-e1', 'prueba-seg-1', 'Sesión de desarrollo (sesion/prueba)', 'RUNNING')`)
    // una tarea en curso hace 2 días, sin sesión: debe generar un aviso, no liberarse
    await p.$executeRawUnsafe(`INSERT INTO "BacklogItem" (id, title, description, type, priority, status, "taskCode", "solucionId", "areaId", "fechaEjecucion", "createdAt", "updatedAt") VALUES ('prueba-seg-2', 'Tarea atascada del ejecutor', 'prueba', 'TASK', 'LOW', 'IN_PROGRESS', 'PRUEBA-SEG-002', $1, $2, NOW() - interval '2 days', NOW(), NOW())`, DIS, ej.areaId)

    const r = await j('POST', '/api/proyectos/revision/ejecutar')
    console.log('1) revisión →', r.s, JSON.stringify(r.v))
    console.log('   tarea de la sesión abandonada:', J(await p.$queryRawUnsafe(`SELECT status, "assigneeName", left(resultado, 80) r FROM "BacklogItem" WHERE id = 'prueba-seg-1'`)))
    console.log('   enlace:', J(await p.$queryRawUnsafe(`SELECT estado, "cerradaEn" IS NOT NULL cerrada FROM "ProyectoSesionTarea" WHERE id = 'prueba-seg-l1'`)))
    console.log('   ejecución:', J(await p.$queryRawUnsafe(`SELECT status, left("resultSummary", 60) r FROM "TaskExecution" WHERE id = 'prueba-seg-e1'`)))
    console.log('   la atascada sigue en curso:', J(await p.$queryRawUnsafe(`SELECT status FROM "BacklogItem" WHERE id = 'prueba-seg-2'`)))
    const al = await j('GET', `/api/proyectos/${DIS}/alertas`)
    console.log('   avisos abiertos:', al.v.length, '(antes', antes + ')', J((al.v || []).filter(a => /Prueba|PRUEBA|liberada|atascada|Tarea/i.test(a.titulo + a.detalle)).map(a => a.tipo + ' · ' + a.detalle.slice(0, 50))))
    const bit = await p.$queryRawUnsafe(`SELECT left(m.contenido, 260) c FROM "ProyectoMensaje" m JOIN "ProyectoSesion" s ON s.id = m."sesionId" WHERE s."solucionId" = $1 AND s.tipo = 'BITACORA' ORDER BY m."createdAt" DESC LIMIT 1`, DIS)
    console.log('   último mensaje de la Bitácora:', J(bit))

    // segunda pasada: no repite el anuncio
    const antesMsgs = (await p.$queryRawUnsafe(`SELECT count(*)::int n FROM "ProyectoMensaje" m JOIN "ProyectoSesion" s ON s.id = m."sesionId" WHERE s."solucionId" = $1 AND s.tipo = 'BITACORA'`, DIS))[0].n
    const r2 = await j('POST', '/api/proyectos/revision/ejecutar')
    const despMsgs = (await p.$queryRawUnsafe(`SELECT count(*)::int n FROM "ProyectoMensaje" m JOIN "ProyectoSesion" s ON s.id = m."sesionId" WHERE s."solucionId" = $1 AND s.tipo = 'BITACORA'`, DIS))[0].n
    console.log('2) segunda pasada →', JSON.stringify(r2.v), '· mensajes nuevos en la Bitácora:', despMsgs - antesMsgs)

    // descartar un aviso y resolver al corregirse la causa
    const atasc = (al.v || []).find(a => a.detalle.includes('PRUEBA-SEG-002'))
    if (atasc) console.log('3) descartar →', (await j('POST', `/api/proyectos/${DIS}/alertas/${atasc.id}/descartar`)).s)
    await p.$executeRawUnsafe(`UPDATE "BacklogItem" SET status = 'DONE' WHERE id = 'prueba-seg-2'`)
    await j('POST', '/api/proyectos/revision/ejecutar')
    console.log('   tras corregirse la causa, avisos de la atascada abiertos:', (await j('GET', `/api/proyectos/${DIS}/alertas`)).v.filter(a => a.detalle.includes('PRUEBA-SEG-002')).length)

    const res = await j('GET', `/api/proyectos/${DIS}/resumen`)
    console.log('4) resumen →', res.s, J({ tareas: res.v.tareas, sprints: res.v.sprints, pendientes: res.v.pendientes, uso: res.v.uso, alertasAbiertas: res.v.alertasAbiertas }).slice(0, 700))
    await fetch(`${API}/api/proyectos/${DIS}/sesiones/${sid}`, { method: 'DELETE', headers: H })
  } finally {
    await p.$executeRawUnsafe(`DELETE FROM "TaskExecutionEvent" WHERE "taskId" IN ('prueba-seg-1','prueba-seg-2')`)
    await p.$executeRawUnsafe(`DELETE FROM "TaskExecution" WHERE "backlogItemId" IN ('prueba-seg-1','prueba-seg-2')`)
    await p.$executeRawUnsafe(`DELETE FROM "ProyectoSesionTarea" WHERE id = 'prueba-seg-l1'`)
    await p.$executeRawUnsafe(`DELETE FROM "ProyectoAlerta" WHERE "solucionId" = $1 AND (ref LIKE 'prueba-seg-%' OR detalle LIKE '%PRUEBA-SEG%' OR detalle LIKE '%sesión abandonada%')`, DIS)
    await p.$executeRawUnsafe(`DELETE FROM "BacklogItem" WHERE id LIKE 'prueba-seg-%'`)
    await p.$executeRawUnsafe(`DELETE FROM "ProyectoMensaje" WHERE contenido LIKE '%PRUEBA-SEG%' OR contenido LIKE '%sesión abandonada%'`)
    console.log('limpio:', J(await p.$queryRawUnsafe(`SELECT (SELECT count(*)::int FROM "BacklogItem" WHERE id LIKE 'prueba-seg-%') t, (SELECT count(*)::int FROM "ProyectoAlerta" WHERE detalle LIKE '%PRUEBA-SEG%') a`)))
  }
})().then(() => process.exit(0)).catch(e => { console.error('FALLO', e.message); process.exit(1) })
