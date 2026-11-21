'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, Table2 } from 'lucide-react'
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
      onInput={() => {
        const html = ref.current?.innerHTML ?? ''
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

// document.execCommand actua sobre la seleccion activa del documento, sin
// importar cual RichTextField la contiene — por eso un solo toolbar
// compartido alcanza, no hace falta uno por campo.
export function execCmd(cmd: string, value?: string) {
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
      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-800 ${peligro ? 'text-red-300' : 'text-gray-100'}`}>{txt}</button>
  )
  return (
    <div className="relative">
      <button type="button" title="Tablas: insertar y editar filas y columnas" aria-haspopup="menu" aria-expanded={abierto} ref={boton} onMouseDown={e => { e.preventDefault(); const r = boton.current?.getBoundingClientRect(); if (r) setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - 216)), y: r.bottom + 6 }); setAbierto(o => !o) }} className={btnCls}><Table2 size={13} /></button>
      {abierto && typeof document !== 'undefined' && createPortal(
        <>
        <div className="fixed inset-0 z-[998]" onMouseDown={e => { e.preventDefault(); setAbierto(false) }} />
        <div role="menu" style={{ position: 'fixed', left: pos.x, top: pos.y }} className="z-[999] w-52 rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl">
          {item('Insertar tabla (3 × 3)', 'insertar')}
          <div className="my-1 border-t border-gray-700" />
          <p className="px-3 py-0.5 text-[10px] text-gray-500">Con el cursor dentro de una celda</p>
          {item('Fila arriba', 'filaArriba')}{item('Fila abajo', 'filaAbajo')}
          {item('Columna a la izquierda', 'colIzq')}{item('Columna a la derecha', 'colDer')}
          <div className="my-1 border-t border-gray-700" />
          {item('Eliminar fila', 'delFila', true)}{item('Eliminar columna', 'delCol', true)}{item('Eliminar tabla', 'delTabla', true)}
        </div></>, document.body)}
    </div>
  )
}

function stepFontSize(delta: number) {
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

