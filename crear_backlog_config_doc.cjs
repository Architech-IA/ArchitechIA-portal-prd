// Agrega al sprint MASD-0024-0018 las tareas de la hoja con marca y la configuración de plantilla por documento (22/11/2026).
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();
const SOLUCION = '558a07a7-cf61-4311-ae9e-40f8500d1968';
const T = (title, description, priority, status, resultado) => ({ title, description, priority, status, resultado });
const TAREAS = [
  T('El editor de documentos se ve con la marca de ArchiTechIA al editar',
    'La hoja del editor lleva curva y logo, Poppins, títulos en mayúsculas azul marino, viñetas y tablas en naranja y durazno y una línea al pie. Archivos en public/marca y estilos en PanelRico.',
    'HIGH', 'DONE', 'Desplegado el 22/11/2026.'),
  T('Botón de configuración del documento con popup: usar plantilla sí/no y tipo (documento, briefing, acta, propuesta)',
    'Botón junto a la versión en DocumentoEditor y popup ConfigPlantilla. Se guarda por documento (migración 028: columnas plantilla y tipoPlantilla en ProyectoDocumento; ruta PUT .../documentos/{fase}/{clave}/config). Sin plantilla, el editor y el Word salen sin curva, logo ni pie.',
    'HIGH', 'DONE', 'Desplegado el 22/11/2026. El tipo se guarda pero aún no cambia el aspecto: la portada de las propuestas está pendiente.'),
  T('Portada para los documentos de tipo propuesta',
    'Usar la portada de la plantilla Word de Ortega (image1) cuando el tipo del documento sea propuesta, en el editor y en el Word.',
    'MEDIUM', 'BACKLOG', null),
  T('Definir plantillas por tipo (briefing, acta, propuesta) con esqueleto de secciones',
    'El tipo elegido en el popup debería cargar el esqueleto de ese tipo al crear o regenerar el documento. Une con la tarea de plantillas por entregable.',
    'HIGH', 'BACKLOG', null),
];
(async () => {
  const sp = await prisma.sprint.findFirst({ where: { sprintCode: 'MASD-0024-0018' } });
  if (!sp) throw new Error('No existe el sprint MASD-0024-0018');
  const max = await prisma.backlogItem.count({ where: { sprintId: sp.id } });
  let n = max;
  for (const t of TAREAS) {
    n++;
    await prisma.backlogItem.create({ data: { id: crypto.randomUUID(), taskCode: `MASD-0024-0018-${String(n).padStart(3, '0')}`, sprintId: sp.id, solucionId: SOLUCION, title: t.title, description: t.description, type: 'DESARROLLO', priority: t.priority, status: t.status, order: n, resultado: t.resultado, points: null } });
  }
  console.log('agregadas', TAREAS.length, 'tareas; total', n);
  await prisma.$disconnect();
})().catch(async e => { console.error('ERROR', e.message); await prisma.$disconnect(); process.exit(1); });
