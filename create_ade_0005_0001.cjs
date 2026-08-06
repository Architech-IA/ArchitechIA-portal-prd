const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0005-0001' } })
  if (!sprint) throw new Error('Sprint ADE-0005-0001 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0005-0001-001', title: 'Investigar modo headless de Claude Code', description: 'Documentar los flags y opciones para invocar Claude Code sin interfaz (stdin/stdout, JSON mode, --print).' },
    { taskCode: 'ADE-0005-0001-002', title: 'Implementar wrapper de invocación headless', description: 'Función Python que construye y ejecuta el comando Claude Code con un prompt dado y retorna el output.' },
    { taskCode: 'ADE-0005-0001-003', title: 'Manejar contexto de archivos en la invocación', description: 'Pasar archivos de contexto (notas Obsidian, fragmentos de código) al prompt de Claude Code headless.' },
    { taskCode: 'ADE-0005-0001-004', title: 'Implementar parsing del output estructurado', description: 'Parsear la respuesta de Claude Code (texto plano o JSON) para extraer acciones, código generado o decisiones.' },
    { taskCode: 'ADE-0005-0001-005', title: 'Test de invocación completa con tarea real', description: 'Enviar una tarea real a Claude Code headless y verificar que el output es procesable por el Harness.' },
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

  console.log('Done — 5 items creados para ADE-0005-0001')
}

main().catch(console.error).finally(() => prisma.$disconnect())
