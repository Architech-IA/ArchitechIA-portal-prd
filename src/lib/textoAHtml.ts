// Utilidades para pasar entre texto plano/markdown ligero y el HTML simple que
// entiende el editor de notas (tiptap: p, h2, h3, ul, ol, li, strong, em, u).
// Puro y sin dependencias: se usa tanto en el servidor (saneo de lo que devuelve
// la IA) como en el navegador (insertar una respuesta del asesor en una nota).

const PERMITIDAS = 'p|h2|h3|ul|ol|li|strong|em|u|br'

export function escaparHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// **negrita** y *cursiva* dentro de una linea ya escapada
function inline(s: string): string {
  return escaparHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
}

// Texto plano / markdown ligero -> HTML del editor
export function textoAHtml(texto: string): string {
  const lineas = texto.replace(/\r/g, '').split('\n')
  const out: string[] = []
  let lista: 'ul' | 'ol' | null = null
  const cerrar = () => { if (lista) { out.push(`</${lista}>`); lista = null } }
  for (const cruda of lineas) {
    const l = cruda.trim()
    if (!l) { cerrar(); continue }
    let m: RegExpMatchArray | null
    if ((m = l.match(/^#{1,2}\s+(.*)$/))) { cerrar(); out.push(`<h2>${inline(m[1])}</h2>`); continue }
    if ((m = l.match(/^#{3,6}\s+(.*)$/))) { cerrar(); out.push(`<h3>${inline(m[1])}</h3>`); continue }
    if ((m = l.match(/^[-*•]\s+(.*)$/))) {
      if (lista !== 'ul') { cerrar(); out.push('<ul>'); lista = 'ul' }
      out.push(`<li><p>${inline(m[1])}</p></li>`); continue
    }
    if ((m = l.match(/^\d+[.)]\s+(.*)$/))) {
      if (lista !== 'ol') { cerrar(); out.push('<ol>'); lista = 'ol' }
      out.push(`<li><p>${inline(m[1])}</p></li>`); continue
    }
    cerrar(); out.push(`<p>${inline(l)}</p>`)
  }
  cerrar()
  return out.join('')
}

// HTML que devuelve el modelo -> solo etiquetas permitidas y sin atributos.
// Si no trae etiquetas de bloque (respondio con texto/markdown) se convierte.
export function sanearHtml(h: string): string {
  let s = (h || '').trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '').trim()
  if (!/<(p|h2|h3|ul|ol|li)[\s>]/i.test(s)) return textoAHtml(s.replace(/<[^>]+>/g, ''))
  s = s.replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
  s = s.replace(new RegExp(`<\\/?(?!(?:${PERMITIDAS})\\b)[a-z][^>]*>`, 'gi'), '')
  s = s.replace(/<(p|h2|h3|ul|ol|li|strong|em|u)\s+[^>]*>/gi, '<$1>')
  s = s.replace(/<h1>/gi, '<h2>').replace(/<\/h1>/gi, '</h2>')
  return s.trim()
}

export function htmlATextoPlano(html: string): string {
  return html
    .replace(/<\/(p|h[1-6]|div|li)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}
