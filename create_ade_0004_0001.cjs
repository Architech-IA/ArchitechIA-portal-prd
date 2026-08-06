const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0004-0001' } })
  if (!sprint) throw new Error('Sprint ADE-0004-0001 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0004-0001-001', title: 'Definir contrato de tarea del Harness', description: 'Especificar el schema de una tarea: id, tipo, agente destino, payload, prioridad, estado y callbacks.' },
    { taskCode: 'ADE-0004-0001-002', title: 'Diseñar ciclo de vida de una tarea', description: 'Diagrama y documentación de los estados posibles: PENDING → IN_PROGRESS → DONE / FAILED / RETRY.' },
    { taskCode: 'ADE-0004-0001-003', title: 'Implementar dispatcher básico', description: 'Módulo que recibe una tarea, determina qué agente la ejecuta y la encola en Redis.' },
    { taskCode: 'ADE-0004-0001-004', title: 'Implementar listener de resultados', description: 'Worker que escucha la cola de resultados y actualiza el estado de la tarea en el registro central.' },
    { taskCode: 'ADE-0004-0001-005', title: 'Test de flujo completo dispatcher → agente → resultado', description: 'Validar que una tarea enviada al Harness llega al agente correcto y el resultado se registra correctamente.' },
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

  console.log('Done — 5 items creados para ADE-0004-0001')
}

main().catch(console.error).finally(() => prisma.$disconnect())
