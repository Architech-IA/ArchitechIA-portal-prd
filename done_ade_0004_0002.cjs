const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  {
    taskCode: 'ADE-0004-0002-001',
    fecha: '2026-08-07T10:06:00Z',
    resultado: 'Redis identificado en Docker: contenedor "scheduling-redis" (redis:7-alpine) lleva 3 semanas activo, IP 172.18.0.2:6379. El servicio systemd redis-server fallaba porque el puerto ya estaba ocupado por docker-proxy. Fix: harness.py actualizado para conectar a 172.18.0.2 en lugar de localhost. Paquete Python redis instalado (pip3 install redis). Persistencia RDB nativa de Redis 7 activa.',
  },
  {
    taskCode: 'ADE-0004-0002-002',
    fecha: '2026-08-07T10:08:00Z',
    resultado: 'Encolado implementado sobre Redis nativo (sin BullMQ, ya que el stack es Python): RedisBackend en harness.py usa LPUSH/RPOP por colas de prioridad (harness:queue:HIGH/MEDIUM/LOW) y SET NX EX para locks atómicos. Backend auto-detectado: si Redis responde → RedisBackend, si no → JsonBackend (fallback). Con redis instalado, h.backend_type = "redis" confirmado.',
  },
  {
    taskCode: 'ADE-0004-0002-003',
    fecha: '2026-08-07T10:10:00Z',
    resultado: 'Worker por agente implementado como Harness.next_task(agent): pop de colas por prioridad HIGH→MEDIUM→LOW, lock atómico SET NX EX 300s, transición a IN_PROGRESS con started_at. Harness.complete() y Harness.fail() cierran el ciclo actualizando resultado/error y liberando el lock. Test: Atlas toma HIGH (code_review) → DONE con result {approved: True, score: 98}.',
  },
  {
    taskCode: 'ADE-0004-0002-004',
    fecha: '2026-08-07T10:12:00Z',
    resultado: 'Dead-letter queue implementada: Harness.fail() reencola con retries++ si retries < max_retries (default 3), cuando se agota env ía a DLQ. En Redis: LPUSH harness:dlq con el task_id. En JSON: archivo en /root/harness-queue/dlq/. harness_api.py expone GET /dlq para inspección. Test: Vesta falla 4 veces → retries=3 status=FAILED → DLQ.',
  },
  {
    taskCode: 'ADE-0004-0002-005',
    fecha: '2026-08-07T10:14:00Z',
    resultado: 'harness_api.py desplegado en pm2 (harness-api, id:5, puerto 8767). Endpoints: GET / (health + backend), GET /queues (conteo por prioridad HIGH/MEDIUM/LOW/DLQ), GET /tasks (lista con filtro por status), GET /tasks/{id} (detalle), GET /dlq (dead-letter), POST /dispatch (encolar tarea). Probado: backend=redis, MEDIUM=3 tareas en cola. pm2 total: 5 procesos activos.',
  },
];

async function run() {
  for (const item of items) {
    await p.backlogItem.update({
      where: { taskCode: item.taskCode },
      data: { status: 'DONE', resultado: item.resultado, fechaEjecucion: new Date(item.fecha) },
    });
    console.log(`✓ ${item.taskCode} → ${item.fecha.slice(11,16)}`);
  }
  await p.sprint.update({ where: { sprintCode: 'ADE-0004-0002' }, data: { status: 'DONE' } });
  console.log('✓ Sprint ADE-0004-0002 → DONE');
  await p.$disconnect();
}

run();
