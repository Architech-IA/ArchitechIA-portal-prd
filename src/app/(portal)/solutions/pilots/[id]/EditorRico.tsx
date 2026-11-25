'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, Table2, Baseline } from 'lucide-react'
import { sanitizarHtml } from './sanitizar'

// Editor de texto enriquecido compartido: lo usan el PRD, el diseño y el plan del hub y los documentos de las fases del proyecto.

// Campo de texto enriquecido (bold/italic/underline/alineacion/tamaño) via
// contentEditable + document.execCommand. Es una API deprecada en el spec
// pero sigue soportada en todos los navegadores evergreen para este set
// acotado de comandos — se prefiere sobre sumar una libreria de editor
// completa (Tiptap) solo para este toolbar chico. Definido a nivel de
// modulo por la misma razon que AutoTextarea: si se redefine en cada
// render, React lo remonta en cada tecla y se pierde el foco/cursor.
export function RichTextField({ value, onChange, placeholder, className, readOnly }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; readOnly?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  // null a proposito (nunca un string) para poder distinguir "todavia no se
  // pinto nada" del primer valor real. Con `useRef(value)` el primer render
  // comparaba el valor contra si mismo y nunca pintaba nada — se notaba en
  // filas que nacen YA con contenido (ej. un requisito que la IA genera de
  // cero): el campo quedaba con el placeholder aunque el dato si habia
  // llegado, porque el componente se monta por primera vez con ese valor.
  const lastPushed = useRef<string | null>(null)
  const arrastre = useRef<Arrastre | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Primer render: siempre pintar el valor inicial, tenga contenido o no.
    // Despues: solo sincroniza si el cambio vino de afuera (ej. "Generar con
    // IA") — nunca mientras el usuario esta escribiendo, o el cursor
    // saltaria al principio del campo en cada tecla.
    if (lastPushed.current === null || (value !== lastPushed.current && el.innerHTML !== value)) {
      el.innerHTML = sanitizarHtml(value)
    }
    lastPushed.current = value
  }, [value])
  return (
    <div
      ref={ref}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onMouseMove={e => {
        const el = ref.current
        if (readOnly || !el || arrastre.current) return
        const b = bordeBajoCursor(e, el)
        el.style.cursor = b ? (b.tipo === 'col' ? 'col-resize' : 'row-resize') : filaBajoCursor(e, el) ? CURSOR_FILA : ''
      }}
      onMouseLeave={() => { if (ref.current && !arrastre.current) ref.current.style.cursor = '' }}
      onMouseDown={e => {
        const el = ref.current
        if (readOnly || !el || e.button !== 0) return
        limpiarColumna()
        const b = bordeBajoCursor(e, el)
        if (!b) {
          const fila0 = filaBajoCursor(e, el)
          if (!fila0) { iniciarSeleccionColumna(e, el); return }
          e.preventDefault()
          el.focus()
          const tabla = fila0.closest('table') as HTMLTableElement
          const ini = fila0.rowIndex
          seleccionarFilas(tabla, ini, ini)
          const mover = (ev: MouseEvent) => {
            for (const tr of Array.from(tabla.rows)) {
              const q = tr.getBoundingClientRect()
              if (ev.clientY >= q.top && ev.clientY <= q.bottom) { seleccionarFilas(tabla, ini, tr.rowIndex); break }
            }
          }
          const soltar = () => { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar) }
          window.addEventListener('mousemove', mover)
          window.addEventListener('mouseup', soltar)
          return
        }
        e.preventDefault()
        const tabla = b.celda.closest('table') as HTMLTableElement
        if (b.tipo === 'col') {
          const total = tabla.getBoundingClientRect().width
          const anchos = Array.from(tabla.rows[0].cells).map(c => (c.getBoundingClientRect().width / total) * 100)
          tabla.style.tableLayout = 'fixed'
          aplicarAnchos(tabla, anchos)
          arrastre.current = { tipo: 'col', tabla, idx: b.idx, x0: e.clientX, anchos, total }
        } else {
          const tr = b.celda.parentElement as HTMLTableRowElement
          arrastre.current = { tipo: 'fila', tr, y0: e.clientY, h0: tr.getBoundingClientRect().height }
        }
        const antes = { cursor: document.body.style.cursor, sel: document.body.style.userSelect }
        document.body.style.cursor = b.tipo === 'col' ? 'col-resize' : 'row-resize'
        document.body.style.userSelect = 'none'
        const mover = (ev: MouseEvent) => { if (arrastre.current) moverArrastre(arrastre.current, ev) }
        const soltar = () => {
          window.removeEventListener('mousemove', mover)
          window.removeEventListener('mouseup', soltar)
          document.body.style.cursor = antes.cursor
          document.body.style.userSelect = antes.sel
          arrastre.current = null
          el.style.cursor = ''
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }
        window.addEventListener('mousemove', mover)
        window.addEventListener('mouseup', soltar)
      }}
      onInput={() => {
        if (!aplicandoColumna) limpiarColumna()
        const html = limpiarPaginacion(ref.current?.innerHTML ?? '')
        lastPushed.current = html
        onChange(html)
      }}
      onKeyDown={e => {
        if (e.key !== 'Tab' || readOnly) return
        const c = celdaActual()
        if (!c || !ref.current?.contains(c)) return
        e.preventDefault()
        const celdas = Array.from(c.closest('table')?.querySelectorAll('th,td') ?? []) as HTMLElement[]
        const i = celdas.indexOf(c)
        const sig = e.shiftKey ? celdas[i - 1] : celdas[i + 1]
        if (sig) { ponerCursor(sig); return }
        if (!e.shiftKey) { tablaCmd('filaAbajo'); const nuevas = Array.from(c.closest('table')?.querySelectorAll('th,td') ?? []) as HTMLElement[]; if (nuevas[i + 1]) ponerCursor(nuevas[i + 1]) }
      }}
      data-placeholder={placeholder}
      className={`${className} empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400`}
    />
  )
}

