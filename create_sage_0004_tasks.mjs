import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const SAGE_ID   = 'c73ba191-be03-4c14-9037-c019854a91ad'
const SPRINT_ID = 'cmspmbitc0003l0mjtazptq0i'
const TODAY     = new Date('2026-08-11')

const tasks = [
  {
    taskCode: 'SAGE-0004-0001-001',
    title: 'Endpoint unificado /api/orion/chat + tabla AgentConversation',
    description: 'Crear endpoint POST /api/orion/chat que lee systemPrompt y llmModel desde DB (tabla Agent, slug orion), carga y guarda historial persistente en nueva tabla AgentConversation indexada por (agentSlug, channelType, channelId). Soporta stream=true (SSE) y stream=false (JSON). Migrar WhatsApp, Hub/Agents y Oficina Virtual a este endpoint.',
    resultado: 'Endpoint desplegado en producción. Los tres canales usan el mismo backend. Persistencia confirmada: el historial de conversación sobrevive reinicios del servidor.',
    fechaEjecucion: TODAY,
    status: 'DONE',
    priority: 'HIGH',
    points: 5,
    order: 1,
  },
  {
    taskCode: 'SAGE-0004-0001-002',
    title: 'Soporte de audio vía Whisper en WhatsApp',
    description: 'Detectar mensajes de tipo audioMessage en el webhook de Evolution API. Obtener el audio en base64 via getBase64FromMediaMessage, enviarlo al servidor faster-whisper-server (Docker puerto 9200) para transcripción, y pasar el texto resultante al endpoint unificado de Orión.',
    resultado: 'Pipeline de audio funcional: voz en WhatsApp → Whisper → texto → Orión → respuesta. Servidor Whisper (Systran/faster-whisper-small) ya existía en Docker puerto 9200.',
    fechaEjecucion: TODAY,
    status: 'DONE',
    priority: 'MEDIUM',
    points: 3,
    order: 2,
  },
  {
    taskCode: 'SAGE-0004-0001-003',
    title: 'Renombrado UI: Sage → Orión (CEO), Nexus → Gerente de Operaciones',
    description: 'Actualizar hub/agents/page.tsx: cambiar nombre visible de Sage a Orión con subtítulo CEO, y subtítulo de Nexus a Gerente de Operaciones. El id interno sigue siendo sage para no romper rutas existentes.',
    resultado: 'Hub/Agents muestra Orión (CEO) y Nexus (Gerente de Operaciones). Desplegado en producción.',
    fechaEjecucion: TODAY,
    status: 'DONE',
    priority: 'LOW',
    points: 1,
    order: 3,
  },
  {
    taskCode: 'SAGE-0004-0001-004',
    title: 'Selector de modelo en admin aplica a todos los canales',
    description: 'Actualizar /api/orion/chat para detectar el backend correcto según llmModel en DB: opencode-go/* usa OpenCode GO API, claude-* usa Claude CLI headless. Agregar /api/orion/chat a PUBLIC_PATHS del middleware para webhooks sin auth.',
    resultado: 'Orión corre con claude-sonnet-5 en los tres canales. Cambiar el modelo desde el admin de Oficina Virtual aplica globalmente sin redespliegue.',
    fechaEjecucion: TODAY,
    status: 'DONE',
    priority: 'HIGH',
    points: 3,
    order: 4,
  },
]

for (const t of tasks) {
  const item = await prisma.backlogItem.create({
    data: {
      ...t,
      type: 'TASK',
      sprint: { connect: { id: SPRINT_ID } },
      solucion: { connect: { id: SAGE_ID } },
      createdByAgentName: 'Orión',
    }
  })
  console.log('Task creada:', item.taskCode)
}

await prisma.$disconnect()
console.log('Listo — SAGE-0004-0001 con 4 tasks DONE.')
