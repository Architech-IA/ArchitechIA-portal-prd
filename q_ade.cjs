const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.sprint.findMany({
  where: { sprintCode: { startsWith: 'ADE-' } },
  include: { items: true },
  orderBy: { sprintCode: 'asc' }
}).then(sprints => {
  for (const s of sprints) {
    console.log(s.sprintCode, '|', s.status, '|', s.items.length, 'items');
  }
  p.$disconnect();
});
