'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import PanelIADoc from './PanelIADoc'
import { RichTextField } from '../../solutions/pilots/[id]/EditorRico'
import { sanitizarHtml } from '../../solutions/pilots/[id]/sanitizar'

// El mismo editor, la misma barra y la misma hoja del PRD, para los documentos de las fases.
// El documento puede estar guardado como HTML (editado aquí) o como Markdown (lo que deja la IA): se muestra siempre como hoja.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function esHtml(s: string) { return /^\s*<[a-z][\s\S]*>/i.test(s) }

function enLinea(t: string) {
  let s = esc(t)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>')
  return s
}

const filas = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
const esLista = (l: string) => /^\s*([-*+]|\d+\.)\s+/.test(l)
const esBloque = (l: string) => /^#{1,6}\s/.test(l) || /^(-{3,}|\*{3,})\s*$/.test(l) || l.trim().startsWith('|') || esLista(l) || l.trim().startsWith('>')

/** Markdown → HTML de hoja; lo que ya es HTML se deja tal cual. */
export function aHtml(texto: string): string {
  if (!texto.trim()) return ''
  if (esHtml(texto)) return texto
  const L = texto.replace(/\r/g, '').split('\n')
  const out: string[] = []
  let i = 0
  while (i < L.length) {
    const l = L[i]
    if (!l.trim()) { i++; continue }
    const h = /^(#{1,6})\s+(.*)$/.exec(l)
    if (h) { out.push(`<h${h[1].length}>${enLinea(h[2].trim())}</h${h[1].length}>`); i++; continue }
    if (/^(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue }
    if (l.trim().startsWith('|') && i + 1 < L.length && /^\s*\|?\s*:?-{2,}/.test(L[i + 1])) {
      const cab = filas(l); i += 2
      const cuerpo: string[][] = []
      while (i < L.length && L[i].trim().startsWith('|')) { cuerpo.push(filas(L[i])); i++ }
      out.push(`<table><thead><tr>${cab.map(c => `<th>${enLinea(c)}</th>`).join('')}</tr></thead><tbody>${cuerpo.map(r => `<tr>${r.map(c => `<td>${enLinea(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
      continue
    }
    if (esLista(l)) {
      const ord = /^\s*\d+\./.test(l)
      const items: string[] = []
      while (i < L.length && esLista(L[i])) { items.push(L[i].replace(/^\s*([-*+]|\d+\.)\s+/, '')); i++ }
      out.push(`<${ord ? 'ol' : 'ul'}>${items.map(x => `<li>${enLinea(x)}</li>`).join('')}</${ord ? 'ol' : 'ul'}>`)
      continue
    }
    if (l.trim().startsWith('>')) {
      const q: string[] = []
      while (i < L.length && L[i].trim().startsWith('>')) { q.push(L[i].replace(/^\s*>\s?/, '')); i++ }
      out.push(`<blockquote>${enLinea(q.join(' '))}</blockquote>`)
      continue
    }
    const p: string[] = []
    while (i < L.length && L[i].trim() && !esBloque(L[i])) { p.push(L[i]); i++ }
    if (!p.length) { p.push(l); i++ }
    out.push(`<p>${p.map(enLinea).join('<br>')}</p>`)
  }
  return out.join('')
}

const CSS_HOJA = `h1{font-size:28px;line-height:1.25;font-weight:800;margin:.3em 0 .5em;color:#111827}
h2{font-size:21px;font-weight:700;margin:1.5em 0 .5em;padding-bottom:.3em;border-bottom:1px solid #e5e7eb;color:#111827}
h3{font-size:17px;font-weight:700;margin:1.2em 0 .3em;color:#111827}
p{margin:.5em 0}ul{list-style:disc;padding-left:1.5rem;margin:.5em 0}ol{list-style:decimal;padding-left:1.5rem;margin:.5em 0}
blockquote{border-left:3px solid #94a3b8;margin:.8em 0;padding:.1em 1em;color:#475569}
code{background:#f1f5f9;border-radius:4px;padding:.1em .35em;font-size:.9em}
hr{border:0;border-top:1px solid #cbd5e1;margin:1.4em 0}a{color:#2563eb;text-decoration:underline}
table{border-collapse:collapse;width:100%;margin:.9em 0}th,td{border:1px solid #cbd5e1;padding:6px 10px;vertical-align:top;text-align:left}th{background:#f1f5f9;font-weight:700}`

/** Imprime solo el documento (no todo el portal) para guardarlo como PDF con el formato que se ve. */
export function imprimir(titulo: string, html: string) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font-family:'Segoe UI',Calibri,Arial,sans-serif;color:#1f2937;line-height:1.7;max-width:820px;margin:32px auto;padding:0 24px}${CSS_HOJA}</style></head><body>${sanitizarHtml(html)}</body></html>`)
  w.document.close(); w.focus()
  setTimeout(() => w.print(), 300)
}

export default function PanelRico({ proyectoId, fase, clave, valor, onCambio, soloLectura, puedeEditar, sucio, guardando, onGuardar, titulo, leyenda, pedirIa, marca = true }: {
  proyectoId: string; fase: string; clave: string; valor: string; onCambio: (html: string) => void; soloLectura: boolean; puedeEditar: boolean; sucio: boolean; guardando: boolean
  onGuardar: () => void; titulo: string; leyenda?: string; pedirIa?: number; marca?: boolean
}) {
  const hoja = useRef<HTMLDivElement>(null)
  const [marcas, setMarcas] = useState<{ i: number; titulo: string; nivel: number; top: number }[]>([])
  const [ia, setIa] = useState<{ tipo: 'seccion' | 'documento'; i?: number; titulo: string; n?: number } | null>(null)
  // La cabecera del editor pide abrir el Agente Documentador sobre todo el documento (cada pedido sube el contador).
  useEffect(() => { if (pedirIa) setIa({ tipo: 'documento', titulo }) }, [pedirIa]) // eslint-disable-line react-hooks/exhaustive-deps
  const editable = () => hoja.current?.querySelector('.doc-rico') as HTMLElement | null
  // Paginación como en Word: hojas A4 (297/210 del ancho de la hoja) separadas por un espacio; cada bloque que cruzaría el fin de hoja salta a la siguiente
  // con un margen superior temporal (data-pg) que no se guarda. Se recalcula al escribir, al cambiar el ancho y al cargar fuentes o imágenes.
  const [pag, setPag] = useState({ n: 1, P: 1188 })
  const paginando = useRef(false)
  const ultimoAncho = useRef<number | undefined>(undefined)
  const GAP = 28, MARGEN_SUP = 64, MARGEN_INF = 64

  // los destellos de IA se colocan junto a cada título de sección (## y ###) y siguen al texto mientras se edita
  const medir = useCallback(() => {
    const ed = hoja.current?.querySelector('.doc-rico') as HTMLElement | null
    const h0 = hoja.current
    if (!ed || !h0) return
    const base = h0.getBoundingClientRect().top
    const lista = Array.from(ed.querySelectorAll('h2,h3')).map((h, i) => ({ i, titulo: (h.textContent || '').trim(), nivel: Number(h.tagName[1]), top: Math.round(h.getBoundingClientRect().top - base) }))
    setMarcas(prev => (JSON.stringify(prev) === JSON.stringify(lista) ? prev : lista))
  }, [])
  const paginar = useCallback(() => {
    const h = hoja.current
    const ed = h?.querySelector('.doc-rico') as HTMLElement | null
    if (!h || !ed) return
    paginando.current = true
    try {
      const P = Math.round((h.clientWidth * 297) / 210)
      const paso = P + GAP
      h.style.height = ''
      ed.querySelectorAll('[data-pg]').forEach(n => {
        const el = n as HTMLElement
        el.removeAttribute('data-pg')
        el.style.marginTop = ''
        if (!(el.getAttribute('style') ?? '').trim()) el.removeAttribute('style')
      })
      const bloques: HTMLElement[] = []
      for (const ch of Array.from(ed.children)) {
        if (ch.tagName === 'UL' || ch.tagName === 'OL') bloques.push(...(Array.from(ch.children) as HTMLElement[]))
        else bloques.push(ch as HTMLElement)
      }
      const base = () => h.getBoundingClientRect().top
      for (const b of bloques) {
        const r = b.getBoundingClientRect()
        const top = r.top - base()
        const alto = r.height
        const k = Math.max(0, Math.floor(top / paso))
        const limite = k * paso + P - MARGEN_INF
        const cabe = alto <= P - MARGEN_SUP - MARGEN_INF
        if ((top + alto > limite && cabe) || top >= limite) {
          const destino = (k + 1) * paso + MARGEN_SUP
          const delta = destino - top
          if (delta > 0) {
            b.style.marginTop = delta + 'px'
            b.setAttribute('data-pg', '1')
            const nt = b.getBoundingClientRect().top - base() // los márgenes se funden: se corrige la diferencia
            if (Math.abs(nt - destino) > 1) b.style.marginTop = delta + (destino - nt) + 'px'
          }
        }
      }
      const n = Math.max(1, Math.ceil((h.clientHeight + GAP) / paso))
      h.style.height = n * paso - GAP + 'px'
      setPag(prev => (prev.n === n && prev.P === P ? prev : { n, P }))
    } finally {
      paginando.current = false
    }
    medir()
  }, [medir])
  useEffect(() => {
    const h = hoja.current
    const ed = h?.querySelector('.doc-rico') as HTMLElement | null
    if (!h || !ed || typeof ResizeObserver === 'undefined') return
    let t: ReturnType<typeof setTimeout> | undefined
    const prog = () => { if (t) clearTimeout(t); t = setTimeout(paginar, 120) }
    const mo = new MutationObserver(() => { if (!paginando.current) prog() })
    mo.observe(ed, { childList: true, subtree: true, characterData: true })
    const ro = new ResizeObserver(() => { const w = h.clientWidth; if (w !== ultimoAncho.current) { ultimoAncho.current = w; prog() } })
    ro.observe(h)
    ed.addEventListener('load', prog, true)
    ;(document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready.then(prog)
    prog()
    return () => { if (t) clearTimeout(t); mo.disconnect(); ro.disconnect(); ed.removeEventListener('load', prog, true) }
  }, [paginar, valor])
  useEffect(() => {
    medir()
    const ed = hoja.current?.querySelector('.doc-rico') as HTMLElement | null
    if (!ed) return
    const mo = new MutationObserver(() => medir())
    mo.observe(ed, { childList: true, subtree: true, characterData: true })
    const ro = new ResizeObserver(() => medir())
    ro.observe(ed)
    window.addEventListener('resize', medir)
    return () => { mo.disconnect(); ro.disconnect(); window.removeEventListener('resize', medir) }
  }, [medir, valor])

  // una sección va desde su título hasta el siguiente título del mismo nivel o superior
  function seccionDe(ed: HTMLElement, i: number) {
    const h = (Array.from(ed.querySelectorAll('h2,h3')) as HTMLElement[])[i]
    if (!h) return null
    const nivel = Number(h.tagName[1])
    const nodos: Element[] = []
    let n = h.nextElementSibling
    while (n && !(/^H[1-6]$/.test(n.tagName) && Number(n.tagName[1]) <= nivel)) { nodos.push(n); n = n.nextElementSibling }
    return { h, nodos }
  }
  const obtener = () => {
    const ed = editable()
    const documento = ed ? ed.innerHTML : valor
    if (ia?.tipo === 'seccion' && ed && ia.i != null) { const s = seccionDe(ed, ia.i); return { documento, seccion: s ? s.nodos.map(x => x.outerHTML).join('') : '' } }
    return { documento }
  }
  function aplicar(md: string) {
    const ed = editable()
    if (!ed || !ia) return
    const html = sanitizarHtml(aHtml(md))
    if (ia.tipo === 'documento') ed.innerHTML = html
    else {
      const hs = Array.from(ed.querySelectorAll('h2,h3')) as HTMLElement[]
      let i = ia.i ?? -1
      if (!hs[i] || (hs[i].textContent || '').trim() !== ia.titulo) i = hs.findIndex(h => (h.textContent || '').trim() === ia.titulo)
      const s = i >= 0 ? seccionDe(ed, i) : null
      if (!s) return
      s.nodos.forEach(x => x.remove())
      const tpl = document.createElement('template')
      tpl.innerHTML = html
      const primero = tpl.content.firstElementChild
      if (primero && /^H[1-6]$/.test(primero.tagName) && (primero.textContent || '').trim() === ia.titulo) primero.remove()
      s.h.after(...Array.from(tpl.content.childNodes))
    }
    ed.dispatchEvent(new Event('input', { bubbles: true }))
    setIa(null)
    medir()
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      {ia && <PanelIADoc proyectoId={proyectoId} fase={fase} clave={clave} alcance={{ tipo: ia.tipo, titulo: ia.titulo, n: ia.n }} obtener={obtener} aHtml={m => sanitizarHtml(aHtml(m))} onAplicar={aplicar} onCerrar={() => setIa(null)} secciones={marcas.map(m => ({ i: m.i, titulo: m.titulo, nivel: m.nivel }))} onElegirSeccion={(i, t) => setIa({ tipo: 'seccion', i, titulo: t, n: i + 1 })} />}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.hoja-marca{font-family:'Poppins',var(--font-archivo),sans-serif}
.doc-rico{color:#1a1a1a;font-family:'Poppins',var(--font-archivo),sans-serif}
.doc-rico h1{font-size:28px;line-height:1.25;font-weight:700;margin:.3em 0 .6em;color:#1b2845}
.doc-rico h2{font-size:19px;font-weight:700;margin:1.6em 0 .5em;color:#1b2845;text-transform:uppercase;letter-spacing:.01em}
.doc-rico h3{font-size:15px;font-weight:700;margin:1.2em 0 .3em;color:#e84b1a;text-transform:uppercase}
.doc-rico p{margin:.5em 0}.doc-rico ul{list-style:disc;padding-left:1.5rem;margin:.5em 0}.doc-rico ol{list-style:decimal;padding-left:1.5rem;margin:.5em 0}
.doc-rico li::marker{color:#e84b1a}
.doc-rico blockquote{border-left:3px solid #e84b1a;margin:.8em 0;padding:.1em 1em;color:#475569}
.doc-rico code{background:#fdefe8;border-radius:4px;padding:.1em .35em;font-size:.9em}
.doc-rico hr{border:0;border-top:1px solid #f4c7b3;margin:1.4em 0}.doc-rico a{color:#e84b1a;text-decoration:underline}
.doc-rico table{border-collapse:collapse;width:100%;margin:.9em 0;font-size:13px}.doc-rico th,.doc-rico td{border:1px solid #f4c7b3;padding:6px 10px;vertical-align:top;text-align:left}.doc-rico th{background:#e84b1a;color:#fff;font-weight:700}.doc-rico tbody tr:nth-child(even) td{background:#fdefe8}
.hoja-marca .marca-curva{position:absolute;top:0;left:0;width:31.4%;aspect-ratio:3.3/1;object-fit:fill;opacity:.5;pointer-events:none;user-select:none}
.hoja-marca .marca-logo{position:absolute;top:14px;right:40px;width:calc(15.5% - 2px);pointer-events:none;user-select:none}
.hoja-marca .marca-logo-texto{position:absolute;top:15px;right:40px;font-family:'Poppins',sans-serif;font-weight:600;font-size:19px;letter-spacing:-.025em;line-height:1.2;color:#ff6a00;pointer-events:none;user-select:none;white-space:nowrap}
.hoja-marca .marca-pie{height:3px;margin:0 64px 22px;background:linear-gradient(90deg,transparent,#f9a67e,transparent)}
.hoja-marca .marca-pie-pag{position:absolute;left:64px;right:64px;height:3px;background:linear-gradient(90deg,transparent,#f9a67e,transparent);pointer-events:none}`}</style>
      <div className="rounded-2xl p-4 space-y-4 mx-auto max-w-[1180px]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(18px)', boxShadow: '0 8px 40px rgba(0,0,0,0.35)' }}>
        {leyenda && <p className="text-[11px] text-amber-300 print:hidden">{leyenda}</p>}
        <div ref={hoja} className={(marca ? 'hoja-marca ' : '') + 'hoja-pag relative mx-auto max-w-[840px] overflow-hidden'} style={{ ...(marca ? {} : { fontFamily: 'var(--font-archivo)' }), backgroundImage: `linear-gradient(to bottom, #fff 0, #fff ${pag.P}px, transparent ${pag.P}px)`, backgroundSize: `100% ${pag.P + GAP}px`, backgroundRepeat: 'repeat-y' }}>
          <style>{`@media print{.hoja-pag{background:none !important;height:auto !important}.hoja-pag [data-pg]{margin-top:0 !important}}`}</style>
          {marca && Array.from({ length: pag.n }, (_, k) => {
            const y = k * (pag.P + GAP)
            const extra = k > 0 ? ' print:hidden' : ''
            return (
              <div key={k} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marca/curva.png" alt="" className={'marca-curva' + extra} style={{ top: y }} />
                <span className={'marca-logo-texto' + extra} style={{ top: y + 15 }}>ArchiTechIA</span>
                <div className="marca-pie-pag print:hidden" style={{ top: y + pag.P - 42 }} />
              </div>
            )
          })}
          {Array.from({ length: pag.n }, (_, k) => (
            <span key={k} aria-hidden className="absolute z-20 print:hidden pointer-events-none select-none" style={{ top: k * (pag.P + GAP) + pag.P - 24, right: 20, fontSize: 10, color: '#94a3b8' }}>Página {k + 1} de {pag.n}</span>))}
          {puedeEditar && !soloLectura && marcas.map(m => (
            <button key={m.i} type="button" onClick={() => setIa({ tipo: 'seccion', i: m.i, titulo: m.titulo, n: m.i + 1 })} title={`Trabajar «${m.titulo}» con el Agente Documentador`} aria-label={`Trabajar «${m.titulo}» con el Agente Documentador`}
              className="absolute z-10 print:hidden w-6 h-6 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white flex items-center justify-center shadow transition-colors" style={{ right: 16, top: m.top + 4 }}><Sparkles size={13} /></button>))}
          <div className={marca ? 'relative px-10 sm:px-16 pt-[76px] pb-8' : 'px-10 sm:px-16 py-12'}>
            <RichTextField readOnly={soloLectura} value={valor} onChange={onCambio} placeholder="Escribe aquí el documento." className="doc-rico text-gray-700 text-[14px] leading-relaxed focus:outline-none min-h-[60vh]" />
          </div>
        </div>
      </div>
    </div>
  )
}
