const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0005-0002' } })
  if (!sprint) throw new Error('Sprint ADE-0005-0002 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0005-0002-001', title: 'Implementar extractor de últimos commits', description: 'Función que dado un repo retorna los N commits más recientes con autor, fecha y mensaje.' },
    { taskCode: 'ADE-0005-0002-002', title: 'Implementar extractor de archivos modificados', description: 'Dado un commit o rango, listar los archivos modificados con su diff resumido.' },
    { taskCode: 'ADE-0005-0002-003', title: 'Construir resumen de contexto de repo', description: 'Combinar commits + archivos modificados en un bloque de contexto markdown listo para inyectar al agente.' },
    { taskCode: 'ADE-0005-0002-004', title: 'Integrar contexto de repo en la invocación headless', description: 'Pasar el resumen de contexto como parte del prompt del agente antes de ejecutar la tarea.' },
    { taskCode: 'ADE-0005-0002-005', title: 'Validar relevancia del contexto en la respuesta', description: 'Verificar que el agente usa el contexto del repo para tomar decisiones más precisas en su output.' },
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

  console.log('Done — 5 items creados para ADE-0005-0002')
}

main().catch(console.error).finally(() => prisma.$disconnect())
