const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  { taskCode: 'ADE-0003-0002-001', fecha: '2026-08-07T09:08:00Z' },
  { taskCode: 'ADE-0003-0002-002', fecha: '2026-08-07T09:09:00Z' },
  { taskCode: 'ADE-0003-0002-003', fecha: '2026-08-07T09:10:00Z' },
  { taskCode: 'ADE-0003-0002-004', fecha: '2026-08-07T09:11:00Z' },
  { taskCode: 'ADE-0003-0002-005', fecha: '2026-08-07T09:12:00Z' },
];

async function run() {
  for (const item of items) {
    await p.backlogItem.update({
      where: { taskCode: item.taskCode },
      data: { fechaEjecucion: new Date(item.fecha) },
    });
    console.log(`✓ ${item.taskCode} → ${item.fecha.slice(11,16)}`);
  }
  await p.$disconnect();
}

run();
