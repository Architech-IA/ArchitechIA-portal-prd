const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.sprint.findFirst({ where: { sprintCode: 'ADE-0004-0003' }, include: { items: { orderBy: { taskCode: 'asc' } } } })
  .then(s => { console.log(JSON.stringify(s, null, 2)); p.$disconnect(); });
