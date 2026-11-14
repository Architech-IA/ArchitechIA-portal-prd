'use client'

import { useEffect, useRef } from 'react'
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react'
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
    </div>
  )
}

