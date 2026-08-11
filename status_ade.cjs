const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const epics = await p.epic.findMany({
    where: { solucion: { nombre: { contains: 'Dev Engine' } } },
    include: {
      sprints: {
        include: { items: { select: { status: true } } },
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  let totalSprints = 0, totalSprintsDone = 0, totalItems = 0, totalDone = 0;

  epics.forEach((e, idx) => {
    const allItems = e.sprints.flatMap(s => s.items);
    const doneItems = allItems.filter(i => i.status === 'DONE').length;
    const sprintsDone = e.sprints.filter(s => s.status === 'DONE').length;
    totalSprints += e.sprints.length;
    totalSprintsDone += sprintsDone;
    totalItems += allItems.length;
    totalDone += doneItems;
    console.log(`\n[ÉPICA ${idx+1}] ${e.name}  |  sprints: ${sprintsDone}/${e.sprints.length}  |  items: ${doneItems}/${allItems.length}`);
    e.sprints.forEach(s => {
      const d = s.items.filter(i => i.status === 'DONE').length;
      const icon = s.status === 'DONE' ? '✓' : s.status === 'ACTIVE' ? '▶' : '○';
      console.log(`  ${icon} [${s.status}] ${s.sprintCode} — ${s.name} (${d}/${s.items.length})`);
    });
  });

  console.log(`\n══════════════════════════════`);
  console.log(`TOTAL: ${epics.length} épicas | ${totalSprintsDone}/${totalSprints} sprints DONE | ${totalDone}/${totalItems} items DONE`);
  await p.$disconnect();
}
run();
