const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const soluciones = await p.solucion.findMany({
    include: {
      epics: {
        include: {
          sprints: {
            include: { items: true },
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const out = [];
  for (const sol of soluciones) {
    const allItems = sol.epics.flatMap(e => e.sprints.flatMap(s => s.items));
    out.push({
      solucion: sol.nombre,
      epics: sol.epics.map(e => ({
        epic: e.name,
        sprints: e.sprints.map(s => ({
          sprint: s.name,
          sprintCode: s.sprintCode,
          status: s.status,
          items: s.items.map(i => ({
            code: i.taskCode,
            title: i.title,
            status: i.status,
            type: i.type,
          }))
        }))
      }))
    });
  }

  console.log(JSON.stringify(out, null, 2));
  await p.$disconnect();
}
run();
