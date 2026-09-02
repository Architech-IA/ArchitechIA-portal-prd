'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

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

export default function ControlIndexPage() {
  const [sprints, setSprints] = useState<SprintRow[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
        .sala-control-index {
          --bg: #f5f6fa; --surface: #ffffff; --surface-2: #eef0f7; --border: #dde1ec;
          --text: #161a26; --text-muted: #5c6478; --text-faint: #8990a4;
          --accent: #4552d6; --accent-soft: #e7e9fb;
          --shadow: 0 1px 2px rgba(20,24,38,.04), 0 8px 24px -12px rgba(20,24,38,.12);
          background: var(--bg); color: var(--text); min-height: 100vh;
          font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
          padding-bottom: 90px;
        }
        @media (prefers-color-scheme: dark) {
          .sala-control-index:not([data-theme="light"]) {
            --bg: #0a0d16; --surface: #10141f; --surface-2: #161b29; --border: #232a3d;
            --text: #e8eaf4; --text-muted: #99a1b8; --text-faint: #666f89;
            --accent: #7784ff; --accent-soft: rgba(119,132,255,.16);
            --shadow: 0 1px 2px rgba(0,0,0,.3), 0 12px 28px -14px rgba(0,0,0,.6);
          }
        }
        .sala-control-index[data-theme="dark"] {
          --bg: #0a0d16; --surface: #10141f; --surface-2: #161b29; --border: #232a3d;
          --text: #e8eaf4; --text-muted: #99a1b8; --text-faint: #666f89;
          --accent: #7784ff; --accent-soft: rgba(119,132,255,.16);
          --shadow: 0 1px 2px rgba(0,0,0,.3), 0 12px 28px -14px rgba(0,0,0,.6);
        }
        .sala-control-index * { box-sizing: border-box; }
        .sala-control-index .header { padding: 24px; border-bottom: 1px solid var(--border); background: var(--surface); display: flex; align-items: center; gap: 10px; }
        .sala-control-index .brand-mark { width: 9px; height: 9px; border-radius: 2px; background: var(--accent); display: inline-block; transform: rotate(45deg); }
        .sala-control-index h1 { font-size: 18px; font-weight: 800; margin: 0; }
        .sala-control-index .subtitle { font-size: 12.5px; color: var(--text-muted); margin-left: 4px; }
        .sala-control-index .content { padding: 20px 24px; max-width: 900px; }
        .sala-control-index .epic-group { margin-bottom: 22px; }
        .sala-control-index .epic-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .sala-control-index .epic-head label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; font-size: 13px; }
        .sala-control-index .epic-solucion { font-size: 11.5px; color: var(--text-faint); font-weight: 500; }
        .sala-control-index .list { display: grid; gap: 8px; }
        .sala-control-index .row { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow); text-decoration: none; color: var(--text); transition: transform .12s ease, border-color .12s ease; cursor: pointer; }
        .sala-control-index .row:hover { transform: translateY(-1px); }
        .sala-control-index .row.checked { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft), var(--shadow); }
        .sala-control-index .row input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); flex: none; cursor: pointer; }
        .sala-control-index .code { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 12px; color: var(--text-faint); min-width: 130px; }
        .sala-control-index .name { font-weight: 700; font-size: 13.5px; flex: 1; }
        .sala-control-index .meta { font-size: 12px; color: var(--text-muted); }
        .sala-control-index .status { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 3px 9px; border-radius: 100px; background: var(--accent-soft); color: var(--accent); white-space: nowrap; }
        .sala-control-index .empty { padding: 40px 24px; color: var(--text-muted); font-size: 13px; }
        .sala-control-index .float-bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; padding: 16px; pointer-events: none; }
        .sala-control-index .float-inner { pointer-events: auto; display: flex; align-items: center; gap: 14px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow); border-radius: 100px; padding: 8px 8px 8px 18px; }
        .sala-control-index .float-count { font-size: 12.5px; color: var(--text-muted); font-weight: 600; }
        .sala-control-index .float-btn { background: var(--accent); color: #fff; border: none; border-radius: 100px; padding: 9px 18px; font-size: 12.5px; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
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
        {groups.map((g) => {
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
