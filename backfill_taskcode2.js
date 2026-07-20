const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const TYPE_CODES = { FEATURE:'FE', BUG:'BG', TECH_DEBT:'TD', DOCUMENTACION:'DO', INVESTIGACION:'IN', EPIC:'EP' }

async function main() {
  const items = await p.backlogItem.findMany({
    where: { sprintId: { not: null } },
    include: { sprint: { select: { sprintCode: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // Group by sprintId + typeCode
  const counters = {}
  for (const item of items) {
    const sprintCode = item.sprint?.sprintCode
    if (!sprintCode) continue
    const typeCode = TYPE_CODES[item.type] ?? 'FE'
    const key = `${sprintCode}-${typeCode}`
    counters[key] = (counters[key] || 0) + 1
    const taskCode = `${sprintCode}-${typeCode}${String(counters[key]).padStart(3, '0')}`
    await p.backlogItem.update({ where: { id: item.id }, data: { taskCode } })
    console.log(`  ${item.title.slice(0,35).padEnd(35)} → ${taskCode}`)
  }
  console.log('\nBackfill done')
}

main().catch(console.error).finally(() => p.$disconnect())
