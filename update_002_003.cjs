const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function updateDone(taskCode, resultado) {
  await prisma.backlogItem.update({
    where: { taskCode },
    data: { status: 'DONE', resultado, fechaEjecucion: new Date() }
  })
  console.log('DONE:', taskCode)
}

async function main() {
  await updateDone('ADE-0001-0001-002',
    'Modelo Agent creado en prisma/schema.prisma con campos: slug (unique), name, role, area, personality, systemPrompt, taskTypes (String[]), repos (String[]), discordUserId, vaultPath, status (default ACTIVE), timestamps. Modelo agregado al final del schema sin afectar modelos existentes.')

  await updateDone('ADE-0001-0001-003',
    'Migración ejecutada con "npx prisma db push" exitosamente. Tabla Agent creada en Supabase (PostgreSQL). Prisma Client regenerado con el nuevo modelo Agent disponible. Sin pérdida de datos — operación aditiva.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
