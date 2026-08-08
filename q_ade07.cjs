const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.sprint.findMany({
  where: { sprintCode: { startsWith: 'ADE-0007' } },
  include: { items: { orderBy: { taskCode: 'asc' } } },
  orderBy: { sprintCode: 'asc' }
}).then(sprints => {
  for (const s of sprints) {
    console.log('\n=== ' + s.sprintCode + ' (' + s.status + ') ===');
    console.log('Nombre:', s.name);
    console.log('Goal:', s.goal);
    for (const i of s.items) {
      console.log(' ', i.taskCode, '|', i.status, '|', i.title);
    }
  }
  p.$disconnect();
});
