const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const solucionId = 'cmsgzw57s0000l0r9o6tgta5i'

  const epic = await prisma.epic.create({
    data: {
      name: 'Documentation',
      description: 'Documentación técnica y operacional del Dev Engine: arquitectura, guías de onboarding, runbooks y diagramas.',
      color: '#94a3b8',
      solucionId,
      status: 'ACTIVE',
      priority: 'MEDIUM',
    }
  })
  console.log('Épica creada:', epic.id, epic.name)

  const sprints = [
    { sprintCode: 'ADE-0009-0001', name: 'Arquitectura y diseño del sistema', goal: 'Documentar la arquitectura completa del Dev Engine con diagramas y decisiones técnicas.' },
    { sprintCode: 'ADE-0009-0002', name: 'Guías operacionales y runbooks', goal: 'Crear guías para operar, mantener y escalar el sistema en producción.' },
  ]

  for (const s of sprints) {
    const sprint = await prisma.sprint.create({
      data: {
        name: s.name,
        goal: s.goal,
        sprintCode: s.sprintCode,
        solucionId,
        epicId: epic.id,
        status: 'PLANNED',
      }
    })
    console.log('Sprint creado:', sprint.sprintCode, '-', sprint.name)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
