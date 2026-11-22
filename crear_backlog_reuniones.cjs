// Backlog del trabajo del 21-22/11/2026: reuniones del proyecto, tablas del editor, notas de fase y Word con marca.
// Se ejecuta desde /root/portal-architechia con: node crear_backlog_reuniones.cjs
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();
const SOLUCION = '558a07a7-cf61-4311-ae9e-40f8500d1968';
const AREA = '947ca771-fe9e-4c3f-bfea-2ef2e27986c6';
const EPICA_MOTOR = 'b4b993a6-3ffc-4713-ab49-053105c742ee';
const T = (title, description, priority = 'MEDIUM', status = 'DONE', type = 'DESARROLLO', resultado = null) => ({ title, description, priority, status, type, resultado });

const SPRINT = {
  code: 'MASD-0024-0018', name: 'Reuniones del proyecto, tablas del editor, notas de fase y Word con marca',
  goal: 'Asociar reuniones a cada proyecto y asignarlas desde las actividades, editar tablas en los documentos, recuperar las notas de la fase mientras se migran a documentos y exportar a Word con la marca de ArchiTechIA.',
  tasks: [
    T('Reuniones ↔ proyecto: tabla ReunionSolucion, API y sección «Reuniones del proyecto»',
      'Migración 027, rutas GET/POST/DELETE /api/proyectos/{id}/reuniones con sugerencias por nombre, asistentes y dominio del cliente; sección en el panel Fuentes con «Traer notas», «Asociar» y quitar.', 'HIGH', 'DONE', 'DESARROLLO', 'Desplegado el 21/11/2026. Commit en portalhub hecho; el push depende de credenciales de GitHub en el VPS.'),
    T('Tablas en el editor de documentos: insertar, filas, columnas, eliminar y Tab',
      'Menú de tablas en EditorRico con portal al body (el menú quedaba recortado y desplazado por un ancestro con transform).', 'MEDIUM', 'DONE', 'DESARROLLO', 'Desplegado el 21/11/2026.'),
    T('Ventana «Asignar o crear reunión» en las actividades de reunión, con filtro por cliente',
      'Asigna una existente (también pasada) o crea una nueva; registra la interacción del lead y completa la actividad. Portal al body, desplegable oscuro, hover y lista sin etiquetas.', 'HIGH', 'DONE', 'DESARROLLO', 'Desplegado el 21/11/2026 (commits 97d7f72 y 933ceab en el portal).'),
    T('Recuperar «Historial de esta fase» y «Notas de la fase» en la pantalla de fase',
      'El rediseño del 14/11 (commit 6228c01) quitó ambas secciones y las notas quedaron sin pantalla. Se muestran debajo de «Dónde está lo de esta fase» mientras dure la migración.', 'HIGH', 'DONE', 'DESARROLLO', 'Desplegado el 22/11/2026.'),
    T('Exportar a Word con la marca ArchiTechIA (curva y logo, Poppins, naranja y marino, tablas durazno, pie con página)',
      'Basado en la plantilla Word de Ortega: colores E84B1A / 1B2845 / FDEFE8, encabezado con curva y logo, pie con número de página. Activos en assets/marca de portalhub.', 'HIGH', 'DONE', 'DESARROLLO', 'Desplegado el 22/11/2026; falta revisión visual del Word por el usuario.'),
    T('Marca en PDF y portada opcional para propuestas',
      'El PDF usa fuentes básicas del formato y hay que reescribir esa parte para Poppins y el encabezado. La portada (image1 del Word original) iría solo en propuestas.', 'MEDIUM', 'BACKLOG', 'DESARROLLO'),
    T('Plantillas de documento por tipo de entregable (esqueleto fijo, marcadores y «Aplicar plantilla»)',
      'Hoy el agente escribe «desde cero» guiado solo por la ayuda del entregable. Plantilla editable junto a las plantillas de fases, usada al generar, con botones de aplicar y restablecer (queda versión anterior). Empezar por el briefing del primer contacto.', 'HIGH', 'BACKLOG', 'DESARROLLO'),
    T('Migrar las notas de fase a documentos (actas, briefings, entregables) y eliminarlas',
      '15 notas en 6 proyectos (las más largas: Ortega Diagnóstico y La Promotora). Clasificar con IA como propuestas aprobables, cambiar la opción «Redactar nota» y el entregable nota_lead, respaldo JSON en /root/respaldos, sección en solo lectura y borrado final.', 'HIGH', 'BACKLOG', 'DESARROLLO'),
    T('Que el ajuste de un documento con un motivo proponga una actualización de la memoria del proyecto',
      'Hoy la memoria solo se alimenta al cerrar una sesión de IA (procesar_cierre); las propuestas sobre artefactos no pasan por ahí. Generar una propuesta de memoria al aceptar un cambio con motivo, con la aprobación existente.', 'MEDIUM', 'BACKLOG', 'DESARROLLO'),
    T('Reuniones: selector de fase en Fuentes, selector de solución en Calendar y contexto del asistente',
      'La API ya acepta faseClave. Falta el selector en la interfaz, el filtro «Sin asociar» en Calendar/MeetingHub, alimentar «Pregúntale al proyecto» con las notas de las reuniones asociadas y que el Agendador pregunte a qué solución pertenece.', 'MEDIUM', 'BACKLOG', 'DESARROLLO'),
    T('Subir a GitHub el commit de portalhub (migración 027 y reuniones del proyecto)',
      'El push falla en el VPS: el repositorio portalhub no tiene credenciales de GitHub guardadas. Tarea del usuario o definir el acceso.', 'MEDIUM', 'BACKLOG', 'TASK'),
  ],
};

(async () => {
  const ya = await prisma.sprint.findFirst({ where: { sprintCode: SPRINT.code } });
  if (ya) { console.log('ya existe', SPRINT.code); return; }
  const sp = await prisma.sprint.create({ data: { id: crypto.randomUUID(), sprintCode: SPRINT.code, name: SPRINT.name, goal: SPRINT.goal, status: 'REVIEW_PENDING', epicId: EPICA_MOTOR, solucionId: SOLUCION, ownerAreaId: AREA } });
  let n = 0;
  for (const t of SPRINT.tasks) {
    n++;
    await prisma.backlogItem.create({ data: { id: crypto.randomUUID(), taskCode: `${SPRINT.code}-${String(n).padStart(3, '0')}`, sprintId: sp.id, solucionId: SOLUCION, title: t.title, description: t.description, type: t.type, priority: t.priority, status: t.status, order: n, resultado: t.resultado, points: null } });
  }
  console.log('creado', SPRINT.code, `(${n} tareas)`);
  await prisma.$disconnect();
})().catch(async e => { console.error('ERROR', e.message); await prisma.$disconnect(); process.exit(1); });
