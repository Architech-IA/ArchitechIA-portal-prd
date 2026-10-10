// Limpieza de HTML guardado por el editor enriquecido o generado por la IA: se muestra dentro del hub (contentEditable),
// se imprime y se exporta en el paquete de entrega, así que nunca debe ejecutar scripts ni cargar nada externo.

const QUITAR = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'SVG', 'MATH', 'BASE', 'AUDIO', 'VIDEO', 'IMG', 'PICTURE', 'CANVAS'])
const PERMITIDAS = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'SPAN', 'DIV', 'BLOCKQUOTE', 'CODE', 'PRE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'HR', 'FONT', 'SUB', 'SUP'])
const ESTILOS = new Set(['color', 'background-color', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-align'])

function estiloSeguro(css: string): string {
  return css.split(';').map(x => x.trim()).filter(Boolean).filter(decl => {
    const [prop, ...resto] = decl.split(':')
    const valor = resto.join(':').toLowerCase()
    return ESTILOS.has(prop.trim().toLowerCase()) && !/url\(|expression|javascript:|@import|\\/.test(valor)
  }).join('; ')
}

function limpiarNodo(nodo: Element) {
  for (const hijo of Array.from(nodo.children)) {
    if (QUITAR.has(hijo.tagName)) { hijo.remove(); continue }
    limpiarNodo(hijo)
    if (!PERMITIDAS.has(hijo.tagName)) { hijo.replaceWith(...Array.from(hijo.childNodes)); continue }
    for (const a of Array.from(hijo.attributes)) {
      const n = a.name.toLowerCase()
      if (n === 'style') {
        const e = estiloSeguro(a.value)
        if (e) hijo.setAttribute('style', e); else hijo.removeAttribute('style')
      } else if (hijo.tagName === 'A' && n === 'href') {
        if (!/^(https?:|mailto:|tel:|#)/i.test(a.value.trim())) hijo.removeAttribute('href')
      } else if (!(n === 'colspan' || n === 'rowspan' || (hijo.tagName === 'FONT' && (n === 'size' || n === 'color')))) {
        hijo.removeAttribute(a.name)
      }
    }
    if (hijo.tagName === 'A') { hijo.setAttribute('rel', 'noopener noreferrer'); hijo.setAttribute('target', '_blank') }
  }
}

/** Devuelve el HTML sin scripts, manejadores de eventos, estilos peligrosos ni elementos que carguen recursos. */
export function sanitizarHtml(html: string): string {
  if (!html || typeof window === 'undefined' || typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  limpiarNodo(doc.body)
  return doc.body.innerHTML
}

export function escapar(t: string): string {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
