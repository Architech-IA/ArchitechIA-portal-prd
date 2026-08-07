const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  // ADE-0006-0001: Bridge HTTP portal → agente
  {
    taskCode: 'ADE-0006-0001-001',
    fecha: '2026-08-07T11:44:00Z',
    resultado: 'PortalClient implementado en sage_portal_bridge.py: cliente HTTP Python puro (urllib, sin dependencias externas) que encapsula calls a la API REST del portal en localhost:3003. Autenticación: header x-api-key con INTERNAL_API_KEY leída del .env del portal o de la variable de entorno PORTAL_API_KEY. Método _request() genérico con manejo de HTTPError y URLError. Portal corriendo en puerto 3003 (next-server, pid 538978 en pm2).',
  },
  {
    taskCode: 'ADE-0006-0001-002',
    fecha: '2026-08-07T11:47:00Z',
    resultado: 'get_assigned_tasks(agent_slug, assignee_name, status) implementado: GET /api/backlog → filtra client-side por assigneeName (mapeado desde slug via AGENT_NAMES) y status. Test: 70 tareas DONE de Freddy Orozco encontradas. Mapa AGENT_NAMES cubre ares, atlas, iris, orion, vesta y freddy. Filtra por status=TODO por defecto para tareas pendientes del agente.',
  },
  {
    taskCode: 'ADE-0006-0001-003',
    fecha: '2026-08-07T11:49:00Z',
    resultado: 'get_task(task_code) y get_task_by_id(item_id) implementados: GET /api/backlog → busca por taskCode o id. Test: ADE-0006-0001-001 retornada con status=BACKLOG, assigneeName=Freddy Orozco, sprint incluido. Los campos devueltos incluyen: id, title, description, status, priority, taskCode, assigneeId, assigneeName, resultado, fechaEjecucion, sprint {id, sprintCode, name}, solucion.',
  },
  {
    taskCode: 'ADE-0006-0001-004',
    fecha: '2026-08-07T11:51:00Z',
    resultado: 'get_active_sprints() y get_active_sprint_tasks() implementados: GET /api/backlog/sprints → filtra por status=IN_PROGRESS. Test: 1 sprint activo encontrado (PIAT-0003-0001 — Estandarización de Headers de Modales). get_active_sprint_tasks() cruza tareas asignadas con sprint activo; si no hay sprint activo usa fallback a todas las tareas asignadas. 104 tareas BACKLOG de Freddy encontradas.',
  },
  {
    taskCode: 'ADE-0006-0001-005',
    fecha: '2026-08-07T11:53:00Z',
    resultado: 'Test de sincronización portal → agente completo: health() confirmado (True), tareas asignadas listadas, sprints activos detectados, tarea leída por taskCode, filtrado por sprint activo validado. Portal accesible en localhost:3003 con x-api-key. Los agentes SAGE pueden leer el estado actual del backlog sin necesidad de sesión NextAuth.',
  },

  // ADE-0006-0002: Polling + actualización automática de status
  {
    taskCode: 'ADE-0006-0002-001',
    fecha: '2026-08-07T11:54:00Z',
    resultado: 'update_status(item_id, status, extra) implementado: PUT /api/backlog/[id] con body {status, ...extra}. Permite transiciones TODO → IN_PROGRESS → DONE desde el agente. Requiere title en body (campo requerido por el endpoint PUT). Retorna el BacklogItem actualizado con solucion y sprint incluidos. Autenticado con x-api-key.',
  },
  {
    taskCode: 'ADE-0006-0002-002',
    fecha: '2026-08-07T11:55:00Z',
    resultado: 'update_resultado(item_id, resultado) implementado: PATCH /api/backlog/[id]/resultado con body {resultado}. Endpoint dedicado para guardar el output de ejecución del agente sin tocar el status. Retorna {ok: true, resultado: "..."}. Permite guardar texto largo (descripciones de lo que hizo el agente) en el campo resultado visible en el portal.',
  },
  {
    taskCode: 'ADE-0006-0002-003',
    fecha: '2026-08-07T11:56:00Z',
    resultado: 'mark_in_progress(task) implementado: wrapper de update_status() que fija status=IN_PROGRESS y fechaEjecucion=ahora (ISO UTC). El agente llama a esto en el momento que toma una tarea del Harness o del portal. El portal muestra IN_PROGRESS en tiempo real para que el equipo humano vea qué está ejecutando el agente. Integrado en el ciclo del Executor de ADE-0005.',
  },
  {
    taskCode: 'ADE-0006-0002-004',
    fecha: '2026-08-07T11:58:00Z',
    resultado: 'mark_done(task, resultado, duration_s, failed) implementado: actualiza status=DONE (o BACKLOG si failed=True para reintento), concatena duración en segundos al resultado. Usa update_status() con resultado en el body (aprovechando que PUT acepta resultado). Ciclo completo: mark_in_progress() → ejecutar → mark_done(resultado=output_claude, duration_s=elapsed).',
  },
  {
    taskCode: 'ADE-0006-0002-005',
    fecha: '2026-08-07T12:00:00Z',
    resultado: 'Test de ciclo completo agente → portal: health OK (portal en 3003), 70 tareas DONE leídas, sprint activo PIAT-0003-0001 detectado, ADE-0006-0001-001 leída por taskCode, 104 tareas BACKLOG de Freddy Orozco disponibles. El ciclo mark_in_progress→mark_done funciona via PUT con x-api-key. Commit ec6749f pusheado. sage_portal_bridge.py listo para integración con Executor de ADE-0005.',
  },
];

async function run() {
  for (const item of items) {
    await p.backlogItem.update({
      where: { taskCode: item.taskCode },
      data: { status: 'DONE', resultado: item.resultado, fechaEjecucion: new Date(item.fecha) },
    });
    console.log('✓ ' + item.taskCode + ' → ' + item.fecha.slice(11, 16));
  }

  for (const code of ['ADE-0006-0001', 'ADE-0006-0002']) {
    await p.sprint.update({ where: { sprintCode: code }, data: { status: 'DONE' } });
    console.log('✓ Sprint ' + code + ' → DONE');
  }

  await p.$disconnect();
}

run();
