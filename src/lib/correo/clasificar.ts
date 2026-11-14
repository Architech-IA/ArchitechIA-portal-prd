/**
 * Clasificación de correo por capas, de la más segura a la menos.
 *
 *   1. Remitente o dominio fijados a mano (regla MANUAL)            -> confianza Alta
 *   2. Palabras y adjuntos (reglas TEXTO + palabras por defecto)    -> Media (Alta si hay XML de factura)
 *   3. Reglas aprendidas de las correcciones del usuario            -> Media
 *   4. Nada decide: queda sin clasificar para revisión humana       -> Baja
 *
 * Si una capa encuentra dos categorías distintas, no decide: es un conflicto y va a revisión.
 * Esto es una función pura (sin base de datos) para poder probarla.
 */

export type Confianza = 'Alta' | 'Media' | 'Baja';

export interface EntradaCorreo {
  sender: string | null;
  subject: string | null;
  bodyPreview: string | null;
  hasAttachments: boolean;
  adjuntos: string[];
}

export interface ReglaCorreo {
  id: string;
  tipo: string; // REMITENTE | DOMINIO | TEXTO
  patron: string;
  categoriaId: string;
  origen: string; // MANUAL | APRENDIDA
  clienteId?: string | null;
}

export interface ResultadoClasificacion {
  categoriaId: string | null;
  origen: 'REMITENTE' | 'TEXTO' | 'APRENDIDA' | 'NINGUNA';
  confianza: Confianza;
  motivo: string;
  reglaId?: string;
  clienteId?: string | null;
}

export const PALABRAS_POR_DEFECTO: Record<string, string[]> = {
  cat_factura: ['factura electronica', 'factura de venta', 'cufe', 'nota credito', 'nota debito'],
  cat_soporte: ['no puedo entrar', 'no puedo ingresar', 'no funciona', 'soporte tecnico', 'incidente', 'falla en'],
  cat_legal: ['contrato', 'clausula', 'notaria', 'demanda', 'poder especial'],
  cat_comercial: ['cotizacion', 'propuesta comercial', 'presupuesto', 'precio de'],
  cat_proyecto: ['backlog', 'sprint', 'entregable', 'avance del proyecto', 'ajuste del'],
};

export function normalizar(t: string | null | undefined): string {
  return (t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dominioDe(email: string | null): string {
  const e = (email ?? '').toLowerCase().trim();
  const i = e.lastIndexOf('@');
  return i >= 0 ? e.slice(i + 1) : '';
}

function unicaCategoria(aciertos: { categoriaId: string; regla?: ReglaCorreo; texto?: string }[]) {
  const ids = Array.from(new Set(aciertos.map((a) => a.categoriaId)));
  if (ids.length === 0) return { tipo: 'ninguna' as const };
  if (ids.length > 1) return { tipo: 'conflicto' as const };
  return { tipo: 'una' as const, categoriaId: ids[0], aciertos };
}

export function clasificar(m: EntradaCorreo, reglas: ReglaCorreo[]): ResultadoClasificacion {
  const sender = (m.sender ?? '').toLowerCase().trim();
  const dominio = dominioDe(m.sender);
  const texto = normalizar(`${m.subject ?? ''} ${m.bodyPreview ?? ''}`);
  const tieneXml = m.adjuntos.some((a) => a.toLowerCase().endsWith('.xml'));

  const esRemitente = (r: ReglaCorreo) =>
    (r.tipo === 'REMITENTE' && r.patron.toLowerCase() === sender) ||
    (r.tipo === 'DOMINIO' && r.patron.toLowerCase() === dominio && dominio !== '');

  // Capa 1: remitente o dominio fijados a mano
  {
    const hits = reglas.filter((r) => r.origen === 'MANUAL' && esRemitente(r)).map((r) => ({ categoriaId: r.categoriaId, regla: r }));
    const u = unicaCategoria(hits);
    if (u.tipo === 'conflicto') {
      return { categoriaId: null, origen: 'NINGUNA', confianza: 'Baja', motivo: 'Reglas de remitente en conflicto' };
    }
    if (u.tipo === 'una') {
      const r = u.aciertos![0].regla!;
      return {
        categoriaId: u.categoriaId,
        origen: 'REMITENTE',
        confianza: 'Alta',
        motivo: r.tipo === 'DOMINIO' ? `Dominio conocido: ${r.patron}` : `Remitente conocido: ${r.patron}`,
        reglaId: r.id,
        clienteId: r.clienteId ?? null,
      };
    }
  }

  // Capa 2: palabras y adjuntos
  {
    const hits: { categoriaId: string; regla?: ReglaCorreo; texto?: string }[] = [];
    for (const r of reglas) {
      if (r.tipo === 'TEXTO' && r.origen === 'MANUAL' && texto.includes(normalizar(r.patron))) {
        hits.push({ categoriaId: r.categoriaId, regla: r, texto: r.patron });
      }
    }
    for (const [cat, palabras] of Object.entries(PALABRAS_POR_DEFECTO)) {
      const p = palabras.find((w) => texto.includes(w));
      if (p) hits.push({ categoriaId: cat, texto: p });
    }
    if (tieneXml && texto.includes('factura')) hits.push({ categoriaId: 'cat_factura', texto: 'adjunto XML' });
    const u = unicaCategoria(hits);
    if (u.tipo === 'conflicto') {
      return { categoriaId: null, origen: 'NINGUNA', confianza: 'Baja', motivo: 'Palabras de varias categorías: revisar a mano' };
    }
    if (u.tipo === 'una') {
      const a = u.aciertos![0];
      const alta = u.categoriaId === 'cat_factura' && tieneXml;
      return {
        categoriaId: u.categoriaId!,
        origen: 'TEXTO',
        confianza: alta ? 'Alta' : 'Media',
        motivo: a.texto === 'adjunto XML' ? 'Adjunto XML de factura' : `Texto: «${a.texto}»`,
        reglaId: a.regla?.id,
        clienteId: a.regla?.clienteId ?? null,
      };
    }
  }

  // Capa 3: aprendido de correcciones anteriores
  {
    const hits = reglas.filter((r) => r.origen === 'APRENDIDA' && esRemitente(r)).map((r) => ({ categoriaId: r.categoriaId, regla: r }));
    const u = unicaCategoria(hits);
    if (u.tipo === 'conflicto') {
      return { categoriaId: null, origen: 'NINGUNA', confianza: 'Baja', motivo: 'Lo aprendido de este remitente se contradice' };
    }
    if (u.tipo === 'una') {
      const r = u.aciertos![0].regla!;
      return {
        categoriaId: u.categoriaId!,
        origen: 'APRENDIDA',
        confianza: 'Media',
        motivo: `Aprendido de tus correcciones (${r.patron})`,
        reglaId: r.id,
        clienteId: r.clienteId ?? null,
      };
    }
  }

  return { categoriaId: null, origen: 'NINGUNA', confianza: 'Baja', motivo: 'Ninguna regla aplica con confianza' };
}
