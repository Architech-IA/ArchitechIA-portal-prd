const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
prisma.sprint.findFirst({
  where: { sprintCode: 'ADE-0002-0001' },
  include: { items: { orderBy: { order: 'asc' } } }
}).then(s => {
  console.log('Sprint:', s.sprintCode, '-', s.name)
  s.items.forEach(i => console.log('\n ', i.taskCode, '|', i.status, '\n  Título:', i.title, '\n  Desc:', i.description))
}).finally(() => prisma.$disconnect())
