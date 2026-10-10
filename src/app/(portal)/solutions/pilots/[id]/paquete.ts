// Paquete de entrega: un solo documento HTML con todo lo que se le entrega al cliente (y que sirve de as-built):
// PRD, diseño técnico, arquitectura, diagramas, plan de ejecución, cronograma, hitos con aceptación, cambios aprobados,
// riesgos y acta de aceptación. Se genera en el navegador a partir de lo GUARDADO; se descarga o se imprime a PDF.
import { escapar, sanitizarHtml } from './sanitizar'

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DatosPaquete {
  solucion: Record<string, any>
  hitos: Record<string, any>[]
  riesgos: Record<string, any>[]
  cambios: Record<string, any>[]
  cliente?: string
  version?: string
}

const J = (t: unknown): any => { try { return typeof t === 'string' ? JSON.parse(t) : t ?? null } catch { return null } }
const arr = (v: any): any[] => (Array.isArray(v) ? v : [])
const rico = (h: unknown) => sanitizarHtml(String(h ?? ''))
const fecha = (v?: string | null) => (v ? new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }) : '—')
const dinero = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO')

function tabla(cabeceras: string[], filas: string[][]): string {
  if (filas.length === 0) return '<p class="vacio">Sin información registrada.</p>'
  return `<table><thead><tr>${cabeceras.map(c => `<th>${escapar(c)}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${f.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}
const lista = (items: any[]) => (items.length ? `<ul>${items.map(i => `<li>${escapar(typeof i === 'string' ? i : i?.texto ?? '')}</li>`).join('')}</ul>` : '<p class="vacio">Sin información registrada.</p>')
const bloque = (titulo: string, html: string) => (html && html.replace(/<[^>]+>/g, '').trim() ? `<h3>${escapar(titulo)}</h3><div class="rico">${html}</div>` : '')

export function construirPaquete(d: DatosPaquete): string {
  const s = d.solucion
  const prd = J(s.prd) ?? {}
  const dis = J(s.disenoTecnico) ?? {}
  const plan = J(s.planEjecucion) ?? {}
  const arq = J(s.arquitectura) ?? {}
  const crono = arr(J(s.cronograma))
  const diagramas = arr(J(s.diagramas))
  const nodos = arr(arq.nodes ?? (Array.isArray(arq) ? arq : []))
  const conex = arr(arq.connections)
  const nombreNodo = (id: string) => nodos.find((n: any) => n.id === id)?.label ?? id
  const cambiosOk = d.cambios.filter(c => c.estado === 'APROBADA' || c.estado === 'IMPLEMENTADA')
  const titulo = `${s.nombre ?? 'Proyecto'} — Paquete de entrega`
  const estadoDoc = (x: any) => (x?.estadoDocumento ? `${String(x.estadoDocumento).replace('_', ' ').toLowerCase()}${x.aprobacion ? ` (aprobado por ${escapar(x.aprobacion.porNombre ?? '')} el ${fecha(x.aprobacion.en)})` : ''}` : 'borrador')

  const reqs = arr(prd.requisitos)
  const secciones: string[] = []

  secciones.push(`<section><h2>1. Resumen del proyecto</h2>
    ${bloque('Resumen ejecutivo', rico(prd.resumenEjecutivo))}${bloque('Problema que resuelve', rico(prd.problema))}${bloque('Objetivo general', rico(prd.objetivoGeneral))}
    <h3>Objetivos específicos</h3>${lista(arr(prd.objetivosEspecificos))}
    <h3>Dentro del alcance</h3>${lista(arr(prd.dentroDeAlcance))}
    <h3>Fuera del alcance</h3>${lista(arr(prd.fueraDeAlcance))}</section>`)

  secciones.push(`<section><h2>2. Requisitos (PRD — ${estadoDoc(prd)})</h2>
    ${tabla(['#', 'Requisito', 'Criterio de aceptación', 'Prioridad', 'Estado'], reqs.map((r, i) => [String(i + 1), `<div class="rico">${rico(r.texto)}</div>`, `<div class="rico">${rico(r.criterioAceptacion)}</div>`, escapar(r.prioridad ?? ''), escapar(String(r.estado ?? 'PROPUESTO').toLowerCase())]))}
    <h3>Requisitos no funcionales</h3>${tabla(['Categoría', 'Requisito'], arr(prd.requisitosNoFuncionales).map((r: any) => [escapar(r.categoria ?? ''), escapar(r.texto ?? '')]))}
    <h3>Métricas de éxito</h3>${tabla(['Métrica', 'Meta', 'Cómo se mide'], arr(prd.metricas).map((m: any) => [escapar(m.nombre ?? ''), escapar(m.meta ?? ''), escapar(m.comoSeMide ?? '')]))}</section>`)

  secciones.push(`<section><h2>3. Diseño técnico (${estadoDoc(dis)})</h2>
    ${bloque('Arquitectura general', rico(dis.arquitectura))}
    <h3>Modelo de datos</h3>${tabla(['Entidad', 'Atributos', 'Relaciones'], arr(dis.entidades).map((e: any) => [escapar(e.nombre ?? ''), escapar(e.atributos ?? ''), escapar(e.relaciones ?? '')]))}
    <h3>Stack tecnológico</h3>${tabla(['Capa', 'Tecnología', 'Justificación'], arr(dis.stack).map((e: any) => [escapar(e.capa ?? ''), escapar(e.tecnologia ?? ''), escapar(e.justificacion ?? '')]))}
    <h3>Integraciones</h3>${tabla(['Sistema', 'Propósito', 'Detalle', 'Si falla'], arr(dis.integraciones).map((e: any) => [escapar(e.sistema ?? ''), escapar(e.proposito ?? ''), escapar(e.detalle ?? ''), escapar(e.siFalla ?? '')]))}
    <h3>Decisiones técnicas</h3>${tabla(['Decisión', 'Alternativas', 'Justificación'], arr(dis.decisiones).map((e: any) => [escapar(e.decision ?? ''), escapar(e.alternativas ?? ''), escapar(e.justificacion ?? '')]))}
    ${bloque('Seguridad', rico(dis.seguridad))}${bloque('Escalabilidad y rendimiento', rico(dis.escalabilidad))}</section>`)

  secciones.push(`<section><h2>4. Arquitectura y diagramas</h2>
    <h3>Componentes</h3>${tabla(['Componente', 'Tipo'], nodos.map((n: any) => [escapar(n.label ?? ''), escapar(n.type ?? '')]))}
    <h3>Conexiones</h3>${conex.length ? `<ul>${conex.map((c: any) => `<li>${escapar(nombreNodo(c.from))} → ${escapar(nombreNodo(c.to))}</li>`).join('')}</ul>` : '<p class="vacio">Sin conexiones registradas.</p>'}
    ${diagramas.map((g: any) => `<h3>${escapar(g.titulo ?? 'Diagrama')}</h3><pre class="mermaid">${escapar(g.codigo ?? '')}</pre><details><summary>Ver el código del diagrama</summary><pre>${escapar(g.codigo ?? '')}</pre></details>`).join('')}</section>`)

  secciones.push(`<section><h2>5. Plan de ejecución (${estadoDoc(plan)})</h2>
    ${bloque('Pruebas y calidad (QA)', rico(plan.qa))}
    <h3>Ambientes</h3>${tabla(['Ambiente', 'Propósito', 'Quién despliega', 'Promoción'], arr(plan.ambientes).map((e: any) => [escapar(e.ambiente ?? ''), escapar(e.proposito ?? ''), escapar(e.despliega ?? ''), escapar(e.promocion ?? '')]))}
    ${bloque('Estrategia de release y rollback', rico(plan.release))}
    <h3>Responsables (RACI)</h3>${tabla(['Actividad', 'Responsable', 'Aprueba', 'Consultado', 'Informado'], arr(plan.raci).map((e: any) => [escapar(e.actividad ?? ''), escapar(e.responsable ?? ''), escapar(e.aprueba ?? ''), escapar(e.consultado ?? ''), escapar(e.informado ?? '')]))}
    ${bloque('Gestión de cambios', rico(plan.cambios))}
    <h3>Comunicación</h3>${tabla(['Qué', 'Audiencia', 'Frecuencia', 'Canal', 'Responsable'], arr(plan.comunicacion).map((e: any) => [escapar(e.que ?? ''), escapar(e.audiencia ?? ''), escapar(e.frecuencia ?? ''), escapar(e.canal ?? ''), escapar(e.responsable ?? '')]))}</section>`)

  secciones.push(`<section><h2>6. Cronograma</h2>${tabla(['Fase', 'Inicio', 'Fin', 'Estado'], crono.map((f: any) => [escapar(f.fase ?? ''), escapar(f.fechaInicio ?? '—'), escapar(f.fechaFin ?? '—'), escapar(String(f.estado ?? '').toLowerCase())]))}</section>`)

  const total = d.hitos.reduce((a, h) => a + (Number(h.monto) || 0), 0)
  secciones.push(`<section><h2>7. Entregables, hitos y aceptación</h2>
    ${tabla(['Hito / entregable', 'Fecha comprometida', 'Entrega real', 'Estado', 'Aceptación del cliente'], d.hitos.map(h => [
      `<b>${escapar(h.titulo ?? '')}</b>${h.descripcion ? `<br><span class="mut">${escapar(h.descripcion)}</span>` : ''}`,
      fecha(h.fechaComprometida), fecha(h.fechaReal), escapar(String(h.estado ?? '').toLowerCase()),
      h.aceptadoEn ? `${escapar(h.aceptadoPor ?? '')} — ${fecha(h.aceptadoEn)}${h.aceptadoNota ? `<br><span class="mut">${escapar(h.aceptadoNota)}</span>` : ''}` : 'pendiente',
    ]))}
    ${total > 0 ? `<p class="mut">Valor del proyecto: ${dinero(Number(s.valorEstimado) || 0)} · Calendario de pagos: ${dinero(total)}</p>` : ''}</section>`)

  secciones.push(`<section><h2>8. Cambios de alcance aprobados</h2>${tabla(['Cambio', 'Impacto en el alcance', 'Costo', 'Plazo', 'Aprobó'], cambiosOk.map(c => [
    `<b>${escapar(c.titulo ?? '')}</b>`, escapar(c.impactoAlcance ?? c.descripcion ?? ''), c.impactoCosto ? dinero(c.impactoCosto) : '—', c.impactoDias ? `+${c.impactoDias} día(s)` : '—', `${escapar(c.decididoPor ?? '')} (${fecha(c.decididoEn)})`]))}</section>`)

  secciones.push(`<section><h2>9. Riesgos</h2>${tabla(['Riesgo', 'Severidad', 'Probabilidad', 'Estado', 'Mitigación'], d.riesgos.map(r => [`<b>${escapar(r.titulo ?? '')}</b>${r.descripcion ? `<br><span class="mut">${escapar(r.descripcion)}</span>` : ''}`, escapar(r.severidad ?? ''), escapar(r.probabilidad ?? ''), escapar(String(r.estado ?? '').toLowerCase()), escapar(r.mitigacion ?? '')]))}</section>`)

  secciones.push(`<section class="acta"><h2>10. Acta de aceptación</h2>
    <p>Con la firma de este documento, <b>${escapar(d.cliente || 'el cliente')}</b> declara que recibió el proyecto <b>${escapar(s.nombre ?? '')}</b> con los entregables listados en la sección 7 y su documentación (secciones 1 a 6), y que lo acepta${cambiosOk.length ? ', incluidos los cambios de alcance de la sección 8' : ''}.</p>
    ${s.deployUrl ? `<p>Sistema en producción: ${escapar(s.deployUrl)}</p>` : ''}${s.repositorio ? `<p>Repositorio del código: ${escapar(s.repositorio)}</p>` : ''}
    <div class="firmas"><div><div class="linea"></div>Por el cliente<br><span class="mut">Nombre, cargo y fecha</span></div><div><div class="linea"></div>Por ArchiTechIA<br><span class="mut">Nombre, cargo y fecha</span></div></div></section>`)

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(titulo)}</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111827;max-width:900px;margin:0 auto;padding:32px 24px;line-height:1.55;font-size:14px}
h1{font-size:28px;margin:0 0 4px}h2{font-size:19px;margin:36px 0 10px;padding-bottom:6px;border-bottom:2px solid #e5e7eb}h3{font-size:15px;margin:18px 0 6px;color:#374151}
table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:12.5px}th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f3f4f6}
.mut,.vacio{color:#6b7280;font-size:12px}.rico p{margin:4px 0}pre{background:#f3f4f6;padding:10px;border-radius:6px;overflow:auto;font-size:12px}pre.mermaid{background:#fff;border:1px solid #e5e7eb;text-align:center}
.portada{border:1px solid #e5e7eb;border-radius:10px;padding:24px;margin-bottom:8px}.firmas{display:flex;gap:48px;margin-top:64px}.firmas>div{flex:1;font-size:13px}.linea{border-top:1px solid #111;margin-bottom:6px}
@media print{body{padding:0;max-width:none}section{break-inside:auto}h2{break-after:avoid}table,pre{break-inside:avoid}.noprint{display:none}}
</style></head><body>
<div class="portada"><p class="mut">Paquete de entrega · generado el ${fecha(new Date().toISOString())}${d.version ? ` · ${escapar(d.version)}` : ''}</p>
<h1>${escapar(s.nombre ?? 'Proyecto')}</h1><p>${escapar(d.cliente || s.empresa || '')}</p><p class="mut">${escapar(String(s.descripcion ?? ''))}</p></div>
<p class="noprint mut">Para guardarlo como PDF usa Imprimir → Guardar como PDF. Los diagramas se dibujan al abrir este archivo con conexión a internet; su código también está incluido.</p>
${secciones.join('\n')}
<script type="module">
try{const m=(await import('https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs')).default;m.initialize({startOnLoad:false,theme:'default',securityLevel:'strict'});await m.run({querySelector:'pre.mermaid'})}catch(e){}
</script></body></html>`
}

export function descargarArchivo(nombre: string, contenido: string, tipo = 'text/html;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
