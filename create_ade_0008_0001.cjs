const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0008-0001' } })
  if (!sprint) throw new Error('Sprint ADE-0008-0001 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0008-0001-001', title: 'Definir criterios de tareas que requieren aprobación', description: 'Establecer qué tipos de tareas deben pasar por revisión humana antes de ejecutarse (destructivas, financieras, publicación).' },
    { taskCode: 'ADE-0008-0001-002', title: 'Implementar estado AWAITING_APPROVAL en el Harness', description: 'Antes de ejecutar una tarea de alto riesgo, el Harness la pone en espera y notifica al responsable.' },
    { taskCode: 'ADE-0008-0001-003', title: 'Implementar notificación de aprobación por Discord', description: 'El bot envía un mensaje al canal con el detalle de la tarea y botones de Aprobar / Rechazar.' },
    { taskCode: 'ADE-0008-0001-004', title: 'Implementar handler de respuesta de aprobación', description: 'Al presionar Aprobar, la tarea se encola para ejecución; al Rechazar, se cancela con motivo registrado.' },
    { taskCode: 'ADE-0008-0001-005', title: 'Test del flujo completo de aprobación', description: 'Encolar una tarea que requiere aprobación y verificar el flujo completo desde notificación hasta ejecución.' },
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

  console.log('Done — 5 items creados para ADE-0008-0001')
}

main().catch(console.error).finally(() => prisma.$disconnect())
