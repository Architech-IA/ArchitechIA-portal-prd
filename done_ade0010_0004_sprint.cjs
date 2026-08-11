const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // Timestamps reales tomados de los logs de sage-bridge
  await p.sprint.update({
    where: { sprintCode: 'ADE-0010-0004' },
    data: {
      status: 'DONE',
      startDate: new Date('2026-08-08T21:37:33'),
      endDate:   new Date('2026-08-08T21:43:41'),
    }
  });
  console.log('✓ Sprint ADE-0010-0004 → DONE (21:37 - 21:43 UTC-5)');
  await p.$disconnect();
}
run();
