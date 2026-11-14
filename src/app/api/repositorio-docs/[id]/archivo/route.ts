import { NextRequest, NextResponse } from 'next/server';
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO } from '@/lib/proyectos/auth';
import { archivo, obtener } from '@/lib/documentos/servicio';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/[&<>]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
const nombreSeguro = (s: string) => s.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'documento';
// Tipos que el navegador puede mostrar sin riesgo dentro del portal; el resto se descarga.
const INLINE = /^(application\/pdf|image\/(png|jpe?g|gif|webp))$/;

// GET: el archivo subido, o el texto congelado (?formato=md|html). ?inline=1 lo muestra en el navegador cuando es seguro.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req);
  if (!u) return NO_AUTENTICADO();
  const { id } = await params;
  const a = await archivo(id);
  const sec = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'" };
  if (a) {
    const inline = req.nextUrl.searchParams.get('inline') === '1' && INLINE.test(a.mime);
    return new NextResponse(new Uint8Array(a.buf), { headers: { ...sec, 'Content-Type': inline ? a.mime : 'application/octet-stream', 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${nombreSeguro(a.nombre)}"` } });
  }
  const d = await obtener(id);
  if (!d?.contenido) return NO_ENCONTRADO('Archivo');
  const formato = req.nextUrl.searchParams.get('formato') === 'html' ? 'html' : 'md';
  const base = nombreSeguro(`${d.titulo} v${d.version}`);
  if (formato === 'md') return new NextResponse(d.contenido, { headers: { ...sec, 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${base}.md"` } });
  // HTML: el texto va escapado dentro de <pre> (no se interpreta HTML del documento).
  const html = `<!doctype html><meta charset="utf-8"><title>${esc(d.titulo)}</title><pre style="white-space:pre-wrap;font:14px/1.5 system-ui;max-width:800px;margin:2rem auto">${esc(d.contenido)}</pre>`;
  return new NextResponse(html, { headers: { ...sec, 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="${base}.html"` } });
}
