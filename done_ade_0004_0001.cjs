const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  {
    taskCode: 'ADE-0004-0001-001',
    fecha: '2026-08-07T09:33:00Z',
    resultado: 'Contrato de tarea definido en harness.py como dataclass Task: id (uuid), type (code_review/memory_write/backlog_update/etc.), agent (slug destino), payload (dict), priority (LOW/MEDIUM/HIGH), status (TaskStatus enum), retries/max_retries, created_at/started_at/completed_at, result y error. Serializable a dict y reconstruible con from_dict().',
  },
  {
    taskCode: 'ADE-0004-0001-002',
    fecha: '2026-08-07T09:36:00Z',
    resultado: 'Ciclo de vida documentado e implementado: PENDING (encolada) → IN_PROGRESS (next_task() la toma + lock adquirido) → DONE (complete()) o FAILED (fail() sin reintentos) o RETRY→PENDING (fail() con reintentos, máx 3). Campo retries cuenta intentos. Cada transición actualiza started_at o completed_at con timestamp UTC.',
  },
  {
    taskCode: 'ADE-0004-0001-003',
    fecha: '2026-08-07T09:38:00Z',
    resultado: 'Dispatcher implementado como clase Harness con backend configurable: RedisBackend (usa LPUSH/RPOP por cola de prioridad + SET NX EX para lock atómico) o JsonBackend (archivos en /root/harness-queue/ + fcntl para atomicidad, fallback cuando Redis no está disponible). Redis no disponible en VPS actual — JsonBackend activo. Harness.dispatch(task) retorna el task_id.',
  },
  {
    taskCode: 'ADE-0004-0001-004',
    fecha: '2026-08-07T09:40:00Z',
    resultado: 'Listener implementado como Harness.next_task(agent): pop de la cola por prioridad (HIGH→MEDIUM→LOW), adquiere lock atómico (acquire_lock), actualiza status a IN_PROGRESS y started_at, retorna la Task. Harness.complete(task, result) y Harness.fail(task, error, retry) actualizan el registro central y liberan el lock. get_task(id) permite consultar el estado desde cualquier punto.',
  },
  {
    taskCode: 'ADE-0004-0001-005',
    fecha: '2026-08-07T09:43:00Z',
    resultado: 'Test de integración exitoso: (1) dispatch de 3 tareas (HIGH code_review, MEDIUM memory_write, LOW backlog_update), (2) Atlas toma HIGH primero → DONE con result {approved: True}, (3) Ares toma MEDIUM → fallo con retry → retries=1 status=PENDING (reencolada), (4) double-lock: misma tarea no puede tomarse dos veces — el lock de archivo previene re-ejecución. Backend: json (Redis no disponible en VPS, swap a RedisBackend cuando esté activo).',
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
  await p.sprint.update({ where: { sprintCode: 'ADE-0004-0001' }, data: { status: 'DONE' } });
  console.log('✓ Sprint ADE-0004-0001 → DONE');
  await p.$disconnect();
}

run();
