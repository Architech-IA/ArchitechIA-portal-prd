const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Get all items with sprintId but no taskCode
  const items = await prisma.backlogItem.findMany({
    where: { sprintId: { not: null }, taskCode: null },
    include: { sprint: { select: { sprintCode: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // Group by sprintId
  const bySprintId = {}
  for (const item of items) {
    if (!bySprintId[item.sprintId]) bySprintId[item.sprintId] = []
    bySprintId[item.sprintId].push(item)
  }

  let updated = 0
  for (const [sprintId, sprintItems] of Object.entries(bySprintId)) {
    const sprint = sprintItems[0].sprint
    const sprintCode = sprint?.sprintCode
    if (!sprintCode) { console.log(`Sprint ${sprintId} has no sprintCode, skipping`); continue }

    for (let i = 0; i < sprintItems.length; i++) {
      const taskCode = `${sprintCode}-T${i + 1}`
      await prisma.backlogItem.update({ where: { id: sprintItems[i].id }, data: { taskCode } })
      console.log(`  ${sprintItems[i].title.slice(0, 40)} → ${taskCode}`)
      updated++
    }
  }
  console.log(`\nBackfill done: ${updated} items updated`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
