const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  const sols = await p.solucion.findMany({ select: { id: true, nombre: true, tipo: true } })
  console.log('Soluciones:', JSON.stringify(sols, null, 2))
  const sprints = await p.sprint.findMany({ select: { id: true, sprintCode: true, name: true } })
  console.log('Sprints:', JSON.stringify(sprints, null, 2))
}
main().catch(console.error).finally(() => p.$disconnect())
