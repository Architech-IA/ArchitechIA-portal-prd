// Registro de los agentes que ya tienen función real en el portal (el resto del directorio son fichas sin comportamiento).
// El directorio lo usa para distinguirlos y mostrar qué hacen, con quién colaboran y por dónde se usan,
// y el control de agentes (src/lib/agentes) para saber qué acciones se pueden permitir o bloquear.
export interface Accion { clave: string; etiqueta: string }
export interface InfoAgente { funciones: string[]; canales: string[]; bot?: string; colabora: string[]; acciones: Accion[] }

export const AGENTES_FUNCIONALES: Record<string, InfoAgente> = {
  documentador: {
    funciones: ['Convierte notas de voz o dictados en una propuesta de acta (hechos, decisiones, pendientes)', 'Responde consultas sobre reuniones, pendientes, clientes, briefings y memoria de proyecto', 'Redacta documentos de proyecto a partir del contenido que le entrega Presales'],
    canales: ['Telegram', 'Editor de documentos', 'Sage'],
    bot: '@Documentador_ArchitechIA_Bot',
    colabora: ['presales'],
    acciones: [
      { clave: 'nota', etiqueta: 'Convertir notas de voz y dictados en actas' },
      { clave: 'consulta', etiqueta: 'Responder consultas sobre lo documentado' },
      { clave: 'redactar', etiqueta: 'Redactar documentos de proyecto (con Presales)' },
    ],
  },
  'booking-agent': {
    funciones: ['Crea, mueve, modifica y cancela reuniones del calendario (siempre con confirmación)', 'Consulta la agenda del día o de la semana', 'Avisa si una reunión se cruza con otra'],
    canales: ['Telegram', 'Portal (Reuniones)', 'Sage'],
    bot: '@BookingAgent_ArchiTechIA_bot',
    colabora: [],
    acciones: [
      { clave: 'consultar', etiqueta: 'Consultar la agenda' },
      { clave: 'crear', etiqueta: 'Crear reuniones' },
      { clave: 'mover', etiqueta: 'Mover reuniones' },
      { clave: 'editar', etiqueta: 'Modificar datos de reuniones' },
      { clave: 'cancelar', etiqueta: 'Cancelar reuniones' },
    ],
  },
  'backlog-manager': {
    funciones: ['Consulta el backlog: tareas por sprint, responsable, estado o tipo; sprints y épicas', 'Crea y modifica tareas y épicas (siempre con confirmación)', 'Distingue tareas de personas (humano) y de agentes', 'No aprueba sprints, no cambia estados ni borra: eso se hace en el Backlog del portal'],
    canales: ['Telegram', 'Sage'],
    bot: '@BacklogManager_ArchiTechIA_Bot',
    colabora: [],
    acciones: [
      { clave: 'consultar', etiqueta: 'Consultar el backlog' },
      { clave: 'crear_tarea', etiqueta: 'Crear tareas' },
      { clave: 'editar_tarea', etiqueta: 'Modificar tareas' },
      { clave: 'crear_epica', etiqueta: 'Crear épicas' },
      { clave: 'editar_epica', etiqueta: 'Modificar épicas' },
    ],
  },
  presales: {
    funciones: ['Aporta el contenido técnico y de diagnóstico de un documento de proyecto', 'Revisa el borrador del Documentador: aprueba, comenta o pide ajustes (hasta 3 rondas)', 'Arma propuestas comerciales (alcance, entregables, plazos y rangos de inversión por confirmar)', 'No fija el precio final ni edita documentos: deja una propuesta que una persona acepta'],
    canales: ['Telegram', 'Sage'],
    bot: '@PresalesAgent_ArchiTechIA_Bot',
    colabora: ['documentador'],
    acciones: [
      { clave: 'preparar_documento', etiqueta: 'Preparar y mejorar documentos de proyecto' },
    ],
  },
};

export const NOMBRE_AGENTE: Record<string, string> = { documentador: 'El Documentador', 'booking-agent': 'Booking Agent', 'backlog-manager': 'Backlog Manager', presales: 'Presales' };
