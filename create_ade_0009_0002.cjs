const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0009-0002' } })
  if (!sprint) throw new Error('Sprint ADE-0009-0002 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0009-0002-001', title: 'Runbook de arranque del sistema', description: 'Procedimiento para levantar todos los servicios del Dev Engine en el VPS en el orden correcto.' },
    { taskCode: 'ADE-0009-0002-002', title: 'Runbook de reinicio ante fallos', description: 'Qué hacer cuando un agente falla, cuando Redis se cae o cuando Obsidian no responde.' },
    { taskCode: 'ADE-0009-0002-003', title: 'Guía de monitoreo y alertas', description: 'Cómo interpretar el dashboard de colas, logs de Obsidian y métricas del Harness.' },
    { taskCode: 'ADE-0009-0002-004', title: 'Guía para agregar un nuevo repo a Graphify', description: 'Paso a paso para indexar un nuevo repositorio y conectarlo al sistema de consulta de agentes.' },
    { taskCode: 'ADE-0009-0002-005', title: 'Glosario del Dev Engine', description: 'Definición de los términos clave del sistema: Harness, Executor, Bridge, Vault, Lock, Sprint activo.' },
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

  console.log('Done — 5 items creados para ADE-0009-0002')
}

main().catch(console.error).finally(() => prisma.$disconnect())
