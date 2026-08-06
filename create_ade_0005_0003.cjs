const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0005-0003' } })
  if (!sprint) throw new Error('Sprint ADE-0005-0003 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0005-0003-001', title: 'Implementar Executor base', description: 'Clase que recibe una tarea del Harness, prepara el contexto y lanza la invocación headless de Claude Code.' },
    { taskCode: 'ADE-0005-0003-002', title: 'Implementar timeout por tarea', description: 'Mecanismo que cancela la ejecución si supera el tiempo máximo configurado y registra el fallo.' },
    { taskCode: 'ADE-0005-0003-003', title: 'Implementar lógica de reintentos', description: 'Ante fallo o timeout, el Executor reencola la tarea con backoff exponencial hasta el máximo de intentos.' },
    { taskCode: 'ADE-0005-0003-004', title: 'Registrar logs de ejecución por tarea', description: 'Guardar en Obsidian un log por ejecución: input, output, duración, estado y número de intento.' },
    { taskCode: 'ADE-0005-0003-005', title: 'Test de resiliencia: fallo forzado y recuperación', description: 'Simular fallo en la primera ejecución y verificar que el reintento completa la tarea correctamente.' },
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

  console.log('Done — 5 items creados para ADE-0005-0003')
}

main().catch(console.error).finally(() => prisma.$disconnect())
