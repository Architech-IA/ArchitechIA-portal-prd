const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0004-0003' } })
  if (!sprint) throw new Error('Sprint ADE-0004-0003 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0004-0003-001', title: 'Diseñar estrategia de locks distribuidos', description: 'Definir cuándo y sobre qué recursos se aplica un lock (vault de agente, tarea compartida, recurso externo).' },
    { taskCode: 'ADE-0004-0003-002', title: 'Implementar lock/unlock con Redis SETNX', description: 'Mecanismo de lock distribuido usando SETNX + TTL para evitar condiciones de carrera entre agentes.' },
    { taskCode: 'ADE-0004-0003-003', title: 'Implementar detección de deadlocks', description: 'Lógica que detecta y rompe locks expirados o huérfanos para evitar bloqueos indefinidos.' },
    { taskCode: 'ADE-0004-0003-004', title: 'Implementar canal de coordinación entre agentes', description: 'Canal pub/sub en Redis para que los agentes se notifiquen eventos entre sí (tarea lista, recurso liberado).' },
    { taskCode: 'ADE-0004-0003-005', title: 'Test de concurrencia: dos agentes sobre recurso compartido', description: 'Simular dos agentes intentando escribir simultáneamente y validar que el lock resuelve el conflicto correctamente.' },
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

  console.log('Done — 5 items creados para ADE-0004-0003')
}

main().catch(console.error).finally(() => prisma.$disconnect())