// ── Redimensionar tablas arrastrando los bordes de las celdas ──────────────────────────────────────
// Columnas: el borde entre dos columnas reparte el ancho entre ambas (el total de la tabla no cambia) y se guarda en % en cada celda.
// Filas: el borde inferior de la fila cambia su alto mínimo (px). La primera vez que se arrastra, la tabla pasa a table-layout:fixed
// con los anchos actuales, para que lo que se ve sea lo que se guarda.
type Arrastre =
  | { tipo: 'col'; tabla: HTMLTableElement; idx: number; x0: number; anchos: number[]; total: number }
  | { tipo: 'fila'; tr: HTMLTableRowElement; y0: number; h0: number }
const MARGEN_BORDE = 4
// Seleccionar filas: clic en el borde izquierdo de la tabla (o en el margen justo a su izquierda); arrastrar hacia abajo suma filas
const CURSOR_FILA = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'><path d='M16 4 L5 9 L9 11 L11 15 Z' fill='white' stroke='black' stroke-width='1.2' stroke-linejoin='round'/></svg>\") 16 4, pointer"
// Seleccionar una columna: al arrastrar hacia abajo dentro de una celda, solo se marcan las celdas de esa columna (no las vecinas).
let rangosColumna: Range[] = []
let aplicandoColumna = false
function resaltadoColumna(): { set: (n: string, h: unknown) => void; delete: (n: string) => void } | null {
  const h = (typeof CSS !== 'undefined' ? (CSS as unknown as { highlights?: { set: (n: string, h: unknown) => void; delete: (n: string) => void } }).highlights : undefined)
  return h ?? null
}
function limpiarColumna() {
  if (rangosColumna.length === 0) return
  rangosColumna = []
  resaltadoColumna()?.delete('col-sel')
}
function marcarColumna(tabla: HTMLTableElement, col: number, a: number, b: number) {
  const [i, j] = a <= b ? [a, b] : [b, a]
  const rangos: Range[] = []
  for (let r = i; r <= j; r++) {
    const celda = tabla.rows[r]?.cells[col]
    if (!celda) continue
    const rg = document.createRange()
    rg.selectNodeContents(celda)
    rangos.push(rg)
  }
  rangosColumna = rangos
  const Resaltado = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight
  if (Resaltado) resaltadoColumna()?.set('col-sel', new Resaltado(...rangos))
}
function iniciarSeleccionColumna(e: { target: EventTarget | null }, raiz: HTMLElement) {
  const celda = (e.target as HTMLElement | null)?.closest?.('td,th') as HTMLTableCellElement | null
  if (!celda || !raiz.contains(celda)) return
  if (!document.getElementById('estilo-col-sel')) {
    const st = document.createElement('style')
    st.id = 'estilo-col-sel'
    st.textContent = '::highlight(col-sel){background-color:rgba(59,130,246,0.45);color:inherit}'
    document.head.appendChild(st)
  }
  const tabla = celda.closest('table') as HTMLTableElement
  const fila0 = (celda.parentElement as HTMLTableRowElement).rowIndex
  const col = celda.cellIndex
  let activa = false
  const noSel = (ev: Event) => ev.preventDefault()
  const mover = (ev: MouseEvent) => {
    const t = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest?.('td,th') as HTMLTableCellElement | null
    if (!t || t.closest('table') !== tabla) return
    const fila1 = (t.parentElement as HTMLTableRowElement).rowIndex
    if (!activa && fila1 === fila0) return
    if (!activa) { activa = true; document.addEventListener('selectstart', noSel) }
    window.getSelection()?.removeAllRanges()
    marcarColumna(tabla, col, fila0, fila1)
  }
  const soltar = () => {
    window.removeEventListener('mousemove', mover)
    window.removeEventListener('mouseup', soltar)
    document.removeEventListener('selectstart', noSel)
  }
  window.addEventListener('mousemove', mover)
  window.addEventListener('mouseup', soltar)
}
function filaBajoCursor(e: { clientX: number; clientY: number }, raiz: HTMLElement): HTMLTableRowElement | null {
  for (const t of Array.from(raiz.querySelectorAll('table'))) {
    const r = t.getBoundingClientRect()
    if (e.clientX < r.left - 18 || e.clientX > r.left + 8) continue
    for (const tr of Array.from(t.rows)) {
      const q = tr.getBoundingClientRect()
      if (e.clientY >= q.top && e.clientY <= q.bottom) return tr
    }
  }
  return null
}
function seleccionarFilas(tabla: HTMLTableElement, a: number, b: number) {
  const [i, j] = a <= b ? [a, b] : [b, a]
  const ini = tabla.rows[i].cells[0]
  const ultima = tabla.rows[j].cells
  const fin = ultima[ultima.length - 1]
  const rg = document.createRange()
  rg.setStart(ini, 0)
  rg.setEnd(fin, fin.childNodes.length)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(rg)
}
const ANCHO_MIN = 4
function bordeBajoCursor(e: { target: EventTarget | null; clientX: number; clientY: number }, raiz: HTMLElement): { tipo: 'col'; celda: HTMLTableCellElement; idx: number } | { tipo: 'fila'; celda: HTMLTableCellElement } | null {
  const celda = (e.target as HTMLElement | null)?.closest?.('td,th') as HTMLTableCellElement | null
  if (!celda || !raiz.contains(celda)) return null
  const r = celda.getBoundingClientRect()
  if (e.clientX >= r.right - MARGEN_BORDE && celda.nextElementSibling) return { tipo: 'col', celda, idx: celda.cellIndex }
  if (e.clientX <= r.left + MARGEN_BORDE && celda.previousElementSibling) return { tipo: 'col', celda, idx: celda.cellIndex - 1 }
  if (e.clientY >= r.bottom - MARGEN_BORDE) return { tipo: 'fila', celda }
  return null
}
function aplicarAnchos(tabla: HTMLTableElement, anchos: number[]) {
  for (const fila of Array.from(tabla.rows)) {
    if (fila.cells.length !== anchos.length) continue // filas con celdas combinadas: se dejan como están
    for (let i = 0; i < anchos.length; i++) fila.cells[i].style.width = anchos[i].toFixed(2) + '%'
  }
}
function moverArrastre(a: Arrastre, ev: MouseEvent) {
  if (a.tipo === 'col') {
    const delta = Math.min(Math.max(((ev.clientX - a.x0) / a.total) * 100, ANCHO_MIN - a.anchos[a.idx]), a.anchos[a.idx + 1] - ANCHO_MIN)
    const nuevos = a.anchos.slice()
    nuevos[a.idx] = a.anchos[a.idx] + delta
    nuevos[a.idx + 1] = a.anchos[a.idx + 1] - delta
    aplicarAnchos(a.tabla, nuevos)
  } else {
    a.tr.style.height = Math.max(24, a.h0 + (ev.clientY - a.y0)).toFixed(0) + 'px'
  }
}

