const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0006-0002' } })
  if (!sprint) throw new Error('Sprint ADE-0006-0002 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0006-0002-001', title: 'Implementar método para cambiar estado de tarea', description: 'Llamada al portal que actualiza el status de un BacklogItem (TODO → IN_PROGRESS → DONE) desde el agente.' },
    { taskCode: 'ADE-0006-0002-002', title: 'Implementar registro de resultado en la tarea', description: 'Al completar una tarea, el agente guarda el resultado/output como campo resultado en el BacklogItem.' },
    { taskCode: 'ADE-0006-0002-003', title: 'Implementar marcado automático al iniciar ejecución', description: 'El agente marca la tarea como IN_PROGRESS en el portal en el momento que comienza a ejecutarla.' },
    { taskCode: 'ADE-0006-0002-004', title: 'Implementar marcado automático al finalizar', description: 'Al terminar (éxito o fallo), el agente actualiza el estado final y registra duración de ejecución.' },
    { taskCode: 'ADE-0006-0002-005', title: 'Test de ciclo completo agente → portal', description: 'Verificar que todo el ciclo de vida de una tarea se refleja en tiempo real en el portal.' },
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

  console.log('Done — 5 items creados para ADE-0006-0002')
}

main().catch(console.error).finally(() => prisma.$disconnect())
