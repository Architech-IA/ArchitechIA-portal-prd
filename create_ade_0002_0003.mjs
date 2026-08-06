const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.backlogSprint.findFirst({
    where: { sprintCode: 'ADE-0002-0003' }
  })
  if (!sprint) throw new Error('Sprint ADE-0002-0003 no encontrado')
  console.log('Sprint:', sprint.id, sprint.nombre)

  const userId = 'cms80vrth0001l06u1rip4c4v'

  const items = [
    {
      taskCode: 'ADE-0002-0003-001',
      titulo: 'Definir registro de repos indexados',
      descripcion: 'Estructura para registrar qué repos están indexados, cuándo fue la última indexación y su estado (activo, pendiente, error).',
    },
    {
      taskCode: 'ADE-0002-0003-002',
      titulo: 'Implementar indexación de segundo repo',
      descripcion: 'Extender Graphify para indexar un segundo repositorio y validar que los grafos coexisten sin conflicto en el mismo store.',
    },
    {
      taskCode: 'ADE-0002-0003-003',
      titulo: 'Implementar webhook de actualización por commit',
      descripcion: 'Trigger que re-indexa automáticamente un repo cuando llega un nuevo commit a la rama main del repositorio correspondiente.',
    },
    {
      taskCode: 'ADE-0002-0003-004',
      titulo: 'Actualización incremental del grafo',
      descripcion: 'En lugar de re-indexar todo el repo, actualizar únicamente los archivos modificados en el commit para minimizar tiempo y costo.',
    },
    {
      taskCode: 'ADE-0002-0003-005',
      titulo: 'Prueba de consistencia multi-repo',
      descripcion: 'Validar que consultas cruzadas entre repos retornan contexto correcto sin mezclar nodos de repos distintos. Documentar resultados.',
    },
  ]

  for (const item of items) {
    const created = await prisma.backlogItem.create({
      data: {
        titulo: item.titulo,
        descripcion: item.descripcion,
        taskCode: item.taskCode,
        estado: 'TODO',
        prioridad: 'MEDIA',
        sprintId: sprint.id,
        responsableId: userId,
      }
    })
    console.log('✅', created.taskCode, '-', created.titulo)
  }

  console.log('\nDone — 5 items creados para ADE-0002-0003')
}

main().catch(console.error).finally(() => prisma.$disconnect())