/** Quita las marcas temporales de paginación (margen superior + data-pg) para que no se guarden en el documento. */
export function limpiarPaginacion(html: string): string {
  if (!html.includes('data-pg')) return html
  const t = document.createElement('template')
  t.innerHTML = html
  t.content.querySelectorAll('[data-pg]').forEach(n => {
    n.removeAttribute('data-pg')
    const el = n as HTMLElement
    el.style.removeProperty('margin-top')
    if (!(el.getAttribute('style') ?? '').trim()) el.removeAttribute('style')
  })
  return t.innerHTML
}

// document.execCommand actua sobre la seleccion activa del documento, sin
// importar cual RichTextField la contiene — por eso un solo toolbar
// compartido alcanza, no hace falta uno por campo.
export function execCmd(cmd: string, value?: string) {
  if (rangosColumna.length > 0 && rangosColumna.every(r => r.startContainer.isConnected)) {
    const copia = rangosColumna.slice()
    const sel = window.getSelection()
    aplicandoColumna = true
    try {
      for (const r of copia) { sel?.removeAllRanges(); sel?.addRange(r); document.execCommand(cmd, false, value) }
    } finally { aplicandoColumna = false }
    return
  }
  document.execCommand(cmd, false, value)
}
function celdaActual(): HTMLTableCellElement | null {
  let n: Node | null = window.getSelection()?.anchorNode ?? null
  while (n && !(n instanceof HTMLElement && (n.tagName === 'TD' || n.tagName === 'TH'))) n = n.parentNode
  return n as HTMLTableCellElement | null
}
function ponerCursor(el: HTMLElement) {
  const r = document.createRange()
  r.selectNodeContents(el)
  r.collapse(true)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(r)
}
const celdaVacia = (tag: string) => { const c = document.createElement(tag); c.innerHTML = '<br>'; return c }

