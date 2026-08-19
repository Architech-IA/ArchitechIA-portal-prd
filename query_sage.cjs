const { PrismaClient } = require("./node_modules/.prisma/client")
const prisma = new PrismaClient()
async function main() {
  const sol = await prisma.solution.findFirst({
    where: { OR: [{ name: { contains: "SAGE" } }, { code: "SAGE" }] },
    select: { id: true, name: true, code: true }
  })
  console.log("Solution:", JSON.stringify(sol))
  const epics = await prisma.epic.findMany({
    where: { solutionId: sol.id },
    select: { id: true, title: true, epicCode: true },
    orderBy: { createdAt: "asc" }
  })
  console.log("Epics:", JSON.stringify(epics))
  await prisma.$disconnect()
}
main().catch(console.error)
