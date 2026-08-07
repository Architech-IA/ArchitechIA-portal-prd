const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  {
    taskCode: 'ADE-0003-0003-001',
    fecha: '2026-08-07T09:27:00Z',
    resultado: 'Documento de convención publicado en shared/resources/vault_convention.md. Define: estructura de carpetas por agente (memoria/, tareas/, sesiones/, clientes/, proyectos/, logs/), reglas de nomenclatura (snake_case, fechas YYYY-MM-DD, una entidad por nota, frontmatter obligatorio: agent/date/tags), tabla de rutas estándar por tipo de nota, y política de acceso: cada agente escribe solo en agents/<su_id>/, comunicación cross-agent vía shared/.',
  },
  {
    taskCode: 'ADE-0003-0003-002',
    fecha: '2026-08-07T09:27:00Z',
    resultado: 'Plantilla templates/sesion.md creada con frontmatter (agent, date, type: sesion, tags) y secciones: Contexto activo, Objetivos de la sesión, Acciones tomadas, Decisiones, Pendientes para próxima sesión. Diseñada para que cada agente la use al iniciar cada bloque de trabajo.',
  },
  {
    taskCode: 'ADE-0003-0003-003',
    fecha: '2026-08-07T09:28:00Z',
    resultado: 'Dos plantillas de entidad creadas: templates/cliente.md (campos: datos de contacto, empresa, historial de interacciones, necesidades, próximos pasos; estado: prospecto/activo/inactivo) y templates/proyecto.md (campos: descripción, cliente/stakeholder, objetivo, hitos, estado actual, blockers). Frontmatter incluye type y estado para facilitar filtrado por tag.',
  },
  {
    taskCode: 'ADE-0003-0003-004',
    fecha: '2026-08-07T09:28:00Z',
    resultado: 'Función init_agent_vault(agent_id) implementada en sage_memory.py como función independiente. Crea subcarpetas base (memoria/, tareas/, sesiones/, logs/) con .gitkeep y nota perfil.md con frontmatter estándar. Ejecutada para los 5 agentes SAGE (ares, atlas, iris, orion, vesta). Vault queda con 38 notas: 5 perfiles + carpetas estructuradas + templates + shared context.',
  },
  {
    taskCode: 'ADE-0003-0003-005',
    fecha: '2026-08-07T09:29:00Z',
    resultado: 'Aislamiento validado: (1) VaultClient.read_note() siempre resuelve rutas bajo agents/<agent_id>/ — Ares no puede leer perfil de Atlas, (2) path traversal (/../) retorna 404 — bloqueado por Vault API, (3) list_notes() solo retorna notas de la carpeta del agente (assert pasado para Ares y Atlas), (4) shared/ es el único canal de comunicación cross-agent autorizado.',
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
  await p.sprint.update({ where: { sprintCode: 'ADE-0003-0003' }, data: { status: 'DONE' } });
  console.log('✓ Sprint ADE-0003-0003 → DONE');
  await p.$disconnect();
}

run();
