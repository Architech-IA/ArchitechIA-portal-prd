const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0002-0003' } })
  if (!sprint) throw new Error('Sprint ADE-0002-0003 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0002-0003-001', title: 'Definir registro de repos indexados', description: 'Estructura para registrar qué repos están indexados, cuándo fue la última indexación y su estado (activo, pendiente, error).' },
    { taskCode: 'ADE-0002-0003-002', title: 'Implementar indexación de segundo repo', description: 'Extender Graphify para indexar un segundo repositorio y validar que los grafos coexisten sin conflicto en el mismo store.' },
    { taskCode: 'ADE-0002-0003-003', title: 'Implementar webhook de actualización por commit', description: 'Trigger que re-indexa automáticamente un repo cuando llega un nuevo commit a la rama main del repositorio correspondiente.' },
    { taskCode: 'ADE-0002-0003-004', title: 'Actualización incremental del grafo', description: 'En lugar de re-indexar todo el repo, actualizar únicamente los archivos modificados en el commit para minimizar tiempo y costo.' },
    { taskCode: 'ADE-0002-0003-005', title: 'Prueba de consistencia multi-repo', description: 'Validar que consultas cruzadas entre repos retornan contexto correcto sin mezclar nodos de repos distintos. Documentar resultados.' },
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

  console.log('Done — 5 items creados para ADE-0002-0003')
}

main().catch(console.error).finally(() => prisma.$disconnect())
