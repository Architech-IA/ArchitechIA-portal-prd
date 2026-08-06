const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0003-0003' } })
  if (!sprint) throw new Error('Sprint ADE-0003-0003 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0003-0003-001', title: 'Definir convención de nombres y rutas', description: 'Establecer el esquema de rutas dentro del vault: /agents/{agent_id}/memoria/, /agents/{agent_id}/tareas/, etc.' },
    { taskCode: 'ADE-0003-0003-002', title: 'Crear plantilla de nota de sesión', description: 'Template markdown que cada agente usa al iniciar una sesión: fecha, contexto activo, objetivos, decisiones tomadas.' },
    { taskCode: 'ADE-0003-0003-003', title: 'Crear plantilla de nota de entidad', description: 'Template para registrar entidades clave (cliente, proyecto, lead) con campos estándar por tipo de entidad.' },
    { taskCode: 'ADE-0003-0003-004', title: 'Implementar inicialización de vault por agente', description: 'Script que crea la estructura de carpetas y notas base al registrar un nuevo agente en el sistema.' },
    { taskCode: 'ADE-0003-0003-005', title: 'Validar acceso aislado entre agentes', description: 'Verificar que el wrapper solo permite a cada agente leer/escribir dentro de su propia carpeta del vault.' },
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

  console.log('Done — 5 items creados para ADE-0003-0003')
}

main().catch(console.error).finally(() => prisma.$disconnect())
