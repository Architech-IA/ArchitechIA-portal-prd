const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.sprint.findMany({
  where: { sprintCode: { in: ['ADE-0001-0001','ADE-0001-0002','ADE-0002-0001','ADE-0002-0002'] } },
  include: { items: { orderBy: { taskCode: 'asc' } } },
  orderBy: { sprintCode: 'asc' }
}).then(ss => {
  for (const s of ss) {
    console.log('\n=== ' + s.sprintCode + ' — ' + s.name);
    console.log('Goal:', s.goal);
    for (const i of s.items) console.log(' ', i.taskCode, '|', i.title);
  }
  p.$disconnect();
});
