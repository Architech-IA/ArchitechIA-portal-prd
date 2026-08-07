const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

prisma.sprint.findFirst({
  where: { sprintCode: 'ADE-0001-0002' },
  include: { items: { orderBy: { order: 'asc' } } }
}).then(s => {
  console.log('Sprint:', s.sprintCode, '-', s.name)
  s.items.forEach(i => console.log(' ', i.taskCode, '|', i.status, '|', i.title, '\n   ', i.description))
}).finally(() => prisma.$disconnect())
