const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sprint = await prisma.sprint.findFirst({ where: { sprintCode: 'ADE-0003-0002' } })
  if (!sprint) throw new Error('Sprint ADE-0003-0002 no encontrado')
  console.log('Sprint:', sprint.id, sprint.name)

  const assigneeId = 'cms80vrth0001l06u1rip4c4v'
  const assigneeName = 'Freddy Orozco'

  const items = [
    { taskCode: 'ADE-0003-0002-001', title: 'Diseñar wrapper Python de la API Obsidian', description: 'Clase o módulo Python que encapsula los calls HTTP al plugin REST API (leer, crear, actualizar notas).' },
    { taskCode: 'ADE-0003-0002-002', title: 'Implementar lectura de nota por ruta', description: 'Método read_note(agent_id, note_path) que retorna el contenido markdown de una nota específica del vault.' },
    { taskCode: 'ADE-0003-0002-003', title: 'Implementar escritura y actualización de nota', description: 'Método write_note(agent_id, note_path, content) que crea o sobreescribe una nota en la carpeta del agente.' },
    { taskCode: 'ADE-0003-0002-004', title: 'Implementar búsqueda de notas por tag', description: 'Método search_notes(agent_id, tag) que lista notas filtradas por tag dentro de la carpeta del agente en el vault.' },
    { taskCode: 'ADE-0003-0002-005', title: 'Test de integración: flujo completo de memoria', description: 'Test end-to-end: agente escribe contexto → agente distinto lee ese contexto → validar consistencia del contenido.' },
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

  console.log('Done — 5 items creados para ADE-0003-0002')
}

main().catch(console.error).finally(() => prisma.$disconnect())
