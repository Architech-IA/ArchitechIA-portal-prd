import { prisma } from '@/lib/prisma'
import { getDateStrUTC5 } from '@/lib/timezone'
import { htmlATextoPlano } from '@/lib/textoAHtml'

// Contexto completo de un lead para el asistente de IA del Hub de Lead: datos
// comerciales, notas de TODAS las fases (la activa con mas detalle), archivos,
// interacciones, propuestas, solucion asociada, diagrama y reuniones. Devuelve
// texto listo para el prompt; no escribe nada.

export const FASES_LEAD: { key: string; label: string; guia: string }[] = [
  { key: 'NEW', label: 'Identificación', guia: 'quién es el prospecto (empresa, sector, tamaño), quién decide, cómo llegó, qué problema se intuye y la hipótesis inicial de valor' },
  { key: 'CONTACTED', label: 'Contacto', guia: 'primer contacto: canal, fecha, con quién se habló, qué respondió, nivel de interés y acuerdos o próximos pasos' },
  { key: 'DIAGNOSIS', label: 'Diagnóstico', guia: 'necesidades y alcance: procesos actuales, herramientas que usan, dolores, objetivos, restricciones, presupuesto, urgencia, decisores y criterios de éxito' },
  { key: 'DEMO_VALIDATION', label: 'Demo', guia: 'qué se demostró, quién asistió, reacciones, objeciones, ajustes pedidos y validaciones logradas' },
  { key: 'PROPOSAL_SENT', label: 'Propuesta', guia: 'alcance, entregables, fases, precio, plazos, supuestos, exclusiones y condiciones de la propuesta técnica y comercial' },
  { key: 'NEGOTIATION', label: 'Negociación', guia: 'objeciones, condiciones pedidas, cambios de precio o alcance, quién falta por aprobar y qué falta para cerrar' },
  { key: 'RESULT', label: 'Resultado', guia: 'resultado (ganado o perdido), motivo, lecciones aprendidas y, si se ganó, cómo pasa a ejecución' },
]

function textoFase(content: string | null): string {
  if (!content) return ''
  try {
    const p = JSON.parse(content) as { tabs?: { name?: string; content?: string }[] }
    if (Array.isArray(p.tabs)) {
      return p.tabs
        .map(t => ({ n: t.name || 'Nota', c: htmlATextoPlano(t.content || '') }))
        .filter(t => t.c)
        .map(t => `[${t.n}] ${t.c.replace(/\n+/g, ' ')}`)
        .join(' | ')
    }
  } catch {}
  return htmlATextoPlano(content).replace(/\n+/g, ' ')
}

function corta(t: string, max: number): string {
  return t.length > max ? t.slice(0, max) + '…' : t
}

