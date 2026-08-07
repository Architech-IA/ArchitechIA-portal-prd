const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  { taskCode: 'ADE-0004-0003-001', fecha: '2026-08-07T11:10:00Z' },
  { taskCode: 'ADE-0004-0003-002', fecha: '2026-08-07T11:11:00Z' },
  { taskCode: 'ADE-0004-0003-003', fecha: '2026-08-07T11:12:00Z' },
  { taskCode: 'ADE-0004-0003-004', fecha: '2026-08-07T11:13:00Z' },
  { taskCode: 'ADE-0004-0003-005', fecha: '2026-08-07T11:15:00Z' },
];

async function run() {
  for (const item of items) {
    await p.backlogItem.update({
      where: { taskCode: item.taskCode },
      data: { fechaEjecucion: new Date(item.fecha) },
    });
    console.log('✓ ' + item.taskCode + ' → ' + item.fecha.slice(11, 16));
  }
  await p.$disconnect();
}

run();
