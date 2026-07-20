const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.sprint.findMany().then(sprints => {
  return Promise.all(sprints.filter(s => !s.sprintCode).map((s, i) => 
    prisma.sprint.update({ where: { id: s.id }, data: { sprintCode: "SP-" + String(i+1).padStart(3, "0") } })
  ));
}).then(r => { console.log("backfilled", r.length); prisma.$disconnect(); });
