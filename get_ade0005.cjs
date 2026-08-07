const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.sprint.findMany({
  where: { sprintCode: { startsWith: 'ADE-0005' } },
  include: { items: { orderBy: { taskCode: 'asc' } } },
  orderBy: { sprintCode: 'asc' },
}).then(sprints => { console.log(JSON.stringify(sprints, null, 2)); p.$disconnect(); });
