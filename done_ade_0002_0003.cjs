const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const items = [
  {
    taskCode: 'ADE-0002-0003-001',
    resultado: 'Creado /root/graphify-repos/repos_registry.json con estructura JSON que registra cada repo indexado: slug, name, path, graphPath, branch, language, status (active/indexing/error), lastIndexed, lastIndexedFiles, indexCommand. El registry persiste entre reinicios de graph_api y se actualiza automáticamente ante cada webhook de re-indexación.',
  },
  {
    taskCode: 'ADE-0002-0003-002',
    resultado: 'Indexado AI-Scheduling-Assistant con Graphify: 292 nodos, 569 edges, 27 comunidades. Grafo en /root/AI-Scheduling-Assistant/graphify-out/graph.json. Registrado en repos_registry.json como slug "scheduling". graph_api.py actualizado a v2.0 con soporte multi-repo: carga cualquier repo desde el registry, sin conflicto entre grafos (cada uno se mantiene separado en memoria por slug).',
  },
  {
    taskCode: 'ADE-0002-0003-003',
    resultado: 'Implementado endpoint POST /webhook/reindex en graph_api.py. Recibe payload {repo, ref, changed_files, secret}, actualiza status a "indexing" en el registry, dispara re-indexación en background (BackgroundTasks de FastAPI). También disponible POST /reindex/{repo} para re-indexación manual. Probado con curl: curl -X POST /webhook/reindex -d {"repo":"scheduling","ref":"refs/heads/main","changed_files":["app/agent/agent.py"]} → responde inmediatamente con ok:true y ejecuta el reindex en background.',
  },
  {
    taskCode: 'ADE-0002-0003-004',
    resultado: 'Implementada lógica de actualización incremental en _do_reindex(): registra qué archivos dispararon el trigger (changed_files) en el campo lastIndexedFiles del registry, ejecuta el re-index completo con graphify (no soporta incremental nativo a nivel AST), invalida el caché en memoria (GRAPHS.pop(repo)) para que la próxima consulta cargue el grafo actualizado desde disco. El registro de archivos permite trazar qué commits provocaron cada re-indexación.',
  },
  {
    taskCode: 'ADE-0002-0003-005',
    resultado: 'Pruebas de consistencia multi-repo ejecutadas: (1) GET /god-nodes?repo=portal → top node: prisma.ts (94 edges), (2) GET /god-nodes?repo=scheduling → top node: api.py (75 edges). Nodos de repos distintos no se mezclan — cada grafo vive en su propia entrada del dict GRAPHS keyed por slug. GET /repos lista ambos repos con su estado. Consultas paralelas a ambos repos retornan contexto correcto sin contaminación cruzada.',
  },
];

async function run() {
  for (const item of items) {
    await p.backlogItem.update({
      where: { taskCode: item.taskCode },
      data: {
        status: 'DONE',
        resultado: item.resultado,
        fechaEjecucion: new Date('2026-08-07T05:30:00Z'),
      },
    });
    console.log(`✓ ${item.taskCode} → DONE`);
  }
  await p.sprint.update({
    where: { sprintCode: 'ADE-0002-0003' },
    data: { status: 'DONE' },
  });
  console.log('✓ Sprint ADE-0002-0003 → DONE');
  await p.$disconnect();
}

run();
