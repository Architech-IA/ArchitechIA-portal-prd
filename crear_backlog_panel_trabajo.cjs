// Sprint MASD-0028-0007: panel de trabajo en curso del Motor (22/11/2026). Se corre desde /root/portal-architechia.
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();
const SOLUCION = '558a07a7-cf61-4311-ae9e-40f8500d1968';
const EPICA = 'ea89927a-20c2-4176-ba72-f606959bc113'; // MASD-0028 Sistema multiagente
const AREA = '947ca771-fe9e-4c3f-bfea-2ef2e27986c6';
const SPRINT = {
  code: 'MASD-0028-0007',
  name: 'Panel de trabajo en curso del Motor',
  goal: 'Ver en un solo lugar qué hacen los agentes ahora, qué falló y qué espera a una persona, sin abrir cada sesión. Inspirado en los entornos de desarrollo agéntico (ADE): vista central de agentes en paralelo y comparación de resultados.',
};
const T = (title, description, priority, status, resultado) => ({ title, description, priority, status, resultado });
const TAREAS = [
  T('Las sesiones con error o atascadas salen primero en la portada del Motor',
    'La portada ya listaba sesiones activas. Ahora marca «con error» (la última respuesta terminó en ERROR, con su mensaje) y «atascada» (más de 15 min en GENERANDO), las ordena primero y suma la cifra «sesiones con error». Ruta /api/motor/resumen (central.rs), vista MotorView.',
    'HIGH', 'DONE', 'Desplegado el 22/11/2026.'),
  T('Aprobaciones retenidas de los agentes visibles en «Esperan a una persona»',
    'Las decisiones del gateway en PENDIENTE_APROBACION (GwDecision) aparecen con agente, canal y antigüedad, con enlace a la bandeja de Agentes. Cifra «aprobaciones de agentes».',
    'HIGH', 'DONE', 'Desplegado el 22/11/2026.'),
  T('Propuestas de cambio a la memoria del proyecto visibles en «Esperan a una persona»',
    'ProyectoMemoriaPropuesta en PENDIENTE entra a la lista de pendientes junto a acciones, propuestas de artefactos, archivos y avisos.',
    'MEDIUM', 'DONE', 'Desplegado el 22/11/2026.'),
  T('Registrar el inicio de cada trabajo largo de la IA (no solo el resultado)',
    'Hoy solo se sabe que una respuesta está en curso por el mensaje en GENERANDO. Guardar quién la pidió, el modelo y el tiempo límite para distinguir «lenta» de «colgada» y poder cancelar desde el panel.',
    'MEDIUM', 'BACKLOG', null),
  T('Responder en segundo plano con acuse inmediato (arreglo del «La IA tardó demasiado»)',
    'Los encargos largos (por ejemplo «escribe el briefing completo») chocan con el límite de 60 s de nginx. La sesión acusa recibo al instante, el trabajo corre aparte y el resultado llega como mensaje y notificación. Patrón Talker-Reasoner.',
    'HIGH', 'BACKLOG', null),
  T('Cancelar o reintentar una sesión desde el panel del Motor',
    'Botones en la fila de la sesión con error o atascada: Reintentar (reutiliza la ruta de reintento) y Marcar como fallida si está colgada.',
    'MEDIUM', 'BACKLOG', null),
  T('Aislar credenciales y base de datos en el desarrollo en contenedor, no solo el código',
    'El consenso de los entornos de desarrollo agéntico advierte que aislar el repositorio no basta: puertos, bases de datos y credenciales siguen compartidos. Revisar qué ve hoy el contenedor de las sesiones de desarrollo.',
    'MEDIUM', 'BACKLOG', null),
  T('Comparar resultados del mismo encargo (opcional por encargo, empezar por documentos)',
    'Lanzar el mismo encargo a dos o tres variantes, mostrarlas lado a lado y quedarse con una. Con tope de costo. Empezar por documentos y medir si se elige alguna vez la segunda opción antes de extenderlo al código.',
    'LOW', 'BACKLOG', null),
  T('Sala de proyecto: hilo compartido donde varios agentes ven la misma conversación',
    'Solo responde el agente al que le toca, con regla de turnos y tope de respuestas entre agentes para evitar bucles. Diseño primero; depende de tener varios agentes coordinándose en un mismo proyecto.',
    'LOW', 'BACKLOG', null),
];
(async () => {
  const ya = await prisma.sprint.findFirst({ where: { sprintCode: SPRINT.code } });
  if (ya) throw new Error('Ya existe el sprint ' + SPRINT.code);
  const sp = await prisma.sprint.create({ data: { id: crypto.randomUUID(), sprintCode: SPRINT.code, name: SPRINT.name, goal: SPRINT.goal, status: 'PLANNED', epicId: EPICA, solucionId: SOLUCION, ownerAreaId: AREA } });
  let n = 0;
  for (const t of TAREAS) {
    n++;
    await prisma.backlogItem.create({ data: { id: crypto.randomUUID(), taskCode: `${SPRINT.code}-${String(n).padStart(3, '0')}`, sprintId: sp.id, solucionId: SOLUCION, title: t.title, description: t.description, type: 'DESARROLLO', priority: t.priority, status: t.status, order: n, resultado: t.resultado, points: null } });
  }
  console.log('sprint', SPRINT.code, 'con', n, 'tareas');
  await prisma.$disconnect();
})().catch(async e => { console.error('ERROR', e.message); await prisma.$disconnect(); process.exit(1); });
