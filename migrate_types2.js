const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const TYPE_CODES = { DESARROLLO:'DV', BUG:'BG', TECH_DEBT:'TD', DOCUMENTACION:'DO', INVESTIGACION:'IN', TEST_QA:'QA' }

async function main() {
  // 1. Migrate FEATURE → DESARROLLO, EPIC → TEST_QA
  const map = { FEATURE: 'DESARROLLO', EPIC: 'TEST_QA' }
  for (const [from, to] of Object.entries(map)) {
    const r = await p.backlogItem.updateMany({ where: { type: from }, data: { type: to } })
    console.log(`${from} → ${to}: ${r.count} items`)
  }

  // 2. Re-backfill taskCodes for sprint items
  const items = await p.backlogItem.findMany({
    where: { sprintId: { not: null } },
    include: { sprint: { select: { sprintCode: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const counters = {}
  for (const item of items) {
    const sprintCode = item.sprint?.sprintCode
    if (!sprintCode) continue
    const typeCode = TYPE_CODES[item.type] ?? 'DV'
    const key = `${sprintCode}-${typeCode}`
    counters[key] = (counters[key] || 0) + 1
    const taskCode = `${sprintCode}-${typeCode}${String(counters[key]).padStart(3, '0')}`
    await p.backlogItem.update({ where: { id: item.id }, data: { taskCode } })
    console.log(`  ${item.title.slice(0,35).padEnd(35)} → ${taskCode}`)
  }
  console.log('\nDone')
}

main().catch(console.error).finally(() => p.$disconnect())
