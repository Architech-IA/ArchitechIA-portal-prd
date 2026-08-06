const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0008-0002' } })
  if (!sprint) throw new Error('Sprint ADE-0008-0002 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0008-0002-001', title: 'Diseñar formato de reporte de avance', description: 'Definir la estructura del reporte: tareas completadas, en progreso, bloqueadas, tiempo promedio por tarea.' },
    { taskCode: 'ADE-0008-0002-002', title: 'Implementar generación automática de reporte', description: 'Script que consulta el portal y Obsidian para armar el reporte de avance del sprint activo.' },
    { taskCode: 'ADE-0008-0002-003', title: 'Implementar envío de reporte por Discord', description: 'El bot publica el reporte en un canal dedicado (#reportes) en formato embed de Discord.' },
    { taskCode: 'ADE-0008-0002-004', title: 'Implementar reporte bajo demanda vía comando', description: 'Slash command /reporte que genera y envía el reporte inmediatamente al canal que lo solicita.' },
    { taskCode: 'ADE-0008-0002-005', title: 'Test de reporte end-to-end con datos reales', description: 'Ejecutar el reporte con tareas reales del sprint y verificar que los datos son precisos y el formato es legible.' },
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

  console.log('Done — 5 items creados para ADE-0008-0002')
}

main().catch(console.error).finally(() => prisma.$disconnect())