export type AccionTabla = 'insertar' | 'filaArriba' | 'filaAbajo' | 'colIzq' | 'colDer' | 'delFila' | 'delCol' | 'delTabla'
export function tablaCmd(a: AccionTabla) {
  if (a === 'insertar') {
    const fila = (t: string) => `<tr>${[1, 2, 3].map(() => `<${t}><br></${t}>`).join('')}</tr>`
    execCmd('insertHTML', `<table><thead>${fila('th')}</thead><tbody>${fila('td')}${fila('td')}</tbody></table><p><br></p>`)
    return
  }
  const c = celdaActual()
  const tr = c?.parentElement as HTMLTableRowElement | null
  const tabla = c?.closest('table') ?? null
  const raiz = c?.closest('[contenteditable="true"]') ?? null
  if (!c || !tr || !tabla || !raiz) return
  const idx = c.cellIndex
  if (a === 'filaArriba' || a === 'filaAbajo') {
    const nueva = document.createElement('tr')
    for (let i = 0; i < tr.cells.length; i++) nueva.appendChild(celdaVacia(a === 'filaAbajo' && tr.parentElement?.tagName === 'THEAD' ? 'td' : tr.cells[i].tagName.toLowerCase()))
    if (a === 'filaAbajo' && tr.parentElement?.tagName === 'THEAD') {
      let cuerpo = tabla.tBodies[0]
      if (!cuerpo) cuerpo = tabla.appendChild(document.createElement('tbody'))
      cuerpo.insertBefore(nueva, cuerpo.firstChild)
    } else tr.parentElement?.insertBefore(nueva, a === 'filaAbajo' ? tr.nextSibling : tr)
  } else if (a === 'colIzq' || a === 'colDer') {
    Array.from(tabla.rows).forEach(r => {
      const ref = r.cells[idx] ?? r.cells[r.cells.length - 1]
      if (ref) r.insertBefore(celdaVacia(ref.tagName.toLowerCase()), a === 'colDer' ? ref.nextSibling : ref)
    })
  } else if (a === 'delFila') {
    if (tabla.rows.length <= 1) tabla.remove(); else tr.remove()
  } else if (a === 'delCol') {
    if (tr.cells.length <= 1) tabla.remove(); else Array.from(tabla.rows).forEach(r => r.cells[idx]?.remove())
  } else if (a === 'delTabla') tabla.remove()
  raiz.dispatchEvent(new Event('input', { bubbles: true }))
}

