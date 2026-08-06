const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0009-0001' } })
  if (!sprint) throw new Error('Sprint ADE-0009-0001 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0009-0001-001', title: 'Diagrama de arquitectura general', description: 'Diagrama end-to-end del Dev Engine: Graphify → Harness → Executor → Obsidian → Discord, con flujo de datos.' },
    { taskCode: 'ADE-0009-0001-002', title: 'Documentar decisiones técnicas clave', description: 'Registrar en _decisiones/ el porqué de cada tecnología elegida (Redis, Obsidian, BullMQ, discord.py).' },
    { taskCode: 'ADE-0009-0001-003', title: 'Guía de onboarding para nuevo agente', description: 'Paso a paso para registrar un nuevo agente SAGE: identidad, vault, cola, canal Discord.' },
    { taskCode: 'ADE-0009-0001-004', title: 'Documentar contrato de tarea del Harness', description: 'Especificación formal del schema de tarea con ejemplos de payload por tipo.' },
    { taskCode: 'ADE-0009-0001-005', title: 'README principal del Dev Engine', description: 'Documento de entrada al proyecto: qué es, cómo funciona, cómo arrancarlo localmente en el VPS.' },
  ]

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const created = await prisma.backlogItem.create({
      data: {
        title: item.title,
        description: item.description,
        taskCode: item.taskCode,
        status: 'BACKLOG',
        priority: 'MEDIUM',
        sprintId: sprint.id,
        assigneeId,
        assigneeName,
        order: i + 1,
      }
    })
    console.log('OK', created.taskCode, '-', created.title)
  }

  console.log('Done — 5 items creados para ADE-0009-0001')
}

main().catch(console.error).finally(() => prisma.$disconnect())
