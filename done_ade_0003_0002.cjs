const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  {
    taskCode: 'ADE-0003-0002-001',
    fecha: '2026-08-07T09:18:00Z',
    resultado: 'Creado /root/sage_memory.py — clase VaultClient que encapsula todos los calls HTTP a la Vault API (puerto 8766). Constructor recibe agent_id y base_url. Métodos organizados en 4 grupos: lectura (read_note, read_note_parsed, read_shared), escritura (write_note, append_note, write_shared, log), búsqueda (list_notes, search_notes, search_shared) y helpers (note_exists, delete_note, make_note). _agent_path() construye automáticamente la ruta agents/<agent_id>/<note_path>.',
  },
  {
    taskCode: 'ADE-0003-0002-002',
    fecha: '2026-08-07T09:23:00Z',
    resultado: 'Implementados read_note(note_path) → retorna contenido Markdown o None si no existe, read_note_parsed(note_path) → retorna {frontmatter, body, path, modified}, read_shared(note_path) → lee desde shared/. Todos resuelven la ruta relativa al agente automáticamente. Probado: VaultClient("ares").read_note("clientes/acme_corp") retorna el markdown completo de agents/ares/clientes/acme_corp.md.',
  },
  {
    taskCode: 'ADE-0003-0002-003',
    fecha: '2026-08-07T09:28:00Z',
    resultado: 'Implementados write_note(note_path, content) → PUT (crea/reemplaza), append_note(note_path, content) → PATCH (agrega al final), write_shared(note_path, content) → escribe en shared/, make_note(title, note_path, body, tags) → crea nota con frontmatter estándar (agent, date, tags), log(message, category) → agrega entrada timestamped al log diario del agente en agents/<id>/logs/YYYY-MM-DD.md.',
  },
  {
    taskCode: 'ADE-0003-0002-004',
    fecha: '2026-08-07T09:33:00Z',
    resultado: 'Implementados search_notes(query, tag): busca texto en todo el vault y filtra por carpeta del agente. Si se pasa tag sin query, hace una segunda pasada leyendo el frontmatter de cada resultado para filtrar por tag exacto. search_shared(query) busca solo en shared/. list_notes() lista todas las notas del agente via GET /vault/?path=agents/<id>. Probado: ares.search_notes(query="ACME") retorna [acme_corp.md, logs/2026-08-07.md].',
  },
  {
    taskCode: 'ADE-0003-0002-005',
    fecha: '2026-08-07T09:38:00Z',
    resultado: 'Test end-to-end exitoso: (1) Ares escribe nota clientes/acme_corp con make_note (tags: cliente, prospecto, manufactura), (2) Ares escribe log de actividad via log(), (3) Ares publica briefing en shared/context/acme_briefing, (4) Atlas lee el shared context con read_shared() y obtiene el contenido correctamente, (5) Búsqueda ACME retorna 2 resultados del vault de Ares. Flujo completo de memoria cross-agent validado.',
  },
];

async function run() {
  for (const item of items) {
    await p.backlogItem.update({
      where: { taskCode: item.taskCode },
      data: {
        status: 'DONE',
        resultado: item.resultado,
        fechaEjecucion: new Date(item.fecha),
      },
    });
    console.log(`✓ ${item.taskCode} → ${item.fecha.slice(11,16)}`);
  }
  await p.sprint.update({
    where: { sprintCode: 'ADE-0003-0002' },
    data: { status: 'DONE' },
  });
  console.log('✓ Sprint ADE-0003-0002 → DONE');
  await p.$disconnect();
}

run();
