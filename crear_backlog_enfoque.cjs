// Agrega al sprint MASD-0024-0018 el modo pantalla completa, el arreglo del botón de agente por sección y la idea de subir a Drive (23/11/2026).
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();
const SOLUCION = '558a07a7-cf61-4311-ae9e-40f8500d1968';
const T = (title, description, priority, status, resultado) => ({ title, description, priority, status, resultado });
const TAREAS = [
  T('Modo pantalla completa del portal (oculta barra lateral y barra superior)',
    'Botón junto a las notificaciones en TopBar. Oculta la barra lateral y la superior; un icono flotante abajo a la izquierda y la tecla Esc lo desactivan. Estado en PortalLayoutClient (se mantiene al navegar, se reinicia al recargar).',
    'MEDIUM', 'DONE', 'Desplegado el 23/11/2026.'),
  T('Arreglo: el botón de agente por sección no respondía al clic en la hoja con marca',
    'El bloque del texto pasó a position:relative con la hoja de marca y quedó encima de los botones. Se les subió la capa (z-10) en PanelRico.',
    'HIGH', 'DONE', 'Desplegado el 22/11/2026.'),
  T('Subir la versión final de un documento a Google Drive',
    'Botón «Guardar en Drive» para documentos aprobados o enviados. Cuenta de servicio con una carpeta compartida (Clientes / Cliente / Proyecto / Fase), Word y/o PDF, nueva versión del mismo archivo en vez de duplicar y enlace guardado en el historial del documento. Requiere el cliente OAuth de Google (el mismo pendiente del conector de Gmail) y definir la carpeta raíz.',
    'MEDIUM', 'BACKLOG', null),
];
(async () => {
  const sp = await prisma.sprint.findFirst({ where: { sprintCode: 'MASD-0024-0018' } });
  if (!sp) throw new Error('No existe el sprint MASD-0024-0018');
  let n = await prisma.backlogItem.count({ where: { sprintId: sp.id } });
  for (const t of TAREAS) {
    n++;
    await prisma.backlogItem.create({ data: { id: crypto.randomUUID(), taskCode: `MASD-0024-0018-${String(n).padStart(3, '0')}`, sprintId: sp.id, solucionId: SOLUCION, title: t.title, description: t.description, type: 'DESARROLLO', priority: t.priority, status: t.status, order: n, resultado: t.resultado, points: null } });
  }
  console.log('agregadas', TAREAS.length, 'tareas; total', n);
  await prisma.$disconnect();
})().catch(async e => { console.error('ERROR', e.message); await prisma.$disconnect(); process.exit(1); });
