const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  // ADE-0009-0001: Documentación de arquitectura y contratos
  {
    taskCode: 'ADE-0009-0001-001',
    fecha: '2026-08-07T12:10:00Z',
    resultado: 'README.md del Dev Engine redactado y publicado en docs/dev-engine/. Incluye: descripción del sistema multi-agente, diagrama ASCII de componentes (Portal↔Bridge→Harness→Executor→Claude Code→Vault/Graphify/Locks→Discord/Approval/Reporter), tabla de servicios con puertos y pm2 IDs, script de arranque rápido, variables de entorno requeridas (ANTHROPIC_API_KEY, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_APPROVAL_CHANNEL_ID, PORTAL_API_KEY), tabla de los 11 módulos Python con descripción.',
  },
  {
    taskCode: 'ADE-0009-0001-002',
    fecha: '2026-08-07T12:13:00Z',
    resultado: 'ARCHITECTURE.md redactado. Contiene: diagrama end-to-end de 3 capas (Interfaz Humana, Orquestación, Ejecución) con flujo de datos entre Portal, Discord, PortalBridge, SageRouter, ApprovalManager, Harness, Executor, ContextBuilder, Vault y Graphify. Flujo de tarea típica en 8 pasos. Tabla de decisiones de diseño con tecnología elegida vs alternativa descartada para 6 decisiones clave.',
  },
  {
    taskCode: 'ADE-0009-0001-003',
    fecha: '2026-08-07T12:17:00Z',
    resultado: 'DECISIONS.md con 8 decisiones técnicas documentadas: DEC-001 Redis+JSON para cola, DEC-002 Vault Markdown, DEC-003 Claude Code CLI headless, DEC-004 Graphify multi-repo, DEC-005 Discord como interfaz, DEC-006 Redis SETNX para locks, DEC-007 Puerto 3003 vs 3000, DEC-008 timestamps UTC-5 sin conversión. Cada decisión incluye fecha, estado, contexto, razones y alternativas descartadas.',
  },
  {
    taskCode: 'ADE-0009-0001-004',
    fecha: '2026-08-07T12:20:00Z',
    resultado: 'TASK_CONTRACT.md redactado. Define el esquema JSON completo de Task: campos obligatorios (id, type, agent, payload), opcionales (priority, max_retries, source, portal_item_id, portal_task_code, requires_approval), tabla de 14 tipos de tarea con política de aprobación, diagrama de estados del ciclo de vida (PENDING→IN_PROGRESS→DONE/FAILED→DLQ, AWAITING_APPROVAL→APPROVED/REJECTED), payloads de ejemplo por tipo, código de creación via Harness SDK, endpoints de monitoreo.',
  },
  {
    taskCode: 'ADE-0009-0001-005',
    fecha: '2026-08-07T12:22:00Z',
    resultado: 'ONBOARDING_AGENT.md redactado. Guía de 7 pasos para incorporar nuevo agente SAGE: (1) crear vault en sage-vault/agents/<slug>/, (2) crear usuario en portal con rol AGENT via Prisma, (3) registrar en AGENT_NAMES de sage_portal_bridge.py, (4) agregar CHANNEL_ROUTING y AGENT_IDENTITIES en sage_discord.py, (5) notas de contexto en vault, (6) reglas de aprobación si aplica, (7) verificación de integración. Incluye checklist y convenciones de nombres.',
  },

  // ADE-0009-0002: Runbooks y guías operativas
  {
    taskCode: 'ADE-0009-0002-001',
    fecha: '2026-08-07T12:23:00Z',
    resultado: 'RUNBOOK.md redactado. Cubre: arranque completo en orden correcto (Redis → vault-api → graph-api → harness-api → portal → bot Discord), reinicio de servicios pm2, apagado ordenado via /api/shutdown, diagnóstico de 5 fallos comunes (portal no responde, Redis no responde, tareas en DLQ, locks huérfanos, Graphify desactualizado), procedimiento de actualización de código con restricciones de schema Prisma, comandos de backup del vault y harness-queue.',
  },
  {
    taskCode: 'ADE-0009-0002-002',
    fecha: '2026-08-07T12:24:00Z',
    resultado: 'MONITORING.md redactado. Incluye: script de panel de estado rápido, monitoreo pm2 (list, monit, logs), tabla de 4 endpoints de salud con respuesta esperada, script de health check completo, monitoreo del Harness (colas por agente, DLQ, stats), monitoreo de Redis (keys, tamaño de colas, locks activos, info de memoria), monitoreo del portal (conteo de items, sprints activos), tabla de alertas manuales con umbrales y acciones, rutas de logs del sistema.',
  },
  {
    taskCode: 'ADE-0009-0002-003',
    fecha: '2026-08-07T12:25:00Z',
    resultado: 'GRAPHIFY_GUIDE.md redactado. Explica: estructura de archivos (repos_registry.json, graphify-out/graph.json), procedimiento para agregar repos, indexación individual y masiva, consultas al grafo (buscar símbolo, ver dependencias, nodos dios, listar repos), uso desde el ContextBuilder del Executor, cuándo reindexar, cron recomendado (3am diario), solución de problemas (graph.json no encontrado, reinstalación, graph_api no responde).',
  },
  {
    taskCode: 'ADE-0009-0002-004',
    fecha: '2026-08-07T12:26:00Z',
    resultado: 'GLOSSARY.md redactado con 30 términos: AgentChannel, ApprovalManager, ApprovalStore, Asignee, BacklogItem, Claude Code headless, ContextBuilder, DLQ, Épica, Executor, fechaEjecucion, Graphify, Harness, INTERNAL_API_KEY, invoke_claude(), Lock/ResourceLock, Obsidian, PortalClient, pm2, pub/sub, resultado, SAGE (5 agentes), SageRouter, SprintReporter, Task, taskCode, Vault, VaultClient. Tabla de puertos y tabla de convenciones de código.',
  },
  {
    taskCode: 'ADE-0009-0002-005',
    fecha: '2026-08-07T12:28:00Z',
    resultado: 'Todos los documentos de ADE-0009 completados, subidos al VPS en /root/portal-architechia/docs/dev-engine/ y commiteados (c9c6287). 9 archivos: README.md, ARCHITECTURE.md, DECISIONS.md, TASK_CONTRACT.md, ONBOARDING_AGENT.md, RUNBOOK.md, MONITORING.md, GRAPHIFY_GUIDE.md, GLOSSARY.md. Total 1374 líneas de documentación. Push exitoso a main.',
  },
];

async function run() {
  // Marcar sprints IN_PROGRESS primero
  for (const code of ['ADE-0009-0001', 'ADE-0009-0002']) {
    await p.sprint.update({ where: { sprintCode: code }, data: { status: 'IN_PROGRESS' } });
    console.log('▶ Sprint ' + code + ' → IN_PROGRESS');
  }
  // Marcar items DONE
  for (const item of items) {
    await p.backlogItem.update({
      where: { taskCode: item.taskCode },
      data: { status: 'DONE', resultado: item.resultado, fechaEjecucion: new Date(item.fecha) },
    });
    console.log('✓ ' + item.taskCode + ' → ' + item.fecha.slice(11, 16));
  }
  // Marcar sprints DONE
  for (const code of ['ADE-0009-0001', 'ADE-0009-0002']) {
    await p.sprint.update({ where: { sprintCode: code }, data: { status: 'DONE' } });
    console.log('✓ Sprint ' + code + ' → DONE');
  }
  await p.$disconnect();
}

run();
