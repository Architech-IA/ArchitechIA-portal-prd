const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0006-0001' } })
  if (!sprint) throw new Error('Sprint ADE-0006-0001 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0006-0001-001', title: 'Diseñar cliente HTTP para la API del portal', description: 'Módulo Python que encapsula los calls a la API REST del Portal Interno para leer backlog items.' },
    { taskCode: 'ADE-0006-0001-002', title: 'Implementar listado de tareas asignadas al agente', description: 'Endpoint o método que retorna los BacklogItems en estado TODO asignados a un agente específico.' },
    { taskCode: 'ADE-0006-0001-003', title: 'Implementar lectura de detalle de tarea', description: 'Método que dado un taskCode retorna el título, descripción, sprint y prioridad de la tarea.' },
    { taskCode: 'ADE-0006-0001-004', title: 'Implementar filtrado por sprint activo', description: 'Filtrar las tareas por el sprint actualmente en progreso para que el agente priorice correctamente.' },
    { taskCode: 'ADE-0006-0001-005', title: 'Test de sincronización portal → agente', description: 'Crear una tarea en el portal y verificar que el agente la lee correctamente a través del Bridge.' },
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

  console.log('Done — 5 items creados para ADE-0006-0001')
}

main().catch(console.error).finally(() => prisma.$disconnect())
