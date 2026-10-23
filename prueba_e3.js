const fs = require('fs')
const zlib = require('zlib')
const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient()
const env = Object.fromEntries(fs.readFileSync('/root/portal-architechia/.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.split('=')[0], l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]))
const H = { 'x-api-key': env.INTERNAL_API_KEY, 'content-type': 'application/json' }
const API = 'http://127.0.0.1:3100', DIS = 'cmv1m8uxoe0orvptq8ehruymo'
const j = async (m, u, b) => { const r = await fetch(API + u, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); try { return { s: r.status, v: JSON.parse(t) } } catch { return { s: r.status, v: t } } }

// lee un archivo del zip (docx) sin librerías: busca la entrada y la descomprime
function entradaZip(buf, nombre) {
  let i = 0
  while (true) {
    i = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), i)
    if (i < 0) return null
    const metodo = buf.readUInt16LE(i + 8), comp = buf.readUInt32LE(i + 18), nl = buf.readUInt16LE(i + 26), el = buf.readUInt16LE(i + 28)
    const nom = buf.slice(i + 30, i + 30 + nl).toString()
    const ini = i + 30 + nl + el
    if (nom === nombre) { const dat = buf.slice(ini, ini + comp); return metodo === 8 ? zlib.inflateRawSync(dat) : dat }
    i = ini + comp
  }
}

;(async () => {
  const c = await j('POST', `/api/proyectos/${DIS}/sesiones`, { titulo: '[prueba] documentos ricos', tipo: 'LIBRE' })
  const sid = c.v.id
  const archivos = []
  try {
    await p.$executeRawUnsafe(`INSERT INTO "ProyectoMensaje" ("sesionId", orden, rol, contenido, estado) VALUES ($1, 1, 'user', $2, 'LISTO'), ($1, 2, 'assistant', $3, 'LISTO')`, sid,
      'Necesito el acta de arranque del proyecto. Debe incluir una TABLA de responsables (nombre, rol y qué aprueba) con al menos 4 filas, y un DIAGRAMA con el flujo de aprobación del alcance: cliente solicita cambio → líder de proyecto evalúa → dirección aprueba → equipo ejecuta. Responsables: Marta Quintero (cliente, aprueba el alcance), Líder técnico (aprueba el diseño), Dirección ArchiTechIA (aprueba presupuesto), Líder de proyecto (coordina).',
      'Entendido: el acta tendrá la tabla de responsables y el diagrama del flujo de aprobación.')
    for (const [fase, clave, etiqueta] of [['arranque', 'acta_arranque', 'PDF'], ['entrega_cierre', 'lecciones', 'Word']]) {
      await p.$executeRawUnsafe(`UPDATE "ProyectoSesion" SET "faseClave" = $2 WHERE id = $1`, sid, fase)
      const r = await j('POST', `/api/proyectos/${DIS}/sesiones/${sid}/entregables/${clave}/generar`)
      console.log(`${etiqueta} (${clave}) →`, r.s, r.s < 300 ? `${r.v.nombre} · ${r.v.size} bytes · ${r.v.resumen}` : JSON.stringify(r.v).slice(0, 200))
      if (r.s >= 300) continue
      archivos.push(r.v.id)
      const d = await fetch(`${API}/api/proyectos/${DIS}/entregables/archivos/${r.v.id}/descargar`, { headers: H })
      const buf = Buffer.from(await d.arrayBuffer())
      if (etiqueta === 'PDF') {
        const t = buf.toString('latin1')
        console.log('   PDF:', buf.slice(0, 5).toString(), '· páginas:', (t.match(/\/Type\s*\/Page[^s]/g) || []).length, '· producido por:', /Skia|Chromium|Chrome/.test(t) ? 'Chromium (versión con tablas y dibujos)' : 'PDF sencillo (a mano)')
        fs.writeFileSync('/root/prueba_doc.pdf', buf)
      } else {
        const xml = entradaZip(buf, 'word/document.xml')?.toString() || ''
        console.log('   Word: tablas:', (xml.match(/<w:tbl>/g) || []).length, '· imágenes (diagramas/capturas):', (xml.match(/<w:drawing>/g) || []).length, '· filas:', (xml.match(/<w:tr>|<w:tr /g) || []).length, '· imagen1.png:', !!entradaZip(buf, 'word/media/imagen1.png'))
        fs.writeFileSync('/root/prueba_doc.docx', buf)
      }
    }
  } finally {
    for (const a of archivos) await p.$executeRawUnsafe(`DELETE FROM "ProyectoEntregableArchivo" WHERE id = $1`, a)
    await fetch(`${API}/api/proyectos/${DIS}/sesiones/${sid}`, { method: 'DELETE', headers: H })
    console.log('limpio:', JSON.stringify(await p.$queryRawUnsafe(`SELECT count(*)::int n FROM "ProyectoEntregableArchivo" WHERE "sesionId" = $1`, sid)))
  }
})().then(() => process.exit(0)).catch(e => { console.error('FALLO', e.message); process.exit(1) })
