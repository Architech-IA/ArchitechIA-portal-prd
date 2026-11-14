// Constantes y tipos compartidos del repositorio de documentos (sin dependencias de servidor: las usa también el cliente).
export const TIPOS = ['Propuesta', 'Presentación', 'Contrato', 'Acta', 'Factura', 'Informe', 'Otro'] as const;
export const ESTADOS = ['Borrador', 'Enviado', 'En negociación', 'Firmado', 'Rechazado', 'Reemplazado'] as const;
export const CANALES = ['Correo', 'Reunión', 'WhatsApp', 'Otro'] as const;
export type Tipo = (typeof TIPOS)[number];
export type Estado = (typeof ESTADOS)[number];

export const PLURAL: Record<string, string> = { Propuesta: 'Propuestas', 'Presentación': 'Presentaciones', Contrato: 'Contratos', Acta: 'Actas', Factura: 'Facturas', Informe: 'Informes', Otro: 'Otros' };

export interface DocumentoFila {
  id: string; tipo: string; titulo: string; estado: string; version: number; grupo: string;
  clienteId: string | null; clienteNombre: string; solucionId: string | null; proyectoNombre: string | null;
  archivoNombre: string | null; mime: string | null; tamano: number; tieneContenido: boolean;
  canal: string | null; enviadoEn: string | null; valorFinal: number | null; creadoPorNombre: string | null; createdAt: string; updatedAt: string;
}
export interface DocumentoDetalle extends DocumentoFila { contenido: string | null; notas: string | null; historial: { evento: string; usuarioNombre: string | null; createdAt: string }[] }
export interface Opciones { clientes: { id: string; nombre: string }[]; proyectos: { id: string; nombre: string; empresa: string | null }[] }

export const esTipo = (v: unknown): v is Tipo => typeof v === 'string' && (TIPOS as readonly string[]).includes(v);
export const esEstado = (v: unknown): v is Estado => typeof v === 'string' && (ESTADOS as readonly string[]).includes(v);
export const esCanal = (v: unknown): boolean => typeof v === 'string' && (CANALES as readonly string[]).includes(v);

// Un documento enviado o firmado es una prueba: no se modifica; se corrige con una versión nueva.
export const esSoloLectura = (estado: string) => estado === 'Enviado' || estado === 'En negociación' || estado === 'Firmado' || estado === 'Rechazado' || estado === 'Reemplazado';
// Extensión sugerida para el icono según el archivo o el tipo.
export function formatoIcono(f: Pick<DocumentoFila, 'archivoNombre' | 'mime' | 'tieneContenido'>): string {
  const n = (f.archivoNombre || '').toLowerCase();
  if (/\.pptx?$/.test(n)) return 'PPT';
  if (/\.docx?$/.test(n)) return 'DOC';
  if (/\.xlsx?$/.test(n) || /\.csv$/.test(n)) return 'XLS';
  if (/\.(png|jpe?g|gif|webp)$/.test(n)) return 'IMG';
  if (/\.pdf$/.test(n)) return 'PDF';
  return f.tieneContenido ? 'DOC' : 'ARCH';
}
