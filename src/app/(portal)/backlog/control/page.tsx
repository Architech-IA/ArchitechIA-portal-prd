'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePageActions } from '@/lib/pageActionsContext'
import { Rocket, Layers, Map as MapIcon, Play } from 'lucide-react'

interface SprintRow {
  id: string
  sprintCode: string | null
  name: string
  status: string
  epic: { id: string; name: string } | null
  solucion: { nombre: string } | null
  _count: { items: number }
}

const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planeado',
  IN_PROGRESS: 'En curso',
  REVIEW_PENDING: 'Esperando revisión',
  CLOSED: 'Cerrado',
}

const EPICS_PER_PAGE = 5

export default function ControlIndexPage() {
  const [sprints, setSprints] = useState<SprintRow[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const { setActions } = usePageActions()

  // Barra de pestañas Backlog/Sprint/Épicas/Solution/Sala de Control —
  // antes esta pagina (y sus hermanas /control/*) no la seteaban, asi que
  // navegar a la Sala de Control hacia "desaparecer" las pestañas de todo
  // el modulo de Backlog.
  useEffect(() => {
    setActions(
      <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/backlog" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.08)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          Backlog
        </Link>
        <Link href="/backlog/sprint" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.08)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          <Rocket size={10}/> Sprint
        </Link>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }}/>
        <Link href="/backlog/epics" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(29,147,117,0.08)'; (e.currentTarget as HTMLElement).style.color = '#1D9375' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          <Layers size={10}/> Épicas
        </Link>
        <Link href="/backlog/solution" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,119,221,0.08)'; (e.currentTarget as HTMLElement).style.color = '#7F77DD' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          <MapIcon size={10}/> Solution
        </Link>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }}/>
        <Link href="/backlog/control" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1"
          style={{ background: 'rgba(59,130,246,0.2)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
          <Play size={10}/> Sala de Control
        </Link>
      </div>
    )
    return () => setActions(null)
  }, [])

  useEffect(() => {
    fetch('/api/backlog/sprints')
      .then((r) => r.json())
      .then(setSprints)
      .catch(() => setSprints([]))
  }, [])

  const groups = useMemo(() => {
    const byEpic = new Map<string, { key: string; epicName: string; solucion: string; sprints: SprintRow[] }>()
    for (const s of sprints ?? []) {
      const key = s.epic?.id ?? '__sin_epica__'
      if (!byEpic.has(key)) {
        byEpic.set(key, { key, epicName: s.epic?.name ?? 'Sin épica', solucion: s.solucion?.nombre ?? '—', sprints: [] })
      }
      byEpic.get(key)!.sprints.push(s)
    }
    return Array.from(byEpic.values())
  }, [sprints])

  const totalPages = Math.max(1, Math.ceil(groups.length / EPICS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const pageGroups = groups.slice((safePage - 1) * EPICS_PER_PAGE, safePage * EPICS_PER_PAGE)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleEpic(group: { sprints: SprintRow[] }) {
    setSelected((prev) => {
      const next = new Set(prev)
      const allSelected = group.sprints.every((s) => next.has(s.id))
      for (const s of group.sprints) {
        if (allSelected) next.delete(s.id)
        else next.add(s.id)
      }
      return next
    })
  }

  const multiHref = `/backlog/control/multi?ids=${Array.from(selected).join(',')}`

  return (
    <div className="sala-control-index">
      <style>{`
        /* Usa los tokens reales del portal (globals.css) — sin fondo propio
           para que los blobs de liquid glass del layout se sigan viendo
           detras (main tiene background:transparent), y paneles en
           --bg-card + blur en vez de superficies opacas inventadas. */
        .sala-control-index { background: transparent; color: var(--text-primary); min-height: 100%; padding-bottom: 90px; position: relative; z-index: 1; }
        .sala-control-index * { box-sizing: border-box; }
        .sala-control-index .header { padding: 24px; border-bottom: 1px solid var(--border-base); background: var(--bg-elevated); backdrop-filter: blur(20px); display: flex; align-items: center; gap: 10px; }
        .sala-control-index .brand-mark { width: 9px; height: 9px; border-radius: 2px; background: var(--primary); display: inline-block; transform: rotate(45deg); }
        .sala-control-index h1 { font-size: 18px; font-weight: 800; margin: 0; }
        .sala-control-index .subtitle { font-size: 12.5px; color: var(--text-muted); margin-left: 4px; }
        .sala-control-index .content { padding: 20px 24px; max-width: 900px; }
        .sala-control-index .epic-group { margin-bottom: 22px; }
        .sala-control-index .epic-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .sala-control-index .epic-head label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; font-size: 13px; }
        .sala-control-index .epic-solucion { font-size: 11.5px; color: var(--text-muted); font-weight: 500; }
        .sala-control-index .list { display: grid; gap: 8px; }
        .sala-control-index .row { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: var(--radius); background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border-base); box-shadow: 0 4px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.02); text-decoration: none; color: var(--text-primary); transition: transform .12s ease, border-color .12s ease; cursor: pointer; }
        .sala-control-index .row:hover { transform: translateY(-1px); }
        .sala-control-index .row.checked { border-color: rgba(255,90,0,0.35); box-shadow: 0 0 0 2px var(--primary-dim), 0 4px 24px rgba(0,0,0,0.45); }
        .sala-control-index .row input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--primary); flex: none; cursor: pointer; }
        .sala-control-index .code { font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace; font-size: 12px; color: var(--text-muted); min-width: 130px; }
        .sala-control-index .name { font-weight: 700; font-size: 13.5px; flex: 1; }
        .sala-control-index .meta { font-size: 12px; color: var(--text-muted); }
        .sala-control-index .status { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 3px 9px; border-radius: 100px; background: var(--primary-dim); color: var(--primary-light); white-space: nowrap; }
        .sala-control-index .empty { padding: 40px 24px; color: var(--text-muted); font-size: 13px; }
        .sala-control-index .pager { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 10px 0 4px; }
        .sala-control-index .pager-btn { background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border-base); color: var(--text-secondary); border-radius: 100px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; transition: border-color .12s ease, color .12s ease; }
        .sala-control-index .pager-btn:hover:not(:disabled) { border-color: rgba(255,90,0,0.35); color: var(--primary-light); }
        .sala-control-index .pager-btn:disabled { opacity: .35; cursor: not-allowed; }
        .sala-control-index .pager-info { font-size: 12px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
        .sala-control-index .float-bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; padding: 16px; pointer-events: none; z-index: 2; }
        .sala-control-index .float-inner { pointer-events: auto; display: flex; align-items: center; gap: 14px; background: var(--bg-elevated); backdrop-filter: blur(20px); border: 1px solid var(--glass-border-md); box-shadow: 0 8px 40px rgba(0,0,0,0.55); border-radius: 100px; padding: 8px 8px 8px 18px; }
        .sala-control-index .float-count { font-size: 12.5px; color: var(--text-secondary); font-weight: 600; }
        .sala-control-index .float-btn { background: var(--primary); color: #fff; border: none; border-radius: 100px; padding: 9px 18px; font-size: 12.5px; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
        .sala-control-index .float-btn[aria-disabled="true"] { opacity: .4; pointer-events: none; }
      `}</style>
      <header className="header">
        <span className="brand-mark" />
        <h1>Sala de Control</h1>
        <span className="subtitle">Elegí uno o varios sprints — de una o varias épicas — para verlos juntos en una sola pantalla</span>
      </header>
      <div className="content">
        {sprints === null && <div className="empty">Cargando…</div>}
        {sprints?.length === 0 && <div className="empty">No hay sprints todavía.</div>}
        {pageGroups.map((g) => {
          const allChecked = g.sprints.every((s) => selected.has(s.id))
          return (
            <div className="epic-group" key={g.key}>
              <div className="epic-head">
                <label>
                  <input type="checkbox" checked={allChecked} onChange={() => toggleEpic(g)} />
                  {g.epicName}
                </label>
                <span className="epic-solucion">{g.solucion} · {g.sprints.length} sprint{g.sprints.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="list">
                {g.sprints.map((s) => (
                  <label key={s.id} className={`row ${selected.has(s.id) ? 'checked' : ''}`}>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                    <span className="code">{s.sprintCode ?? s.id.slice(0, 8)}</span>
                    <span className="name">{s.name}</span>
                    <span className="meta">{s._count.items} tasks</span>
                    <span className="status">{STATUS_LABEL[s.status] ?? s.status}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
        {totalPages > 1 && (
          <div className="pager">
            <button
              className="pager-btn"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >← Anterior</button>
            <span className="pager-info">Página {safePage} de {totalPages} · {groups.length} épicas</span>
            <button
              className="pager-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
            >Siguiente →</button>
          </div>
        )}
      </div>
      <div className="float-bar">
        <div className="float-inner">
          <span className="float-count">{selected.size} sprint{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          <Link href={multiHref} className="float-btn" aria-disabled={selected.size === 0}>Ver en la Sala de Control →</Link>
        </div>
      </div>
    </div>
  )
}
