const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  {
    taskCode: 'ADE-0003-0001-001',
    resultado: 'Obsidian headless en VPS no es viable (es una app Electron con GUI). Implementación equivalente: vault como directorio de Markdown en /root/sage-vault/ + Vault API (vault_api.py, FastAPI, puerto 8766) que expone la misma interfaz que obsidian-local-rest-api. El vault es 100% compatible con Obsidian desktop si se monta como vault local desde cualquier cliente. pm2 registra el proceso como "vault-api" (id: 4).',
  },
  {
    taskCode: 'ADE-0003-0001-002',
    resultado: 'Estructura base creada en /root/sage-vault/: agents/{ares,atlas,iris,orion,vesta}/ (notas privadas por agente), shared/{context,decisions,resources}/ (contexto compartido), logs/ (actividad diaria), templates/ (plantillas). Plantillas creadas: agent_note.md (con frontmatter agent/date/type/tags) y decision.md. Nota inicial: shared/context/portal_overview.md con visión general del portal y repos indexados.',
  },
  {
    taskCode: 'ADE-0003-0001-003',
    resultado: 'vault_api.py desplegado en puerto 8766 vía pm2 (vault-api, id:4). Endpoints implementados: GET / (health), GET /vault/ (listar notas con filtro por path), GET /vault/{filename} (leer nota + frontmatter parseado), PUT /vault/{filename} (crear/reemplazar), PATCH /vault/{filename} (append), DELETE /vault/{filename}, GET /search/ (búsqueda full-text). Interfaz compatible con obsidian-local-rest-api. Documentación en /docs (Swagger).',
  },
  {
    taskCode: 'ADE-0003-0001-004',
    resultado: 'Test manual via curl exitoso: (1) PUT agents/ares/test_memoria — nota creada con frontmatter {agent: ares, date: 2026-08-07, type: test}, (2) GET agents/ares/test_memoria — content + frontmatter parseado retornados correctamente, (3) PATCH — append de sección "Update" verificado, (4) GET /search/?query=SAGE — 2 resultados con snippet de contexto, (5) GET /vault/?path=agents/ares — lista con metadata (path, size, modified).',
  },
  {
    taskCode: 'ADE-0003-0001-005',
    resultado: 'Documentación de todos los endpoints publicada en /root/sage-vault/shared/resources/vault_api_docs.md (1857 bytes). Incluye: descripción de cada endpoint con parámetros y formato de respuesta, estructura de directorios del vault, ejemplos de uso desde un agente via curl. Disponible también en http://localhost:8766/docs (Swagger UI auto-generada por FastAPI).',
  },
];

async function run() {
  for (const item of items) {
    await p.backlogItem.update({
      where: { taskCode: item.taskCode },
      data: {
        status: 'DONE',
        resultado: item.resultado,
        fechaEjecucion: new Date('2026-08-07T14:00:00Z'),
      },
    });
    console.log(`✓ ${item.taskCode} → DONE`);
  }
  await p.sprint.update({
    where: { sprintCode: 'ADE-0003-0001' },
    data: { status: 'DONE' },
  });
  console.log('✓ Sprint ADE-0003-0001 → DONE');
  await p.$disconnect();
}

run();