const COLORES_TEXTO: { c: string; n: string }[] = [
  { c: '#1a1a1a', n: 'Negro (por defecto)' }, { c: '#1b2845', n: 'Azul marino' }, { c: '#e84b1a', n: 'Naranja ArchiTechIA' }, { c: '#f97316', n: 'Naranja claro' },
  { c: '#dc2626', n: 'Rojo' }, { c: '#16a34a', n: 'Verde' }, { c: '#2563eb', n: 'Azul' }, { c: '#7c3aed', n: 'Violeta' },
  { c: '#64748b', n: 'Gris' }, { c: '#0f766e', n: 'Verde azulado' }, { c: '#b45309', n: 'Ámbar' }, { c: '#be185d', n: 'Rosa' },
]

function MenuColor({ btnCls }: { btnCls: string }) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [actual, setActual] = useState('#e84b1a')
  const boton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!abierto) return
    const cerrar = () => setAbierto(false)
    window.addEventListener('scroll', cerrar, true)
    return () => window.removeEventListener('scroll', cerrar, true)
  }, [abierto])
  return (
    <div className="relative">
      <button type="button" title="Color del texto" aria-haspopup="menu" aria-expanded={abierto} ref={boton}
        onMouseDown={e => { e.preventDefault(); const r = boton.current?.getBoundingClientRect(); if (r) setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - 176)), y: r.bottom + 6 }); setAbierto(o => !o) }} className={btnCls}>
        <span className="flex flex-col items-center leading-none"><Baseline size={13} /><span style={{ width: 12, height: 2.5, background: actual, borderRadius: 1, marginTop: 1 }} /></span>
      </button>
      {abierto && typeof document !== 'undefined' && createPortal(
        <>
        <div className="fixed inset-0 z-[998]" onMouseDown={e => { e.preventDefault(); setAbierto(false) }} />
        <div role="menu" style={{ position: 'fixed', left: pos.x, top: pos.y }} className="menu-editor menu-color z-[999] w-40">
          <style>{`.menu-editor{background:#141a24;border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:4px 0;box-shadow:0 12px 32px rgba(0,0,0,0.55);backdrop-filter:none}
.menu-editor button.mi{border:0 !important;background:transparent;box-shadow:none}
.menu-editor.menu-color{padding:8px}
.menu-editor button.mi:hover{background:rgba(255,255,255,0.09)}
.menu-editor .sep{height:1px;margin:4px 0;background:rgba(255,255,255,0.1);border:0}
.menu-editor .rotulo{padding:4px 12px 2px;font-size:10px;color:#9aa6b8}`}</style>
          <p className="rotulo !px-0 mb-1.5">Color del texto seleccionado</p>
          <div className="grid grid-cols-4 gap-1.5">
            {COLORES_TEXTO.map(k => (
              <button key={k.c} type="button" title={k.n} aria-label={k.n} onMouseDown={e => { e.preventDefault(); execCmd('foreColor', k.c); setActual(k.c); setAbierto(false) }}
                className="w-7 h-7 rounded-md border border-white/20 hover:scale-110 transition-transform" style={{ background: k.c }} />
            ))}
          </div>
        </div></>, document.body)}
    </div>
  )
}

