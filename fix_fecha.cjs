const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  { taskCode: 'ADE-0003-0001-001', fecha: '2026-08-07T08:53:00Z' }, // Instalar vault
  { taskCode: 'ADE-0003-0001-002', fecha: '2026-08-07T08:58:00Z' }, // Estructura vault
  { taskCode: 'ADE-0003-0001-003', fecha: '2026-08-07T09:04:00Z' }, // Vault API
  { taskCode: 'ADE-0003-0001-004', fecha: '2026-08-07T09:09:00Z' }, // Test lectura/escritura
  { taskCode: 'ADE-0003-0001-005', fecha: '2026-08-07T09:13:00Z' }, // Documentar endpoints
];

async function run() {
  for (const item of items) {
    await p.backlogItem.update({
      where: { taskCode: item.taskCode },
      data: { fechaEjecucion: new Date(item.fecha) },
    });
    console.log(`✓ ${item.taskCode} → ${item.fecha.slice(11, 16)}`);
  }
  await p.$disconnect();
}

run();
