export type Area      = 'comercial' | 'operacion' | 'legal' | 'finanzas' | 'rrhh' | 'tecnologia';
export type ProcType  = 'sop' | 'etl' | 'onboarding' | 'cierre' | 'reporte' | 'revision' | 'otro';
export type StepTipo  = 'manual' | 'automatizado' | 'decision';

export interface ProcStep {
  id: string;
  label: string;
  tipo: StepTipo;
  responsable: string;
}

export interface Proceso {
  id: string;
  nombre: string;
  desc: string;
  area: Area;
  tipo: ProcType;
  responsable: string;
  sla: string;
  estado: 'activo' | 'borrador';
  pasos: ProcStep[];
  hasWorkflow: boolean;
}

export const AREAS: Record<Area, { label: string; color: string; bg: string; border: string }> = {
  comercial:  { label: 'Comercial',  color: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.25)'  },
  operacion:  { label: 'Operación',  color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)' },
  legal:      { label: 'Legal',      color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.25)'  },
  finanzas:   { label: 'Finanzas',   color: '#34d399', bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.25)'  },
  rrhh:       { label: 'RRHH',       color: '#f472b6', bg: 'rgba(244,114,182,0.10)', border: 'rgba(244,114,182,0.25)' },
  tecnologia: { label: 'Tecnología', color: '#22d3ee', bg: 'rgba(34,211,238,0.10)',  border: 'rgba(34,211,238,0.25)'  },
};

export const TIPOS: Record<ProcType, string> = {
  sop: 'SOP', etl: 'ETL', onboarding: 'Onboarding', cierre: 'Cierre',
  reporte: 'Reporte', revision: 'Revisión', otro: 'Otro',
};

export const STEP_META: Record<StepTipo, { label: string; color: string; bg: string }> = {
  automatizado: { label: 'Auto',     color: '#60a5fa', bg: 'rgba(96,165,250,0.15)'  },
  manual:       { label: 'Manual',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  decision:     { label: 'Decisión', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'  },
};

export const SEED: Proceso[] = [
  {
    id: 'p1', nombre: 'Onboarding de Lead',
    desc: 'Recepción y calificación de nuevos leads hasta asignación a ejecutivo comercial.',
    area: 'comercial', tipo: 'onboarding', responsable: 'Equipo Comercial',
    sla: '24 horas', estado: 'activo', hasWorkflow: true,
    pasos: [
      { id: 's1', label: 'Recibir lead (webhook / formulario)', tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's2', label: 'Calificar por criterios ICP',         tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's3', label: 'Enriquecer datos del prospecto',      tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's4', label: 'Revisión manual y asignación',        tipo: 'decision',     responsable: 'Manager Comercial' },
      { id: 's5', label: 'Notificar al ejecutivo asignado',     tipo: 'automatizado', responsable: 'Sistema' },
    ],
  },
  {
    id: 'p2', nombre: 'Cierre y Facturación',
    desc: 'Desde la aceptación de propuesta hasta emisión de factura y registro en finanzas.',
    area: 'comercial', tipo: 'cierre', responsable: 'Ejecutivo de Cuenta',
    sla: '48 horas', estado: 'activo', hasWorkflow: true,
    pasos: [
      { id: 's1', label: 'Confirmar aceptación del cliente',    tipo: 'manual',       responsable: 'Ejecutivo' },
      { id: 's2', label: 'Generar contrato / addendum',         tipo: 'manual',       responsable: 'Legal' },
      { id: 's3', label: 'Firma digital del documento',         tipo: 'manual',       responsable: 'Cliente + Legal' },
      { id: 's4', label: 'Emitir factura en sistema',           tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's5', label: 'Registrar en módulo Finanzas',        tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's6', label: 'Notificar a equipo de entrega',       tipo: 'automatizado', responsable: 'Sistema' },
    ],
  },
  {
    id: 'p3', nombre: 'Reporte Semanal de KPIs',
    desc: 'Generación y distribución automática de indicadores clave cada lunes a las 8 am.',
    area: 'operacion', tipo: 'reporte', responsable: 'Operaciones',
    sla: '30 minutos', estado: 'activo', hasWorkflow: true,
    pasos: [
      { id: 's1', label: 'Consultar métricas en base de datos',  tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's2', label: 'Calcular variaciones y tendencias',    tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's3', label: 'Generar PDF del reporte',              tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's4', label: 'Enviar por email a stakeholders',      tipo: 'automatizado', responsable: 'Sistema' },
    ],
  },
  {
    id: 'p4', nombre: 'Incorporación de Colaborador',
    desc: 'Checklist completo para nuevas incorporaciones: firma, accesos, bienvenida y evaluación.',
    area: 'rrhh', tipo: 'onboarding', responsable: 'RRHH',
    sla: '5 días hábiles', estado: 'activo', hasWorkflow: false,
    pasos: [
      { id: 's1', label: 'Firmar contrato y documentación legal', tipo: 'manual',       responsable: 'RRHH + Legal' },
      { id: 's2', label: 'Crear accesos en sistemas internos',    tipo: 'manual',       responsable: 'IT' },
      { id: 's3', label: 'Asignar equipo y espacio de trabajo',   tipo: 'manual',       responsable: 'RRHH' },
      { id: 's4', label: 'Enviar bienvenida y manual de empresa', tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's5', label: 'Agendar reunión con equipo directo',    tipo: 'manual',       responsable: 'Manager' },
      { id: 's6', label: 'Completar capacitación inicial',        tipo: 'manual',       responsable: 'Colaborador' },
      { id: 's7', label: 'Evaluación al cierre del mes 1',        tipo: 'manual',       responsable: 'Manager' },
    ],
  },
  {
    id: 'p5', nombre: 'Revisión de Facturas Pendientes',
    desc: 'Conciliación semanal y seguimiento de cuentas por cobrar.',
    area: 'finanzas', tipo: 'revision', responsable: 'Finanzas',
    sla: '1 día hábil', estado: 'activo', hasWorkflow: true,
    pasos: [
      { id: 's1', label: 'Extraer facturas vencidas del sistema',  tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's2', label: 'Clasificar por antigüedad (30/60/90d)',  tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's3', label: 'Revisión de casos críticos',             tipo: 'decision',     responsable: 'Tesorero' },
      { id: 's4', label: 'Enviar recordatorio a clientes',         tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's5', label: 'Actualizar estado en módulo Finanzas',   tipo: 'automatizado', responsable: 'Sistema' },
    ],
  },
  {
    id: 'p6', nombre: 'Contratos por Vencer',
    desc: 'Alerta y seguimiento de contratos con vencimiento en los próximos 60 días.',
    area: 'legal', tipo: 'revision', responsable: 'Legal',
    sla: '3 días hábiles', estado: 'borrador', hasWorkflow: false,
    pasos: [
      { id: 's1', label: 'Detectar contratos con vencimiento próximo', tipo: 'automatizado', responsable: 'Sistema' },
      { id: 's2', label: 'Revisar condiciones de renovación',          tipo: 'manual',       responsable: 'Legal' },
      { id: 's3', label: 'Contactar cliente para negociar renovación', tipo: 'manual',       responsable: 'Ejecutivo' },
      { id: 's4', label: 'Generar addendum o nuevo contrato',          tipo: 'manual',       responsable: 'Legal' },
    ],
  },
];

const LS_KEY = 'wf-procesos-v1';

export function loadProcesos(): Proceso[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : SEED;
  } catch { return SEED; }
}

export function saveProcesos(list: Proceso[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}
