const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function updateDone(taskCode, resultado) {
  await prisma.backlogItem.update({
    where: { taskCode },
    data: { status: 'DONE', resultado, fechaEjecucion: new Date() }
  })
  console.log('DONE:', taskCode)
}

async function main() {
  await updateDone('ADE-0001-0001-004',
    'Seed de los 5 agentes SAGE ejecutado exitosamente:\n- Ares (Sales): agresivo, orientado a conversión\n- Atlas (Operations): analítico, exige datos concretos\n- Iris (Marketing): creativa, orientada a narrativa\n- Orión (Admin): orquestador, sintetiza y coordina\n- Vesta (Finance): rigurosa, evalúa rentabilidad y riesgo\nCada agente tiene: slug único, personalidad, systemPrompt, taskTypes y vaultPath definidos.')

  await updateDone('ADE-0001-0001-005',
    'Endpoint GET /api/agents creado en src/app/api/agents/route.ts. Retorna lista completa de agentes ordenada por nombre. Sin autenticación requerida (endpoint interno). Validado: retorna los 5 agentes SAGE con todos sus campos.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
