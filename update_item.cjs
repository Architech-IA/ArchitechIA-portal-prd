const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function updateDone(taskCode, resultado) {
  const item = await prisma.backlogItem.findUnique({ where: { taskCode } })
  if (!item) throw new Error('Item no encontrado: ' + taskCode)
  await prisma.backlogItem.update({
    where: { taskCode },
    data: {
      status: 'DONE',
      resultado,
      fechaEjecucion: new Date(),
    }
  })
  console.log('DONE:', taskCode)
}

updateDone(
  'ADE-0001-0001-001',
  `Schema del agente definido con los siguientes campos:
- slug (unique): identificador del agente (ares, atlas, iris, orion, vesta)
- name: nombre del agente
- role: rol funcional (Sales, Operations, Marketing, Admin, Finance)
- area: área de la empresa
- personality: descripción de personalidad y comportamiento
- systemPrompt: prompt completo de sistema para Claude Code headless
- taskTypes: array de tipos de tarea permitidos (dev, planning, review, analysis)
- repos: array de URLs de repositorios asignados para Graphify
- discordUserId: ID del bot en Discord para routing
- vaultPath: ruta base en el vault de Obsidian (/agents/{slug}/)
- status: ACTIVE | INACTIVE
Schema documentado y listo para implementación en Prisma.`
).catch(console.error).finally(() => prisma.$disconnect())
