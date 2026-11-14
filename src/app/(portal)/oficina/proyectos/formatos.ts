// Formato esperado de un entregable: dónde vive o en qué archivo se entrega.
export const FORMATO: Record<string, string> = {
  nota: 'Notas del proyecto', registro: 'Registro en el portal', portal: 'Documento del portal', diagrama: 'Diagrama del portal', propuesta: 'Documentos de la propuesta',
  backlog: 'Tareas del backlog', url: 'URL de producción', ficha: 'Ficha en el portal',
  pdf: 'PDF (.pdf)', pdf_firmado: 'PDF firmado (.pdf)', zip: 'Archivo ZIP (.zip)', texto: 'Documento Word (.docx)', hoja: 'Hoja de Excel (.xlsx)', md: 'Markdown (.md)', doc: 'Documento del portal (editable)', html: 'HTML (.html)', txt: 'Texto plano (.txt)', csv: 'CSV (.csv)', enlace: 'Enlace',
}

// Extensión del archivo que espera cada formato; el enlace no lleva archivo
export const EXTENSION: Record<string, string> = { pdf: 'pdf', pdf_firmado: 'pdf', zip: 'zip', texto: 'docx', hoja: 'xlsx', md: 'md', html: 'html', txt: 'txt', csv: 'csv' }
