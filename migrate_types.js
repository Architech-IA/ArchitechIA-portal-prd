const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

// Migration map: old type → new type
const MAP = {
  'TASK':          'FEATURE',      // genérico → feature
  'task':          'FEATURE',
  'FEATURE':       'FEATURE',
  'IMPROVEMENT':   'FEATURE',
  'DESARROLLO':    'FEATURE',
  'COTIZACION':    'DOCUMENTACION',
  'BUG':           'BUG',
  'TECH_DEBT':     'TECH_DEBT',
  'DOCUMENTACION': 'DOCUMENTACION',
  'INVESTIGACION': 'INVESTIGACION',
  'EPIC':          'EPIC',
}

async function main() {
  const items = await p.backlogItem.findMany({ select: { id: true, type: true } })
  let updated = 0
  for (const item of items) {
    const newType = MAP[item.type]
    if (newType && newType !== item.type) {
      await p.backlogItem.update({ where: { id: item.id }, data: { type: newType } })
      console.log(`  ${item.type} → ${newType}`)
      updated++
    }
  }
  console.log(`\nMigration done: ${updated} items updated`)
}

main().catch(console.error).finally(() => p.$disconnect())
