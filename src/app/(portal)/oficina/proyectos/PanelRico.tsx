'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Printer, Save, Loader2, Sparkles } from 'lucide-react'
import PanelIADoc from './PanelIADoc'
import { RichTextField, RichToolbar } from '../../solutions/pilots/[id]/EditorRico'
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
function imprimir(titulo: string, html: string) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font-family:'Segoe UI',Calibri,Arial,sans-serif;color:#1f2937;line-height:1.7;max-width:820px;margin:32px auto;padding:0 24px}${CSS_HOJA}</style></head><body>${sanitizarHtml(html)}</body></html>`)
  w.document.close(); w.focus()
  setTimeout(() => w.print(), 300)
}

export default function PanelRico({ proyectoId, fase, clave, valor, onCambio, soloLectura, puedeEditar, sucio, guardando, onGuardar, titulo, leyenda }: {
  proyectoId: string; fase: string; clave: string; valor: string; onCambio: (html: string) => void; soloLectura: boolean; puedeEditar: boolean; sucio: boolean; guardando: boolean
  onGuardar: () => void; titulo: string; leyenda?: string
}) {
  const hoja = useRef<HTMLDivElement>(null)
  const [marcas, setMarcas] = useState<{ i: number; titulo: string; nivel: number; top: number }[]>([])
  const [ia, setIa] = useState<{ tipo: 'seccion' | 'documento'; i?: number; titulo: string; n?: number } | null>(null)
  const editable = () => hoja.current?.querySelector('.doc-rico') as HTMLElement | null

  // los destellos de IA se colocan junto a cada título de sección (## y ###) y siguen al texto mientras se edita
  const medir = useCallback(() => {
    const ed = hoja.current?.querySelector('.doc-rico') as HTMLElement | null
    const h0 = hoja.current
    if (!ed || !h0) return
    const base = h0.getBoundingClientRect().top
    const lista = Array.from(ed.querySelectorAll('h2,h3')).map((h, i) => ({ i, titulo: (h.textContent || '').trim(), nivel: Number(h.tagName[1]), top: Math.round(h.getBoundingClientRect().top - base) }))
    setMarcas(prev => (JSON.stringify(prev) === JSON.stringify(lista) ? prev : lista))
  }, [])
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
      <style>{`.doc-rico h1{font-size:28px;line-height:1.25;font-weight:800;margin:.3em 0 .5em;color:#111827}
.doc-rico h2{font-size:21px;font-weight:700;margin:1.5em 0 .5em;padding-bottom:.3em;border-bottom:1px solid #e5e7eb;color:#111827}
.doc-rico h3{font-size:17px;font-weight:700;margin:1.2em 0 .3em;color:#111827}
.doc-rico p{margin:.5em 0}.doc-rico ul{list-style:disc;padding-left:1.5rem;margin:.5em 0}.doc-rico ol{list-style:decimal;padding-left:1.5rem;margin:.5em 0}
.doc-rico blockquote{border-left:3px solid #94a3b8;margin:.8em 0;padding:.1em 1em;color:#475569}
.doc-rico code{background:#f1f5f9;border-radius:4px;padding:.1em .35em;font-size:.9em}
.doc-rico hr{border:0;border-top:1px solid #cbd5e1;margin:1.4em 0}.doc-rico a{color:#2563eb;text-decoration:underline}
.doc-rico table{border-collapse:collapse;width:100%;margin:.9em 0}.doc-rico th,.doc-rico td{border:1px solid #cbd5e1;padding:6px 10px;vertical-align:top;text-align:left}.doc-rico th{background:#f1f5f9;font-weight:700}`}</style>
      <div className="rounded-2xl p-4 space-y-4 mx-auto max-w-[1180px]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(18px)', boxShadow: '0 8px 40px rgba(0,0,0,0.35)' }}>
        <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-[11px] flex items-center gap-1 ${sucio ? 'text-orange-400' : 'text-gray-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sucio ? 'bg-orange-400' : 'bg-gray-600'}`} />
              {sucio ? 'Cambios sin guardar' : 'Guardado'}
            </span>
            {leyenda && <span className="text-[11px] text-amber-300">{leyenda}</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!soloLectura && <RichToolbar />}
            <button type="button" onClick={() => imprimir(titulo, valor)} title="Imprimir / Exportar a PDF" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-medium transition-colors">
              <Printer size={12} /> Imprimir / PDF
            </button>
            {puedeEditar && (
              <>
                <button type="button" onClick={() => setIa({ tipo: 'documento', titulo })} title="Trabajar el documento completo con el Agente Documentador: generar con preguntas o mejorarlo" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-cyan-300 text-xs font-medium transition-colors">
                  <Sparkles size={12} /> Agente Documentador
                </button>
                <button type="button" onClick={onGuardar} disabled={!sucio || guardando} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 disabled:opacity-60 text-white text-xs font-semibold transition-colors">
                  {guardando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </>)}
          </div>
        </div>
        <div ref={hoja} className="relative bg-white rounded-sm shadow-2xl mx-auto max-w-[840px]" style={{ fontFamily: 'var(--font-archivo)' }}>
          {puedeEditar && !soloLectura && marcas.map(m => (
            <button key={m.i} type="button" onClick={() => setIa({ tipo: 'seccion', i: m.i, titulo: m.titulo, n: m.i + 1 })} title={`Trabajar «${m.titulo}» con el Agente Documentador`} aria-label={`Trabajar «${m.titulo}» con el Agente Documentador`}
              className="absolute print:hidden w-6 h-6 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white flex items-center justify-center shadow transition-colors" style={{ right: 16, top: m.top + 4 }}><Sparkles size={13} /></button>))}
          <div className="px-10 sm:px-16 py-12">
            <RichTextField readOnly={soloLectura} value={valor} onChange={onCambio} placeholder="Escribe aquí el documento." className="doc-rico text-gray-700 text-[14px] leading-relaxed focus:outline-none min-h-[60vh]" />
          </div>
        </div>
      </div>
    </div>
  )
}
