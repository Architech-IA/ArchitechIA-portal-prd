'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon,
  Heading2, Heading3, List, ListOrdered,
  Eye, Pencil, Eraser,
} from 'lucide-react'

interface RichNotesProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolBtn({
  onClick, active, title, children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-orange-500/20 text-orange-400'
          : 'text-gray-400 hover:text-white hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-gray-700 mx-0.5 self-center" />
}

export default function RichNotes({ value, onChange, placeholder }: RichNotesProps) {
  const [viewMode, setViewMode] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder ?? 'Escribe aquí las notas de la fase...',
      }),
    ],
    content: value || '',
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'rich-notes-editor focus:outline-none min-h-[140px] text-sm text-white leading-relaxed',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  const isEmpty = (html: string) =>
    !html || html === '<p></p>' || html.trim() === ''

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-700 bg-gray-800/80 flex-wrap">
        {!viewMode && (
          <>
            <ToolBtn
              title="Negrita (Ctrl+B)"
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
            >
              <Bold size={13} />
            </ToolBtn>
            <ToolBtn
              title="Cursiva (Ctrl+I)"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
            >
              <Italic size={13} />
            </ToolBtn>
            <ToolBtn
              title="Subrayado (Ctrl+U)"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              active={editor.isActive('underline')}
            >
              <UnderlineIcon size={13} />
            </ToolBtn>

            <Sep />

            <ToolBtn
              title="Título H2"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive('heading', { level: 2 })}
            >
              <Heading2 size={13} />
            </ToolBtn>
            <ToolBtn
              title="Título H3"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor.isActive('heading', { level: 3 })}
            >
              <Heading3 size={13} />
            </ToolBtn>

            <Sep />

            <ToolBtn
              title="Lista con viñetas"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')}
            >
              <List size={13} />
            </ToolBtn>
            <ToolBtn
              title="Lista numerada"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive('orderedList')}
            >
              <ListOrdered size={13} />
            </ToolBtn>

            <Sep />

            <ToolBtn
              title="Limpiar formato"
              onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            >
              <Eraser size={13} />
            </ToolBtn>

            <Sep />
          </>
        )}

        <ToolBtn
          title={viewMode ? 'Modo edición' : 'Modo vista'}
          onClick={() => setViewMode(v => !v)}
          active={viewMode}
        >
          {viewMode ? <Pencil size={13} /> : <Eye size={13} />}
        </ToolBtn>

        {viewMode && (
          <span className="text-[10px] text-gray-500 ml-1">Vista previa</span>
        )}
      </div>

      {/* Content area */}
      <div className="px-4 py-3">
        {viewMode ? (
          <div
            className={`rich-notes-view text-sm leading-relaxed min-h-[120px] ${
              isEmpty(value)
                ? 'text-gray-600 italic'
                : 'text-gray-100'
            }`}
            dangerouslySetInnerHTML={{
              __html: isEmpty(value)
                ? (placeholder ?? 'Sin notas aún.')
                : value,
            }}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>

      <style>{`
        .rich-notes-editor p { margin: 0 0 0.5rem; }
        .rich-notes-editor p:last-child { margin-bottom: 0; }
        .rich-notes-editor h2 { font-size: 1rem; font-weight: 600; color: #f3f4f6; margin: 0.75rem 0 0.375rem; }
        .rich-notes-editor h3 { font-size: 0.875rem; font-weight: 600; color: #d1d5db; margin: 0.5rem 0 0.25rem; }
        .rich-notes-editor ul { list-style: disc; padding-left: 1.25rem; margin: 0.375rem 0; }
        .rich-notes-editor ol { list-style: decimal; padding-left: 1.25rem; margin: 0.375rem 0; }
        .rich-notes-editor li { margin: 0.125rem 0; }
        .rich-notes-editor strong { color: #f9fafb; }
        .rich-notes-editor em { color: #d1d5db; }
        .rich-notes-editor u { text-decoration: underline; text-underline-offset: 2px; }
        .rich-notes-editor .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #4b5563;
          pointer-events: none;
          float: left;
          height: 0;
        }

        .rich-notes-view h2 { font-size: 1rem; font-weight: 600; color: #f3f4f6; margin: 0.75rem 0 0.375rem; }
        .rich-notes-view h3 { font-size: 0.875rem; font-weight: 600; color: #d1d5db; margin: 0.5rem 0 0.25rem; }
        .rich-notes-view p { margin: 0 0 0.5rem; }
        .rich-notes-view p:last-child { margin-bottom: 0; }
        .rich-notes-view ul { list-style: disc; padding-left: 1.25rem; margin: 0.375rem 0; }
        .rich-notes-view ol { list-style: decimal; padding-left: 1.25rem; margin: 0.375rem 0; }
        .rich-notes-view li { margin: 0.125rem 0; }
        .rich-notes-view strong { font-weight: 600; }
        .rich-notes-view em { font-style: italic; }
      `}</style>
    </div>
  )
}
