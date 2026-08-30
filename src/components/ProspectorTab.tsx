'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import {
  Search, MapPin, Star, Phone, Globe, ArrowRight,
  CheckSquare, Square, Loader2, UserPlus, AlertCircle,
  CheckCircle2, Map, X, Table2, Trash2, ExternalLink,
  RefreshCw, Eye, User, Calendar, Clock, LayoutGrid,
  Download, Plus, AlertTriangle, Zap,
} from 'lucide-react'
import CategorySelector from './CategorySelector'

const MapPicker    = dynamic(() => import('./MapPicker'),    { ssr: false })
const ResultsMap   = dynamic(() => import('./ResultsMap'),   { ssr: false })
const MiniMap      = dynamic(() => import('./MiniMap'),      { ssr: false })

interface Place {
  placeId: string
  name: string
  address: string
  phone: string
  website: string
  rating: number | null
  totalRatings: number
  status: string
  types: string[]
  lat: number | null
  lng: number | null
  score: number
}

function calcScore(p: Omit<Place, 'score'>): number {
  let s = 0
  if (p.rating)       s += (p.rating / 5) * 40
  if (p.totalRatings) s += Math.min(30, Math.log10(p.totalRatings + 1) * 15)
  if (p.phone)        s += 10
  if (p.website)      s += 10
  if (p.status === 'OPERATIONAL') s += 10
  return Math.round(s)
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500/20 text-green-400 border-green-500/30'
              : score >= 40 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
              : 'bg-red-500/20 text-red-400 border-red-500/30'
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
      <Zap size={9} /> {score}
    </span>
  )
}

interface Suggestion {
  placeId: string
  mainText: string
  secondaryText: string
}

interface Props {
  onLeadsCreated?: () => void
  initialView?: 'search' | 'table'
}

interface SavedResult {
  id: string
  placeId: string
  name: string
  address: string | null
  phone: string | null
  website: string | null
  rating: number | null
  totalRatings: number
  types: string | null
  city: string
  category: string
  convertedToLead: boolean
  savedByName: string
  lat: number | null
  lng: number | null
  createdAt: string
  updatedAt: string
}

const RADIUS_OPTIONS = [
  { value: 1000,  label: '1 km'  },
  { value: 3000,  label: '3 km'  },
  { value: 5000,  label: '5 km'  },
  { value: 10000, label: '10 km' },
  { value: 20000, label: '20 km' },
]

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs text-gray-500">Sin calificación</span>
  return (
    <div className="flex items-center gap-1">
      <Star size={11} className="text-yellow-400 fill-yellow-400" />
      <span className="text-xs text-gray-300">{rating.toFixed(1)}</span>
    </div>
  )
}