export async function contextoLead(leadId: string, faseActiva: string): Promise<{ texto: string; empresa: string } | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      cliente: { select: { nombre: true } },
      user: { select: { name: true } },
      proposals: { select: { title: true, description: true, amount: true, status: true, tasks: { select: { title: true, completed: true } } } },
      activities: { select: { type: true, description: true, date: true }, orderBy: { createdAt: 'desc' }, take: 25 },
      solucion: { select: { id: true, nombre: true, estado: true, valorEstimado: true, prd: true, disenoTecnico: true } },
    },
  })
  if (!lead) return null

  const fases = await prisma.leadHub.findMany({
    where: { leadId }, orderBy: { createdAt: 'asc' },
    select: { phase: true, content: true, files: { select: { name: true } } },
  })
  const porFase = new Map(fases.map(f => [f.phase, f]))

  const partes: string[] = []
  const faseAct = FASES_LEAD.find(f => f.key === faseActiva)
  partes.push(`## Fecha de hoy\n${getDateStrUTC5(new Date())} (UTC-5)`)
  partes.push(`## Estado del pipeline\nFase actual del lead: ${FASES_LEAD.find(f => f.key === lead.status)?.label ?? lead.status}${lead.outcome ? ` | Desenlace: ${lead.outcome}${lead.lostReason ? ` (motivo: ${lead.lostReason})` : ''}` : ''}\nFase que la persona está viendo ahora: ${faseAct?.label ?? faseActiva}`)

  partes.push(`## Datos del lead\n${[
    `Empresa: ${lead.companyName}`, lead.cliente?.nombre ? `Cliente: ${lead.cliente.nombre}` : '',
    `Contacto: ${lead.contactName}`, `Email: ${lead.email}`, lead.phone ? `Teléfono: ${lead.phone}` : '',
    `Fuente: ${lead.source}`, `Valor estimado: ${lead.estimatedValue}`, lead.user?.name ? `Responsable: ${lead.user.name}` : '',
    lead.tipo ? `Tipo: ${lead.tipo}` : '', lead.solucionAsociada ? `Solución asociada: ${lead.solucionAsociada}` : '',
    lead.scope ? `Alcance: ${corta(htmlATextoPlano(lead.scope), 700)}` : '',
    lead.notes ? `Notas generales: ${corta(htmlATextoPlano(lead.notes), 700)}` : '',
    `Creado: ${getDateStrUTC5(lead.createdAt)}`,
  ].filter(Boolean).join('\n')}`)

  const notas = FASES_LEAD.map(f => {
    const t = textoFase(porFase.get(f.key)?.content ?? null)
    if (!t) return ''
    const activa = f.key === faseActiva
    return `- ${f.label}${activa ? ' (FASE QUE SE ESTÁ VIENDO)' : ''}: ${corta(t, activa ? 5000 : 1500)}`
  }).filter(Boolean).join('\n')
  if (notas) partes.push(`## Notas de las fases\n${notas}`)

  const archivos = fases.flatMap(f => f.files.map(x => `${FASES_LEAD.find(p => p.key === f.phase)?.label ?? f.phase}: ${x.name}`))
  if (archivos.length) partes.push(`## Archivos adjuntos (solo nombres)\n${corta(archivos.join('\n'), 800)}`)

  if (lead.activities.length) {
    partes.push(`## Interacciones con el cliente (recientes primero)\n${lead.activities
      .map(a => `- ${a.date ? getDateStrUTC5(a.date) + ' ' : ''}[${a.type}] ${htmlATextoPlano(a.description)}`).join('\n').slice(0, 4000)}`)
  }

  if (lead.proposals.length) {
    partes.push(`## Propuestas\n${lead.proposals.map(p =>
      `- ${p.title} (${p.status}, monto ${p.amount}): ${corta(htmlATextoPlano(p.description), 500)}${p.tasks.length ? ` | Tareas: ${p.tasks.map(t => `${t.completed ? '[x]' : '[ ]'} ${t.title}`).join(', ')}` : ''}`).join('\n').slice(0, 4000)}`)
  }

  if (lead.solucion) {
    let prdResumen = ''
    try { prdResumen = htmlATextoPlano(String(JSON.parse(lead.solucion.prd || '{}').resumenEjecutivo || '')) } catch {}
    partes.push(`## Solución ya creada para este lead\nNombre: ${lead.solucion.nombre} | Estado: ${lead.solucion.estado}${prdResumen ? `\nResumen del PRD: ${corta(prdResumen, 1200)}` : ''}`)
  }

  const dg = porFase.get('COMPONENT_DIAGRAM')
  if (dg?.content) {
    try {
      const d = JSON.parse(dg.content) as { nodes?: { label: string; description?: string }[] }
      if (Array.isArray(d.nodes) && d.nodes.length) partes.push(`## Diagrama de componentes (borrador)\n${d.nodes.map(n => `${n.label}${n.description ? ` [${n.description}]` : ''}`).join(', ')}`)
    } catch {}
  }

  const reuniones = await prisma.meeting.findMany({
    where: { title: { contains: lead.companyName, mode: 'insensitive' } },
    select: { title: true, description: true, notes: true, hub: true, date: true }, orderBy: { date: 'desc' }, take: 5,
  })
  if (reuniones.length) {
    partes.push(`## Reuniones que mencionan a la empresa\n${reuniones.map(m => {
      let hubTxt = ''
      try {
        const h = JSON.parse(m.hub || '{}') as { puntos?: { texto?: string }[]; notas?: string }
        hubTxt = [(h.puntos || []).map(p => p.texto).filter(Boolean).join('; '), textoFase(h.notas || '')].filter(Boolean).join(' | ')
      } catch {}
      return `- ${getDateStrUTC5(m.date)} ${m.title}: ${corta([m.description ? htmlATextoPlano(m.description) : '', m.notes ? htmlATextoPlano(m.notes) : '', hubTxt].filter(Boolean).join(' | '), 700)}`
    }).join('\n')}`)
  }

  return { texto: partes.join('\n\n').slice(0, 26000), empresa: lead.companyName }
}
