const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0007-0002' } })
  if (!sprint) throw new Error('Sprint ADE-0007-0002 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0007-0002-001', title: 'Definir tabla de routing por canal/agente', description: 'Mapeo que asocia cada canal de Discord con el agente SAGE responsable (ej. #sales → Ares, #finance → Vesta).' },
    { taskCode: 'ADE-0007-0002-002', title: 'Implementar router de mensajes', description: 'Módulo que recibe un mensaje del bot y lo direcciona al agente correcto según el canal y contenido.' },
    { taskCode: 'ADE-0007-0002-003', title: 'Implementar mención directa de agente', description: 'Si el mensaje menciona explícitamente a un agente (@Ares, @Vesta), el router lo prioriza sobre el canal.' },
    { taskCode: 'ADE-0007-0002-004', title: 'Implementar respuesta con identidad del agente', description: 'Cada agente responde con su nombre y personalidad definida, no como bot genérico.' },
    { taskCode: 'ADE-0007-0002-005', title: 'Test de routing multiagente en mismo servidor', description: 'Enviar mensajes a distintos canales y verificar que cada uno llega al agente correcto con su identidad.' },
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

  console.log('Done — 5 items creados para ADE-0007-0002')
}

main().catch(console.error).finally(() => prisma.$disconnect())