export default function ProspectorTab({ onLeadsCreated, initialView = 'search' }: Props) {
  const [city, setCity]             = useState('')
  const [coords, setCoords]         = useState<{ lat: number; lng: number } | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSugg, setShowSugg]     = useState(false)
  const [loadingSugg, setLoadingSugg] = useState(false)
  const [category, setCategory]     = useState('')
  const [radius, setRadius]         = useState(5000)
  const [maxResults, setMaxResults] = useState(20)
  const [view, setView]             = useState<'search' | 'table'>(initialView)
  const [savedResults, setSavedResults] = useState<SavedResult[]>([])
  const [loadingTable, setLoadingTable] = useState(false)
  const [savingToTable, setSavingToTable] = useState(false)
  const [tableFilter, setTableFilter]     = useState('')
  const [filterCity, setFilterCity]       = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus]   = useState('')
  const [filterRatingMin, setFilterRatingMin] = useState(0)
  const [viewRecord, setViewRecord]         = useState<SavedResult | null>(null)
  const [confirmConvert, setConfirmConvert] = useState<SavedResult | null>(null)
  const [confirmDelete, setConfirmDelete]   = useState<SavedResult | null>(null)
  const [convertingOne, setConvertingOne]   = useState(false)
  const [deletingOne, setDeletingOne]       = useState(false)

  const { data: session } = useSession()
  const [places, setPlaces]         = useState<Place[]>([])
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [loading, setLoading]       = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError]           = useState('')
  const [query, setQuery]           = useState('')
  const [toast, setToast]           = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [showMap, setShowMap]       = useState(false)
  // Batch search
  const [batchCities, setBatchCities] = useState<string[]>([])
  const [batchMode, setBatchMode]     = useState(false)
  const [batchProgress, setBatchProgress] = useState<string>('')
  // Results view mode
  const [resultsView, setResultsView] = useState<'cards' | 'map'>('cards')
  // Duplicates
  const [duplicates, setDuplicates]   = useState<Place[]>([])

  const suggRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeCategory = category

  // Autocomplete debounced
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (city.length < 2) { setSuggestions([]); setShowSugg(false); return }

    debounce.current = setTimeout(async () => {
      setLoadingSugg(true)
      try {
        const res = await fetch(`/api/prospecting/autocomplete?q=${encodeURIComponent(city)}`)
        const data = await res.json()
        setSuggestions(data.suggestions ?? [])
        setShowSugg(true)
      } catch { setSuggestions([]) }
      finally { setLoadingSugg(false) }
    }, 300)
  }, [city])

  // Cerrar sugerencias al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggRef.current && !suggRef.current.contains(e.target as Node)) {
        setShowSugg(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectSuggestion = (s: Suggestion) => {
    setCity(s.mainText)
    setSuggestions([])
    setShowSugg(false)
    setCoords(null) // reset coords, se geocodificará por nombre
  }

  const handleMapSelect = useCallback((lat: number, lng: number, locationName: string) => {
    setCity(locationName)
    setCoords({ lat, lng })
    setShowMap(false)
  }, [])

  const loadTable = useCallback(async () => {
    setLoadingTable(true)
    try {
      const r = await fetch('/api/prospecting/table')
      if (r.ok) setSavedResults(await r.json())
    } catch {}
    finally { setLoadingTable(false) }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (view === 'table') loadTable() }, [view])

  const saveToTable = async () => {
    const toSave = places.filter(p => selected.has(p.placeId))
    if (!toSave.length) return
    setSavingToTable(true)
    try {
      const r = await fetch('/api/prospecting/table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ places: toSave, city, category }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      showToast('success', `${data.saved} registro(s) guardados en Prospector Table`)
      setSelected(new Set())
      setView('table')
      loadTable()
    } catch (e: any) {
      showToast('error', e.message || 'Error al guardar')
    } finally {
      setSavingToTable(false)
    }
  }

  const deleteFromTable = async (record: SavedResult) => {
    setDeletingOne(true)
    try {
      await fetch('/api/prospecting/table', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id }),
      })
      setSavedResults(prev => prev.filter(r => r.id !== record.id))
    } finally {
      setDeletingOne(false)
      setConfirmDelete(null)
    }
  }

  const convertOneToLead = async (record: SavedResult) => {
    setConvertingOne(true)
    try {
      const place = {
        placeId:      record.placeId,
        name:         record.name,
        address:      record.address ?? '',
        phone:        record.phone   ?? '',
        website:      record.website ?? '',
        rating:       record.rating,
        totalRatings: record.totalRatings,
        types:        record.types ? JSON.parse(record.types) : [],
      }

      const res = await fetch('/api/prospecting/convert', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ places: [place] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Marcar como convertido en la tabla
      await fetch('/api/prospecting/table', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: record.id, convertedToLead: true }),
      })
      setSavedResults(prev => prev.map(r => r.id === record.id ? { ...r, convertedToLead: true } : r))

      const msg = data.created > 0
        ? `✓ ${record.name} pasó a Clientes — responsable: ${(session?.user as any)?.name ?? 'tú'}`
        : `${record.name} ya existía en Clientes`
      showToast(data.created > 0 ? 'success' : 'info' as any, msg)
      onLeadsCreated?.()
    } catch (e: any) {
      showToast('error', e.message || 'Error al convertir')
    } finally {
      setConvertingOne(false)
      setConfirmConvert(null)
    }
  }

  const markConverted = async (id: string, value: boolean) => {
    await fetch('/api/prospecting/table', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, convertedToLead: value }),
    })
    setSavedResults(prev => prev.map(r => r.id === id ? { ...r, convertedToLead: value } : r))
  }

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const runOneSearch = async (cityName: string, lat?: number, lng?: number) => {
    const body: Record<string, unknown> = { category: activeCategory, radius, maxResults }
    if (lat !== undefined && lng !== undefined) { body.lat = lat; body.lng = lng }
    else body.city = cityName
    const res = await fetch('/api/prospecting/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return data.places as Omit<Place, 'score'>[]
  }

  const applyScoreAndDedupe = (raw: Omit<Place, 'score'>[]): Place[] => {
    const seen = new Set<string>()
    return raw.filter(p => { if (seen.has(p.placeId)) return false; seen.add(p.placeId); return true })
              .map(p => ({ ...p, score: calcScore(p) }))
              .sort((a, b) => b.score - a.score)
  }

  const detectDuplicates = (found: Place[]) => {
    const dupes = found.filter(p =>
      savedResults.some(s =>
        s.placeId === p.placeId ||
        (p.phone && s.phone && p.phone === s.phone) ||
        (p.address && s.address && p.address.toLowerCase().includes(s.address.toLowerCase().slice(0, 20)))
      )
    )
    setDuplicates(dupes)
  }

  const search = async () => {
    if (!batchMode && !city.trim()) { setError('Selecciona una ubicación'); return }
    if (batchMode && batchCities.length === 0) { setError('Agrega al menos una ciudad'); return }
    if (!activeCategory) { setError('Ingresa una categoría'); return }
    setError('')
    setLoading(true)
    setPlaces([])
    setSelected(new Set())
    setDuplicates([])
    setBatchProgress('')

    try {
      if (!batchMode) {
        const raw = await runOneSearch(city, coords?.lat, coords?.lng)
        const scored = applyScoreAndDedupe(raw)
        setPlaces(scored)
        setQuery(`${activeCategory} en ${city}`)
        detectDuplicates(scored)
      } else {
        const all: Omit<Place, 'score'>[] = []
        for (let i = 0; i < batchCities.length; i++) {
          const c = batchCities[i]
          setBatchProgress(`Buscando en ${c} (${i + 1}/${batchCities.length})...`)
          const raw = await runOneSearch(c)
          all.push(...raw)
        }
        setBatchProgress('')
        const scored = applyScoreAndDedupe(all)
        setPlaces(scored)
        setQuery(`${activeCategory} en ${batchCities.join(', ')}`)
        detectDuplicates(scored)
      }
    } catch (e: any) {
      setError(e.message || 'Error al buscar')
    } finally {
      setLoading(false)
    }
  }

  const toggleAll = () => {
    if (selected.size === places.length) setSelected(new Set())
    else setSelected(new Set(places.map(p => p.placeId)))
  }

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const convertToLeads = async () => {
    const toConvert = places.filter(p => selected.has(p.placeId))
    if (!toConvert.length) return
    setConverting(true)
    try {
      const res = await fetch('/api/prospecting/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ places: toConvert }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const msg = `${data.created} lead(s) creados (con su Cliente vinculado)${data.skipped > 0 ? ` · ${data.skipped} ya tenían un Lead asociado` : ''}`
      showToast('success', msg)
      setSelected(new Set())
      onLeadsCreated?.()
    } catch (e: any) {
      showToast('error', e.message || 'Error al convertir')
    } finally {
      setConverting(false)
    }
  }

  const uniqueCities      = [...new Set(savedResults.map(r => r.city))].sort()
  const uniqueCategories  = [...new Set(savedResults.map(r => r.category))].sort()

  const filteredSaved = savedResults.filter(r => {
    if (tableFilter) {
      const q = tableFilter.toLowerCase()
      if (!r.name.toLowerCase().includes(q) &&
          !r.city.toLowerCase().includes(q) &&
          !r.category.toLowerCase().includes(q)) return false
    }
    if (filterCity     && r.city     !== filterCity)     return false
    if (filterCategory && r.category !== filterCategory) return false
    if (filterStatus === 'pendiente'  && r.convertedToLead)  return false
    if (filterStatus === 'convertido' && !r.convertedToLead) return false
    if (filterRatingMin > 0 && (r.rating ?? 0) < filterRatingMin) return false
    return true
  })

  return (
    <div className="space-y-5">

      {/* View tabs */}
      <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView('search')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === 'search' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Search size={13} /> Buscar
        </button>
        <button
          onClick={() => setView('table')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === 'table' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Table2 size={13} /> Prospector Table
          {savedResults.length > 0 && (
            <span className="bg-orange-500/30 text-orange-300 text-[10px] px-1.5 py-0.5 rounded-full">
              {savedResults.length}
            </span>
          )}
        </button>
      </div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm shadow-xl ${
          toast.type === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {view === 'search' && (<>

      {/* Map modal */}
      {showMap && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
              <div>
                <h3 className="text-sm font-semibold text-white">Seleccionar ubicación en mapa</h3>
                <p className="text-xs text-gray-400 mt-0.5">Haz click en cualquier punto de Colombia</p>
              </div>
              <button onClick={() => setShowMap(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="h-[500px]">
              <MapPicker onSelect={handleMapSelect} radius={radius} />
            </div>
            <div className="px-5 py-3 border-t border-gray-700 text-xs text-gray-500">
              Radio de búsqueda actual: <span className="text-orange-400 font-medium">
                {RADIUS_OPTIONS.find(r => r.value === radius)?.label ?? `${radius}m`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">

        {/* Batch mode toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Modo de búsqueda</span>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button onClick={() => setBatchMode(false)} className={`px-3 py-1 text-xs rounded-md transition-colors ${!batchMode ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              Simple
            </button>
            <button onClick={() => setBatchMode(true)} className={`px-3 py-1 text-xs rounded-md transition-colors ${batchMode ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              Lote (múltiples ciudades)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Location */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 flex items-center gap-1">
              <MapPin size={11} /> {batchMode ? 'Ciudades' : 'Ubicación'}
            </label>
            {!batchMode && (
              <div className="flex gap-2">
                <div ref={suggRef} className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={city}
                    onChange={e => { setCity(e.target.value); setCoords(null) }}
                    onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                    placeholder="Busca ciudad, municipio..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  />
                  {loadingSugg && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />}
                  {showSugg && suggestions.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-30 overflow-hidden">
                      {suggestions.map(s => (
                        <button key={s.placeId} onClick={() => selectSuggestion(s)} className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-700 transition-colors text-left">
                          <MapPin size={12} className="text-orange-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-white">{s.mainText}</p>
                            {s.secondaryText && <p className="text-xs text-gray-500">{s.secondaryText}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setShowMap(true)} title="Seleccionar en mapa" className="flex-shrink-0 p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-orange-400 hover:border-orange-500/50 transition-colors">
                  <Map size={16} />
                </button>
              </div>
            )}
            {!batchMode && coords && <p className="text-[10px] text-orange-400 flex items-center gap-1"><MapPin size={9} /> Coordenadas desde mapa</p>}
            {batchMode && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {batchCities.map(c => (
                    <span key={c} className="flex items-center gap-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs px-2 py-0.5 rounded-full">
                      {c}
                      <button onClick={() => setBatchCities(prev => prev.filter(x => x !== c))}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    list="municipios-batch"
                    placeholder="Agregar ciudad..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim()
                        if (val && !batchCities.includes(val)) setBatchCities(prev => [...prev, val]);
                        (e.target as HTMLInputElement).value = ''
                      }
                    }}
                  />
                  <datalist id="municipios-batch">
                    {['Bogotá','Medellín','Cali','Barranquilla','Cartagena','Bucaramanga','Pereira','Manizales','Cúcuta','Ibagué','Pasto','Neiva','Villavicencio','Armenia'].map(m => <option key={m} value={m} />)}
                  </datalist>
                  <button onClick={() => {}} className="text-[10px] text-gray-500 px-2">↵ Enter</button>
                </div>
              </div>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-xs text-gray-400">Sector y categoría</label>
            <CategorySelector value={category} onChange={setCategory} />
          </div>

          {/* Radius */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400">Radio</label>
            <select
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            >
              {RADIUS_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400">Máx. resultados:</label>
            {[10, 20, 50].map(n => (
              <button
                key={n}
                onClick={() => setMaxResults(n)}
                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                  maxResults === n
                    ? 'bg-orange-600/20 border-orange-500/40 text-orange-400'
                    : 'border-gray-700 text-gray-500 hover:text-gray-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={search}
            disabled={loading || !city.trim() || !activeCategory}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {loading ? 'Buscando...' : 'Buscar negocios'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}
      </div>

      {/* Batch progress */}
      {batchProgress && (
        <div className="flex items-center gap-2 text-sm text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-2.5">
          <Loader2 size={14} className="animate-spin" /> {batchProgress}
        </div>
      )}

      {/* Results */}
      {places.length > 0 && (
        <div className="space-y-3">
          {/* Duplicate widget */}
          {duplicates.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
                <AlertTriangle size={15} /> {duplicates.length} posible{duplicates.length > 1 ? 's' : ''} duplicado{duplicates.length > 1 ? 's' : ''} detectado{duplicates.length > 1 ? 's' : ''}
                <span className="text-[10px] text-yellow-600 ml-1">(ya están en Prospector Table)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {duplicates.map(d => (
                  <div key={d.placeId} className="flex items-center gap-2 bg-yellow-500/5 border border-yellow-500/10 rounded-lg px-3 py-1.5">
                    <AlertTriangle size={11} className="text-yellow-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-white truncate">{d.name}</p>
                      {d.phone && <p className="text-[10px] text-yellow-600">{d.phone}</p>}
                    </div>
                    <ScoreBadge score={d.score} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-sm font-semibold text-white">{places.length} resultados</span>
                <span className="text-xs text-gray-500 ml-2">"{query}"</span>
              </div>
              {/* Cards / Map toggle */}
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
                <button onClick={() => setResultsView('cards')} title="Tarjetas"
                  className={`p-1.5 rounded-md transition-colors ${resultsView === 'cards' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}>
                  <LayoutGrid size={13} />
                </button>
                <button onClick={() => setResultsView('map')} title="Mapa"
                  className={`p-1.5 rounded-md transition-colors ${resultsView === 'map' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}>
                  <Map size={13} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={toggleAll} className="text-xs text-gray-400 hover:text-white transition-colors">
                {selected.size === places.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveToTable}
                    disabled={savingToTable}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-600"
                  >
                    {savingToTable ? <Loader2 size={14} className="animate-spin" /> : <Table2 size={14} />}
                    Prospector Table
                  </button>
                  <button
                    onClick={convertToLeads}
                    disabled={converting}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {converting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    Convertir {selected.size} a Clientes
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Map view */}
          {resultsView === 'map' && (
            <div className="h-[480px] rounded-xl overflow-hidden border border-gray-800">
              <ResultsMap places={places} />
            </div>
          )}

          {/* Cards view */}
          {resultsView === 'cards' && <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {places.map(place => (
              <div
                key={place.placeId}
                onClick={() => toggle(place.placeId)}
                className={`bg-gray-900 border rounded-xl p-4 cursor-pointer transition-all ${
                  selected.has(place.placeId)
                    ? 'border-orange-500/50 bg-orange-500/5'
                    : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex-shrink-0 text-orange-400">
                      {selected.has(place.placeId)
                        ? <CheckSquare size={16} />
                        : <Square size={16} className="text-gray-600" />
                      }
                    </div>
                    <h3 className="text-sm font-semibold text-white leading-tight">{place.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={place.score} />
                    <Stars rating={place.rating} />
                  </div>
                </div>

                <div className="ml-6 space-y-1.5">
                  {place.address && (
                    <div className="flex items-start gap-1.5 text-xs text-gray-400">
                      <MapPin size={11} className="mt-0.5 flex-shrink-0 text-gray-600" />
                      <span className="line-clamp-2">{place.address}</span>
                    </div>
                  )}
                  {place.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Phone size={11} className="text-gray-600" />
                      <span>{place.phone}</span>
                    </div>
                  )}
                  {place.website && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Globe size={11} className="text-gray-600" />
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-orange-400 hover:underline truncate max-w-[200px]"
                      >
                        {place.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {place.types.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {place.types.slice(0, 3).map(t => (
                        <span key={t} className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                          {t.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {selected.has(place.placeId) && (
                  <div className="ml-6 mt-2 flex items-center gap-1 text-[10px] text-orange-400">
                    <ArrowRight size={10} /> Se agregará a Clientes
                  </div>
                )}
              </div>
            ))}
          </div>}
        </div>
      )}

      {!loading && places.length === 0 && query && (
        <div className="text-center py-16 text-gray-600">
          <Search size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Sin resultados para "{query}"</p>
          <p className="text-xs mt-1">Prueba con otro término o amplía el radio</p>
        </div>
      )}

      </>)}

      {/* View record popup */}
      {viewRecord && (() => {
        const r = viewRecord
        const score = Math.round(
          (r.rating ? (r.rating / 5) * 40 : 0) +
          (r.totalRatings ? Math.min(30, Math.log10(r.totalRatings + 1) * 15) : 0) +
          (r.phone ? 10 : 0) +
          (r.website ? 10 : 0) +
          10 // asumimos OPERATIONAL
        )
        const scoreColor = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
        const scoreBg    = score >= 70 ? 'bg-green-500/10 border-green-500/20' : score >= 40 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20'
        const scoreLabel = score >= 70 ? 'Alta oportunidad' : score >= 40 ? 'Oportunidad media' : 'Oportunidad baja'

        const hasWhatsApp = !!r.phone && /(\+?57\s?)?3\d{9}/.test(r.phone.replace(/\s/g, ''))

        const criteria: { label: string; ok: boolean; neg: string; unknown?: boolean }[] = [
          { label: 'Tiene teléfono',       ok: !!r.phone,    neg: 'No tiene teléfono'         },
          { label: 'Tiene página web',     ok: !!r.website,  neg: 'No tiene página web'        },
          { label: 'Calificado en Google', ok: !!r.rating,   neg: 'Sin calificación'           },
          { label: 'WhatsApp disponible',  ok: hasWhatsApp,  neg: 'WhatsApp no detectado',     unknown: !r.phone },
          { label: 'Correo electrónico',   ok: false,        neg: 'Sin datos de correo',       unknown: true },
          { label: 'App móvil',            ok: false,        neg: 'Sin datos de app',          unknown: true },
          { label: 'Redes sociales',       ok: false,        neg: 'Sin datos de redes',        unknown: true },
        ]

        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="flex items-start justify-between px-6 py-5 border-b border-gray-700">
                <div>
                  <h3 className="text-white font-semibold text-lg leading-tight">{r.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{r.category}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${r.convertedToLead ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                      {r.convertedToLead ? '✓ Convertido' : 'Pendiente'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setViewRecord(null)} className="text-gray-500 hover:text-white transition-colors mt-0.5">
                  <X size={18} />
                </button>
              </div>

              {/* Body — 2 columns */}
              <div className="flex divide-x divide-gray-800">

                {/* Left: contact + types + metadata */}
                <div className="flex-1 px-6 py-5 space-y-4 min-w-0">
                  <div className="space-y-2.5">
                    {r.address && (
                      <div className="flex items-start gap-2.5 text-sm text-gray-300">
                        <MapPin size={14} className="text-gray-500 flex-shrink-0 mt-0.5" />
                        <span>{r.address}</span>
                      </div>
                    )}
                    {r.phone && (
                      <div className="flex items-center gap-2.5 text-sm text-gray-300">
                        <Phone size={14} className="text-gray-500 flex-shrink-0" />
                        <span>{r.phone}</span>
                      </div>
                    )}
                    {r.website && (
                      <div className="flex items-center gap-2.5">
                        <Globe size={14} className="text-gray-500 flex-shrink-0" />
                        <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-400 hover:underline truncate">
                          {r.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                    {r.rating && (
                      <div className="flex items-center gap-2.5">
                        <Star size={14} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                        <span className="text-sm text-gray-300">{r.rating} / 5</span>
                        <span className="text-xs text-gray-600">({r.totalRatings} reseñas)</span>
                      </div>
                    )}
                  {/* Mini mapa interactivo */}
                  {r.lat && r.lng ? (
                    <div className="rounded-lg overflow-hidden border border-gray-700" style={{ height: '140px' }}>
                      <MiniMap lat={r.lat} lng={r.lng} name={r.name} />
                    </div>
                  ) : (
                    <a href={`https://www.google.com/maps/place/?q=place_id:${r.placeId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      Ver en Google Maps
                    </a>
                  )}
                  {r.lat && r.lng && (
                    <a href={`https://www.google.com/maps/place/?q=place_id:${r.placeId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      Abrir en Google Maps
                    </a>
                  )}
                  </div>

                  {r.types && JSON.parse(r.types).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {JSON.parse(r.types).slice(0, 5).map((t: string) => (
                        <span key={t} className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">{t.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-800 text-center">
                    <div className="bg-gray-800/60 rounded-lg p-2">
                      <p className="text-[10px] text-gray-500 mb-0.5 flex items-center justify-center gap-1"><User size={9} /> Guardado</p>
                      <p className="text-xs text-white truncate">{r.savedByName}</p>
                    </div>
                    <div className="bg-gray-800/60 rounded-lg p-2">
                      <p className="text-[10px] text-gray-500 mb-0.5 flex items-center justify-center gap-1"><Calendar size={9} /> Creado</p>
                      <p className="text-xs text-white">{new Date(r.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</p>
                    </div>
                    <div className="bg-gray-800/60 rounded-lg p-2">
                      <p className="text-[10px] text-gray-500 mb-0.5 flex items-center justify-center gap-1"><Clock size={9} /> Modificado</p>
                      <p className="text-xs text-white">{new Date(r.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</p>
                    </div>
                  </div>
                </div>

                {/* Right: score widget */}
                <div className="w-52 flex-shrink-0 px-5 py-5 flex flex-col gap-4">

                  {/* Score */}
                  <div className={`rounded-xl border p-4 text-center ${scoreBg}`}>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 flex items-center justify-center gap-1">
                      <Zap size={9} /> Score
                    </p>
                    <p className="text-5xl font-bold" style={{ color: scoreColor }}>{score}</p>
                    <p className="text-[10px] mt-1" style={{ color: scoreColor }}>{scoreLabel}</p>
                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: scoreColor }} />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">{score} / 100</p>
                  </div>

                  {/* Criteria */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Calificación</p>
                    {criteria.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          c.unknown ? 'bg-gray-700' : c.ok ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          {c.unknown
                            ? <span className="text-gray-500 text-[9px] font-bold">?</span>
                            : c.ok
                            ? <CheckCircle2 size={10} className="text-green-400" />
                            : <X size={10} className="text-red-400" />
                          }
                        </div>
                        <p className={`text-xs leading-tight ${
                          c.unknown ? 'text-gray-600' : c.ok ? 'text-gray-300' : 'text-gray-500'
                        }`}>
                          {c.unknown ? c.neg : c.ok ? c.label : c.neg}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-gray-800 flex justify-end">
                <button onClick={() => setViewRecord(null)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Confirm delete popup */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Eliminar registro</h3>
                <p className="text-gray-400 text-sm mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-5">
              <p className="text-white font-medium">{confirmDelete.name}</p>
              {confirmDelete.city && (
                <p className="text-xs text-gray-500 mt-1">{confirmDelete.city} · {confirmDelete.category}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deletingOne}
                className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteFromTable(confirmDelete)}
                disabled={deletingOne}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                {deletingOne ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm convert popup */}
      {confirmConvert && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <UserPlus size={18} className="text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Convertir a Cliente</h3>
                <p className="text-gray-400 text-sm mt-0.5">Esto creará un registro en la tabla de Clientes</p>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-5 space-y-2">
              <p className="text-white font-medium">{confirmConvert.name}</p>
              {confirmConvert.address && <p className="text-xs text-gray-500">{confirmConvert.address}</p>}
              <div className="flex flex-wrap gap-3 pt-1">
                {confirmConvert.phone && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Phone size={10} /> {confirmConvert.phone}
                  </span>
                )}
                {confirmConvert.website && (
                  <span className="text-xs text-orange-400 flex items-center gap-1">
                    <Globe size={10} /> {confirmConvert.website.replace(/^https?:\/\//, '').slice(0, 30)}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-2.5 mb-5 text-xs text-blue-300 flex items-center gap-2">
              <CheckCircle2 size={13} />
              Responsable: <span className="font-medium">{(session?.user as any)?.name ?? session?.user?.email ?? 'tú'}</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmConvert(null)}
                disabled={convertingOne}
                className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => convertOneToLead(confirmConvert)}
                disabled={convertingOne}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                {convertingOne ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Prospector Table ── */}
      {view === 'table' && (
        <div className="space-y-4">

          {/* Filter bar */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            {/* Row 1: text + refresh */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={tableFilter}
                  onChange={e => setTableFilter(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                />
              </div>
              <span className="text-xs text-gray-500 flex-shrink-0">{filteredSaved.length} registros</span>
              <button
                onClick={() => {
                  const headers = ['Nombre','Dirección','Teléfono','Web','Rating','Ciudad','Categoría','Estado','Guardado por','Fecha']
                  const rows = filteredSaved.map(r => [r.name, r.address ?? '', r.phone ?? '', r.website ?? '', r.rating ?? '', r.city, r.category, r.convertedToLead ? 'Convertido' : 'Pendiente', r.savedByName, new Date(r.createdAt).toLocaleDateString('es-ES')])
                  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
                  a.download = 'prospector-table.csv'; a.click()
                }}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                title="Exportar CSV"
              >
                <Download size={13} /> CSV
              </button>
              <button onClick={loadTable} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors flex-shrink-0">
                <RefreshCw size={13} className={loadingTable ? 'animate-spin' : ''} /> Actualizar
              </button>
            </div>

            {/* Row 2: selectboxes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider">Ciudad</label>
                <select
                  value={filterCity}
                  onChange={e => setFilterCity(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">Todas</option>
                  {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider">Categoría</label>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">Todas</option>
                  {uniqueCategories.map(c => <option key={c} value={c}>{c.length > 30 ? c.slice(0,30)+'…' : c}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider">Estado</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="convertido">Convertido</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Rating mínimo: <span className="text-orange-400">{filterRatingMin > 0 ? `${filterRatingMin}★` : 'Todos'}</span>
                </label>
                <input
                  type="range"
                  min={0} max={5} step={0.5}
                  value={filterRatingMin}
                  onChange={e => setFilterRatingMin(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                </div>
              </div>
            </div>

            {/* Active filters + clear */}
            {(filterCity || filterCategory || filterStatus || filterRatingMin > 0 || tableFilter) && (
              <div className="flex items-center justify-between pt-1 border-t border-gray-800">
                <div className="flex flex-wrap gap-2">
                  {tableFilter   && <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">"{tableFilter}"</span>}
                  {filterCity    && <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">{filterCity}</span>}
                  {filterCategory && <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">{filterCategory.slice(0,25)}</span>}
                  {filterStatus  && <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full capitalize">{filterStatus}</span>}
                  {filterRatingMin > 0 && <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">≥ {filterRatingMin}★</span>}
                </div>
                <button
                  onClick={() => { setTableFilter(''); setFilterCity(''); setFilterCategory(''); setFilterStatus(''); setFilterRatingMin(0) }}
                  className="text-[10px] text-gray-500 hover:text-white transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {loadingTable ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Cargando tabla...
            </div>
          ) : filteredSaved.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <Table2 size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">{savedResults.length === 0 ? 'Tabla vacía' : 'Sin resultados para ese filtro'}</p>
              <p className="text-xs mt-1">Busca negocios y usa "Prospector Table" para guardarlos aquí</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800">
                    <tr className="text-xs text-gray-400 uppercase">
                      <th className="text-left px-4 py-3">Negocio</th>
                      <th className="text-left px-4 py-3">Contacto</th>
                      <th className="text-left px-4 py-3">Ciudad</th>
                      <th className="text-left px-4 py-3">Categoría</th>
                      <th className="text-center px-4 py-3">Rating</th>
                      <th className="text-center px-4 py-3">Estado</th>
                      <th className="text-center px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredSaved.map(r => (
                      <tr key={r.id} className={`hover:bg-gray-800/50 transition-colors ${r.convertedToLead ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{r.name}</p>
                          {r.address && <p className="text-xs text-gray-500 truncate max-w-[200px]">{r.address}</p>}
                        </td>
                        <td className="px-4 py-3 space-y-1">
                          {r.phone && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Phone size={10} className="text-gray-600" /> {r.phone}
                            </p>
                          )}
                          {r.website && (
                            <a href={r.website} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-orange-400 hover:underline flex items-center gap-1">
                              <ExternalLink size={10} />
                              {r.website.replace(/^https?:\/\//, '').slice(0, 25)}
                            </a>
                          )}
                          <a
                            href={`https://www.google.com/maps/place/?q=place_id:${r.placeId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                            title="Ver en Google Maps"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                            Ver en Maps
                          </a>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{r.city}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">
                            {r.category.length > 25 ? r.category.slice(0, 25) + '…' : r.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.rating
                            ? <span className="text-xs text-yellow-400 flex items-center justify-center gap-1">
                                <Star size={10} className="fill-yellow-400" /> {r.rating}
                              </span>
                            : <span className="text-xs text-gray-600">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] px-2 py-1 rounded-full border ${
                            r.convertedToLead
                              ? 'bg-green-500/10 text-green-400 border-green-500/30'
                              : 'bg-gray-800 text-gray-500 border-gray-700'
                          }`}>
                            {r.convertedToLead ? '✓ Convertido' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setViewRecord(r)}
                              className="text-gray-600 hover:text-blue-400 transition-colors"
                              title="Ver detalle"
                            >
                              <Eye size={15} />
                            </button>
                            {!r.convertedToLead && (
                              <button
                                onClick={() => setConfirmConvert(r)}
                                className="text-gray-600 hover:text-orange-400 transition-colors"
                                title="Convertir a Cliente"
                              >
                                <CheckCircle2 size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmDelete(r)}
                              className="text-gray-600 hover:text-red-400 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
