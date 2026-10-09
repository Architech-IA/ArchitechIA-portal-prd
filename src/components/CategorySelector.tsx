'use client'

import { useState, useRef, useEffect } from 'react'
import { Tag, Search, ChevronDown, ChevronRight, X } from 'lucide-react'
import { SECTORS } from '@/lib/prospecting-categories'

interface Props {
  value: string
  onChange: (value: string) => void
}

export default function CategorySelector({ value, onChange }: Props) {
  const [open, setOpen]           = useState(false)
  const [search, setSearch]       = useState('')
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())
  const ref                       = useRef<HTMLDivElement>(null)
  const searchRef                 = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  // Al buscar, expande todos los sectores con coincidencias
  useEffect(() => {
    if (!search.trim()) { setExpanded(new Set()); return }
    const q = search.toLowerCase()
    const toExpand = new Set<string>()
    SECTORS.forEach(s => {
      const inSector = s.label.toLowerCase().includes(q)
      const inSub    = s.subcategories.some(sc => sc.toLowerCase().includes(q))
      if (inSector || inSub) toExpand.add(s.id)
    })
    setExpanded(toExpand)
  }, [search])

  const toggleSector = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const select = (sub: string) => {
    onChange(sub)
    setOpen(false)
    setSearch('')
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  // Filtrado
  const q = search.toLowerCase().trim()
  const filteredSectors = SECTORS.map(s => ({
    ...s,
    subcategories: q
      ? s.subcategories.filter(sc => sc.toLowerCase().includes(q) || s.label.toLowerCase().includes(q))
      : s.subcategories,
  })).filter(s => s.subcategories.length > 0)

  const totalSubs = SECTORS.reduce((a, s) => a + s.subcategories.length, 0)

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2 bg-gray-800 border rounded-lg px-3 py-2 text-sm text-left transition-colors ${
          open ? 'border-orange-500' : 'border-gray-700 hover:border-gray-600'
        }`}
      >
        <Tag size={13} className="text-[#7f8a9c] flex-shrink-0" />
        <span className={`flex-1 truncate ${value ? 'text-white' : 'text-[#7f8a9c]'}`}>
          {value || `Seleccionar categoría (${totalSubs} disponibles)`}
        </span>
        {value
          ? <button onClick={clear} className="text-[#7f8a9c] hover:text-white flex-shrink-0"><X size={13} /></button>
          : <ChevronDown size={13} className="text-[#7f8a9c] flex-shrink-0" />
        }
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-40 overflow-hidden"
             style={{ maxHeight: '420px' }}>

          {/* Search */}
          <div className="p-2 border-b border-gray-800 sticky top-0 bg-gray-900">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7f8a9c]" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar categoría..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Sectors list */}
          <div className="overflow-y-auto" style={{ maxHeight: '360px' }}>
            {filteredSectors.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#7f8a9c] text-sm">
                Sin resultados para "{search}"
              </div>
            ) : (
              filteredSectors.map(sector => (
                <div key={sector.id}>
                  {/* Sector header */}
                  <button
                    type="button"
                    onClick={() => toggleSector(sector.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-800 transition-colors text-left"
                  >
                    <span className="text-base leading-none">{sector.icon}</span>
                    <span className="flex-1 text-sm font-medium text-gray-300">{sector.label}</span>
                    <span className="text-[11px] text-[#7f8a9c] mr-1">{sector.subcategories.length}</span>
                    {expanded.has(sector.id)
                      ? <ChevronDown size={13} className="text-[#7f8a9c]" />
                      : <ChevronRight size={13} className="text-[#7f8a9c]" />
                    }
                  </button>

                  {/* Subcategories */}
                  {expanded.has(sector.id) && (
                    <div className="bg-gray-800/50 border-t border-b border-gray-800">
                      {sector.subcategories.map(sub => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => select(sub)}
                          className={`w-full text-left px-5 py-2 text-xs transition-colors ${
                            value === sub
                              ? 'bg-orange-600/20 text-orange-400'
                              : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                          }`}
                        >
                          {value === sub && '✓ '}{sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