function MenuTabla({ btnCls }: { btnCls: string }) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const boton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!abierto) return
    const cerrar = () => setAbierto(false)
    window.addEventListener('scroll', cerrar, true)
    return () => window.removeEventListener('scroll', cerrar, true)
  }, [abierto])
  const item = (txt: string, a: AccionTabla, peligro = false) => (
    <button key={a} type="button" onMouseDown={e => { e.preventDefault(); tablaCmd(a); setAbierto(false) }}
      className={`mi w-full text-left px-3 py-1.5 text-[12px] ${peligro ? 'text-red-300' : 'text-gray-100'}`}>{txt}</button>
  )
  return (
    <div className="relative">
      <button type="button" title="Tablas: insertar y editar filas y columnas" aria-haspopup="menu" aria-expanded={abierto} ref={boton} onMouseDown={e => { e.preventDefault(); const r = boton.current?.getBoundingClientRect(); if (r) setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - 216)), y: r.bottom + 6 }); setAbierto(o => !o) }} className={btnCls}><Table2 size={13} /></button>
      {abierto && typeof document !== 'undefined' && createPortal(
        <>
        <div className="fixed inset-0 z-[998]" onMouseDown={e => { e.preventDefault(); setAbierto(false) }} />
        <div role="menu" style={{ position: 'fixed', left: pos.x, top: pos.y }} className="menu-editor z-[999] w-52">
          <style>{`.menu-editor{background:#141a24;border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:4px 0;box-shadow:0 12px 32px rgba(0,0,0,0.55);backdrop-filter:none}
.menu-editor button.mi{border:0 !important;background:transparent;box-shadow:none}
.menu-editor.menu-color{padding:8px}
.menu-editor button.mi:hover{background:rgba(255,255,255,0.09)}
.menu-editor .sep{height:1px;margin:4px 0;background:rgba(255,255,255,0.1);border:0}
.menu-editor .rotulo{padding:4px 12px 2px;font-size:10px;color:#9aa6b8}`}</style>
          {item('Insertar tabla (3 × 3)', 'insertar')}
          <div className="sep" />
          <p className="rotulo">Con el cursor dentro de una celda</p>
          {item('Fila arriba', 'filaArriba')}{item('Fila abajo', 'filaAbajo')}
          {item('Columna a la izquierda', 'colIzq')}{item('Columna a la derecha', 'colDer')}
          <div className="sep" />
          {item('Eliminar fila', 'delFila', true)}{item('Eliminar columna', 'delCol', true)}{item('Eliminar tabla', 'delTabla', true)}
        </div></>, document.body)}
    </div>
  )
}

function stepFontSize(delta: number) {
  if (rangosColumna.length > 0) { const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(rangosColumna[0]) }
  const current = Number(document.queryCommandValue('fontSize')) || 3
  execCmd('fontSize', String(Math.min(7, Math.max(1, current + delta))))
}

export function RichToolbar() {
  const btnCls = "w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
  // onMouseDown + preventDefault (no onClick): un click normal le saca el
  // foco/seleccion al contentEditable ANTES de que el handler corra,
  // dejando a execCommand sin nada sobre que actuar.
  const on = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn() }
  return (
    <div className="flex items-center gap-0.5 bg-gray-900 border border-gray-700 rounded-lg p-1 print:hidden">
      <button type="button" title="Negrita" onMouseDown={on(() => execCmd('bold'))} className={btnCls}><Bold size={13} /></button>
      <button type="button" title="Cursiva" onMouseDown={on(() => execCmd('italic'))} className={btnCls}><Italic size={13} /></button>
      <button type="button" title="Subrayado" onMouseDown={on(() => execCmd('underline'))} className={btnCls}><Underline size={13} /></button>
      <MenuColor btnCls={btnCls} />
      <div className="w-px h-4 bg-gray-700 mx-0.5" />
      <button type="button" title="Alinear izquierda" onMouseDown={on(() => execCmd('justifyLeft'))} className={btnCls}><AlignLeft size={13} /></button>
      <button type="button" title="Centrar" onMouseDown={on(() => execCmd('justifyCenter'))} className={btnCls}><AlignCenter size={13} /></button>
      <button type="button" title="Alinear derecha" onMouseDown={on(() => execCmd('justifyRight'))} className={btnCls}><AlignRight size={13} /></button>
      <button type="button" title="Justificar" onMouseDown={on(() => execCmd('justifyFull'))} className={btnCls}><AlignJustify size={13} /></button>
      <div className="w-px h-4 bg-gray-700 mx-0.5" />
      <button type="button" title="Aumentar tamaño" onMouseDown={on(() => stepFontSize(1))} className={btnCls + ' text-[11px] font-bold w-auto px-1.5'}>A+</button>
      <button type="button" title="Disminuir tamaño" onMouseDown={on(() => stepFontSize(-1))} className={btnCls + ' text-[11px] font-bold w-auto px-1.5'}>A-</button>
      <div className="w-px h-4 bg-gray-700 mx-0.5" />
      <MenuTabla btnCls={btnCls} />
    </div>
  )
}

