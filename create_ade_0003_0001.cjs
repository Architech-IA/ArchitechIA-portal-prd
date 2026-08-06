const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0003-0001' } })
  if (!sprint) throw new Error('Sprint ADE-0003-0001 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0003-0001-001', title: 'Instalar Obsidian headless en VPS', description: 'Instalar Obsidian CLI/AppImage en el VPS y verificar que puede abrir un vault sin interfaz gráfica.' },
    { taskCode: 'ADE-0003-0001-002', title: 'Crear estructura base del vault', description: 'Definir carpetas raíz del vault: /agents/, /shared/, /logs/, con plantillas base por tipo de nota.' },
    { taskCode: 'ADE-0003-0001-003', title: 'Configurar plugin Local REST API', description: 'Instalar y configurar el plugin obsidian-local-rest-api para exponer el vault como API HTTP en el VPS.' },
    { taskCode: 'ADE-0003-0001-004', title: 'Validar lectura/escritura vía API', description: 'Test manual: crear, leer y modificar una nota via curl contra la API local de Obsidian.' },
    { taskCode: 'ADE-0003-0001-005', title: 'Documentar endpoints disponibles', description: 'Registrar los endpoints expuestos por el plugin (GET, POST, PATCH) y sus parámetros en una nota del vault.' },
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

  console.log('Done — 5 items creados para ADE-0003-0001')
}

main().catch(console.error).finally(() => prisma.$disconnect())
