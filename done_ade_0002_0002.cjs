const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function done(taskCode, resultado) {
  await prisma.backlogItem.update({ where: { taskCode }, data: { status: 'DONE', resultado, fechaEjecucion: new Date() } })
  console.log('DONE:', taskCode)
}

async function main() {
  await done('ADE-0002-0002-001',
    'Contrato definido: API REST en FastAPI (puerto 8765) con 5 endpoints:\n- GET / — health check y repos cargados\n- GET /symbol?name=X&repo=portal&limit=N — busca símbolo y retorna relaciones\n- GET /dependencies?symbol=X&depth=1 — retorna dependientes del símbolo\n- GET /context?task="..." — retorna nodos relevantes para una tarea\n- GET /god-nodes — hubs arquitectónicos\n- GET /reload — recarga grafo desde disco\nRespuestas en JSON con nodos, edges, scores y contexto markdown.')

  await done('ADE-0002-0002-002',
    'Endpoint GET /symbol implementado. Busca por nombre en id y label de nodos. Retorna para cada match: id, label, tipo, archivo, comunidad, edges entrantes y salientes (hasta 10 cada uno), y degree total. Ordenado por degree descendente. Validado con /symbol?name=prisma.')

  await done('ADE-0002-0002-003',
    'Endpoint GET /dependencies implementado con BFS hasta profundidad N. Dado un símbolo, retorna todos los nodos que dependen de él (edges entrantes). Soporta depth=2 para dependencias transitivas. Limita a 50 resultados. Validado con /dependencies?symbol=prisma&depth=1.')

  await done('ADE-0002-0002-004',
    'Endpoint GET /context implementado. Tokeniza la tarea en keywords (>3 chars), puntúa cada nodo del grafo por coincidencias en id+label+file, y ordena por relevancia × degree. Retorna hasta N nodos con su score y genera contexto en markdown listo para inyectar al agente. Validado con "crear agente en el portal".')

  await done('ADE-0002-0002-005',
    'Prueba de integración exitosa: los 3 endpoints principales responden en <200ms con el grafo del portal (1657 nodos). /god-nodes confirma que prisma.ts (94 edges) y logActivity() (60 edges) son los hubs principales. /context para "crear agente en el portal" retorna nodos relevantes de hub/operations y agents. API registrada en pm2 como "graph-api" y persistida.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
