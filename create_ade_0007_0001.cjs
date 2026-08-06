const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0007-0001' } })
  if (!sprint) throw new Error('Sprint ADE-0007-0001 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0007-0001-001', title: 'Configurar bot de Discord con discord.py', description: 'Crear aplicación en Discord Developer Portal, obtener token y conectar el bot al servidor SAGE.' },
    { taskCode: 'ADE-0007-0001-002', title: 'Implementar listener de mensajes por canal', description: 'El bot escucha mensajes en canales designados y detecta si están dirigidos a un agente específico.' },
    { taskCode: 'ADE-0007-0001-003', title: 'Implementar respuesta simple del bot', description: 'El bot puede responder en el mismo canal con el output del agente, manteniendo el hilo de conversación.' },
    { taskCode: 'ADE-0007-0001-004', title: 'Implementar comando /tarea para encolar trabajo', description: 'Slash command que permite a Orión u otro agente encolar una tarea para un agente SAGE vía el Harness.' },
    { taskCode: 'ADE-0007-0001-005', title: 'Test de flujo Discord → agente → respuesta en canal', description: 'Enviar un mensaje al bot y verificar que la respuesta del agente aparece correctamente en Discord.' },
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

  console.log('Done — 5 items creados para ADE-0007-0001')
}

main().catch(console.error).finally(() => prisma.$disconnect())
