const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0004-0002' } })
  if (!sprint) throw new Error('Sprint ADE-0004-0002 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0004-0002-001', title: 'Instalar y configurar Redis en VPS', description: 'Instalar Redis, configurar persistencia RDB y verificar que el servicio arranca con el sistema.' },
    { taskCode: 'ADE-0004-0002-002', title: 'Implementar encolado de tareas con BullMQ', description: 'Configurar BullMQ (o rq en Python) sobre Redis para gestionar las colas por agente.' },
    { taskCode: 'ADE-0004-0002-003', title: 'Implementar worker por agente', description: 'Worker que consume su cola dedicada, ejecuta la tarea y publica el resultado en la cola de retorno.' },
    { taskCode: 'ADE-0004-0002-004', title: 'Implementar reintentos y dead-letter queue', description: 'Configurar política de reintentos (máx 3) y cola de tareas fallidas para revisión manual.' },
    { taskCode: 'ADE-0004-0002-005', title: 'Dashboard de monitoreo de colas', description: 'Integrar Bull Board o similar para visualizar el estado de las colas en tiempo real.' },
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

  console.log('Done — 5 items creados para ADE-0004-0002')
}

main().catch(console.error).finally(() => prisma.$disconnect())
