const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function done(taskCode, resultado) {
  await prisma.backlogItem.update({ where: { taskCode }, data: { status: 'DONE', resultado, fechaEjecucion: new Date() } })
  console.log('DONE:', taskCode)
}

async function main() {
  await done('ADE-0001-0002-001',
    'CRUD completo implementado:\n- GET /api/agents — lista todos los agentes\n- POST /api/agents — crea nuevo agente\n- GET /api/agents/[slug] — detalle por slug\n- PUT /api/agents/[slug] — actualiza agente\n- DELETE /api/agents/[slug] — desactiva agente (soft delete)\nValidación de campos obligatorios en POST. Compatibilidad Next.js 15 con params async.')

  await done('ADE-0001-0002-002',
    'Vista /agents implementada con panel lateral de lista y área de detalle. Muestra: nombre, rol con color por área, estado (punto verde/gris), avatar con inicial. Ordenado por nombre. Navegación click para ver perfil completo.')

  await done('ADE-0001-0002-003',
    'Modal crear/editar con header naranja/morado estándar del portal. Campos: slug, nombre, rol (select), área, personalidad (textarea), systemPrompt (textarea monoespaciado), vault path, Discord ID. Validación de campos. Edición in-place con openEdit(agent).')

  await done('ADE-0001-0002-004',
    'Vista de detalle del agente con secciones: Personalidad, System Prompt (monoespaciado), Tipos de tarea (chips), Repositorios asignados, Vault Obsidian y Discord ID. Botones de editar y toggle de estado (ACTIVE/INACTIVE) en el header.')

  await done('ADE-0001-0002-005',
    'Agentes integrados en el selector de responsable del backlog sprint. Se fetcha /api/agents en paralelo con /api/users. Los agentes activos aparecen en el selector con sufijo "[Agente]" para distinguirlos de usuarios humanos. El assigneeName se setea automáticamente al seleccionar.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
