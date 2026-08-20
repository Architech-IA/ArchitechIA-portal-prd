'use client'

import { useState, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import {
  Plus, X, Eye, Pencil,
  Bold, Italic, Underline as UnderlineIcon,
  Heading2, Heading3, List, ListOrdered, Eraser,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NoteTab { id: string; name: string; content: string }
interface TabbedNotesValue { tabs: NoteTab[] }

function parse(raw: string): NoteTab[] {
  if (!raw) return [defaultTab(1)]
  try {
    const v = JSON.parse(raw) as TabbedNotesValue
    if (v && Array.isArray(v.tabs) && v.tabs.length > 0) return v.tabs
  } catch {}
  return [{ id: uid(), name: 'General', content: raw }]
}

function serialize(tabs: NoteTab[]): string { return JSON.stringify({ tabs }) }
function uid() { return Math.random().toString(36).slice(2, 10) }
function defaultTab(n: number): NoteTab { return { id: uid(), name: `Nota ${n}`, content: '' } }

// ── Font-size helpers ─────────────────────────────────────────────────────────

const FONT_SIZES = ['11px', '13px', '15px', '17px', '20px', '24px', '30px']
const DEFAULT_FS = '15px'

type AnyEditor = ReturnType<typeof useEditor>

function getFontSize(editor: AnyEditor): string {
  return (editor?.getAttributes('textStyle') as { fontSize?: string }).fontSize ?? DEFAULT_FS
}

function stepFontSize(editor: AnyEditor, dir: 1 | -1) {
  if (!editor) return
  const cur = getFontSize(editor)
  const idx = FONT_SIZES.indexOf(cur)
  const base = idx === -1 ? FONT_SIZES.indexOf(DEFAULT_FS) : idx
  const next = FONT_SIZES[Math.max(0, Math.min(FONT_SIZES.length - 1, base + dir))]
  editor.chain().focus().setFontSize(next).run()
}

// ── Toolbar atoms ─────────────────────────────────────────────────────────────

function ToolBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button" title={title} onClick={onClick}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-white hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-gray-700 mx-0.5 self-center" />
}

// ── Single-tab editor ─────────────────────────────────────────────────────────

function TabEditor({ tab, onChange }: { tab: NoteTab; onChange: (html: string) => void }) {
  const [viewMode, setViewMode] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Placeholder.configure({ placeholder: 'Escribí aquí las notas...' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontSize,
    ],
    content: tab.content || '',
    onUpdate({ editor }) { onChange(editor.getHTML()) },
    editorProps: {
      attributes: { class: 'rich-notes-editor focus:outline-none min-h-[360px] text-sm text-white leading-relaxed' },
    },
  }, [tab.id])

  if (!editor) return null

  const empty = (h: string) => !h || h === '<p></p>' || h.trim() === ''
  const curFS = getFontSize(editor)
  const fsIdx = FONT_SIZES.indexOf(curFS)

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-700 flex-wrap">
        {!viewMode && (
          <>
            <ToolBtn title="Negrita" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}><Bold size={13} /></ToolBtn>
            <ToolBtn title="Cursiva" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}><Italic size={13} /></ToolBtn>
            <ToolBtn title="Subrayado" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}><UnderlineIcon size={13} /></ToolBtn>

            <Sep />

            <ToolBtn title="Título H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}><Heading2 size={13} /></ToolBtn>
            <ToolBtn title="Título H3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}><Heading3 size={13} /></ToolBtn>

            <Sep />

            <ToolBtn title="Lista con viñetas" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}><List size={13} /></ToolBtn>
            <ToolBtn title="Lista numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}><ListOrdered size={13} /></ToolBtn>

            <Sep />

            <ToolBtn title="Izquierda" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}><AlignLeft size={13} /></ToolBtn>
            <ToolBtn title="Centrar" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}><AlignCenter size={13} /></ToolBtn>
            <ToolBtn title="Derecha" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}><AlignRight size={13} /></ToolBtn>
            <ToolBtn title="Justificar" onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })}><AlignJustify size={13} /></ToolBtn>

            <Sep />

            {/* Font size */}
            <button
              type="button" title="Reducir tamaño"
              disabled={fsIdx === 0}
              onClick={() => stepFontSize(editor, -1)}
              className="px-1.5 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors leading-none"
              style={{ fontSize: 11, fontWeight: 700 }}
            >
              A-
            </button>
            <span className="text-[10px] text-gray-500 w-6 text-center tabular-nums select-none">
              {parseInt(curFS)}
            </span>
            <button
              type="button" title="Aumentar tamaño"
              disabled={fsIdx === FONT_SIZES.length - 1}
              onClick={() => stepFontSize(editor, 1)}
              className="px-1.5 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors leading-none"
              style={{ fontSize: 13, fontWeight: 700 }}
            >
              A+
            </button>

            <Sep />

            <ToolBtn title="Limpiar formato" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}><Eraser size={13} /></ToolBtn>
            <Sep />
          </>
        )}

        <ToolBtn title={viewMode ? 'Modo edición' : 'Vista previa'} onClick={() => setViewMode(v => !v)} active={viewMode}>
          {viewMode ? <Pencil size={13} /> : <Eye size={13} />}
        </ToolBtn>
        {viewMode && <span className="text-[10px] text-gray-500 ml-1">Vista previa</span>}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {viewMode ? (
          <div
            className={`rich-notes-view text-sm leading-relaxed min-h-[100px] ${empty(tab.content) ? 'text-gray-600 italic' : 'text-gray-100'}`}
            dangerouslySetInnerHTML={{ __html: empty(tab.content) ? 'Sin notas aún.' : tab.content }}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface TabbedNotesProps { value: string; onChange: (s: string) => void }

export default function TabbedNotes({ value, onChange }: TabbedNotesProps) {
  const [tabs, setTabs] = useState<NoteTab[]>(() => parse(value))
  const [activeId, setActiveId] = useState<string>(() => parse(value)[0]?.id ?? '')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  const emit = useCallback((next: NoteTab[]) => onChange(serialize(next)), [onChange])

  const updateTabContent = useCallback((id: string, html: string) => {
    setTabs(prev => {
      const next = prev.map(t => t.id === id ? { ...t, content: html } : t)
      emit(next)
      return next
    })
  }, [emit])

  const addTab = () => {
    const tab = defaultTab(tabs.length + 1)
    const next = [...tabs, tab]
    setTabs(next); setActiveId(tab.id); emit(next)
  }

  const removeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (tabs.length === 1) return
    const idx = tabs.findIndex(t => t.id === id)
    const next = tabs.filter(t => t.id !== id)
    setTabs(next)
    if (activeId === id) setActiveId(next[Math.max(0, idx - 1)].id)
    emit(next)
  }

  const startRename = (tab: NoteTab, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(tab.id); setEditingName(tab.name)
    setTimeout(() => renameRef.current?.select(), 30)
  }

  const commitRename = () => {
    if (!editingId) return
    const name = editingName.trim() || 'Sin nombre'
    const next = tabs.map(t => t.id === editingId ? { ...t, name } : t)
    setTabs(next); emit(next); setEditingId(null)
  }

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0]

  return (
    <div className="rounded-xl border border-gray-700/50 bg-[#1a1d23] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-end border-b border-gray-700/40 bg-[#14171e] overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId
          return (
            <div
              key={tab.id}
              onClick={() => { if (editingId !== tab.id) setActiveId(tab.id) }}
              onDoubleClick={e => startRename(tab, e)}
              className={`group relative flex items-center gap-1.5 px-3 py-2 cursor-pointer select-none border-r border-gray-700 transition-colors shrink-0 ${
                isActive
                  ? 'bg-gray-800 text-white border-b-2 border-b-orange-500 -mb-px'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
              style={{ maxWidth: 160 }}
            >
              {editingId === tab.id ? (
                <input
                  ref={renameRef}
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null) }}
                  onClick={e => e.stopPropagation()}
                  className="bg-transparent border-none outline-none text-xs text-white w-24 focus:ring-0"
                  autoFocus
                />
              ) : (
                <span className="text-xs truncate">{tab.name}</span>
              )}
              {tabs.length > 1 && !editingId && (
                <button
                  onClick={e => removeTab(tab.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all shrink-0"
                  title="Eliminar tab"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          )
        })}
        <button
          onClick={addTab}
          title="Agregar tab"
          className="px-2.5 py-2 text-gray-500 hover:text-orange-400 hover:bg-gray-800/50 transition-colors shrink-0"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Active tab editor */}
      {activeTab && (
        <TabEditor key={activeTab.id} tab={activeTab} onChange={html => updateTabContent(activeTab.id, html)} />
      )}

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
          content: attr(data-placeholder); color: #4b5563; pointer-events: none; float: left; height: 0;
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
