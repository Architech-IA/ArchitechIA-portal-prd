'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

interface SprintRow {
  id: string
  sprintCode: string | null
  name: string
  status: string
  epic: { name: string } | null
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

  useEffect(() => {
    fetch('/api/backlog/sprints')
      .then((r) => r.json())
      .then(setSprints)
      .catch(() => setSprints([]))
  }, [])

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
        .sala-control-index .list { padding: 20px 24px; display: grid; gap: 10px; max-width: 900px; }
        .sala-control-index .row { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow); text-decoration: none; color: var(--text); transition: transform .12s ease; }
        .sala-control-index .row:hover { transform: translateY(-1px); border-color: var(--accent); }
        .sala-control-index .code { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 12px; color: var(--text-faint); min-width: 130px; }
        .sala-control-index .name { font-weight: 700; font-size: 13.5px; flex: 1; }
        .sala-control-index .meta { font-size: 12px; color: var(--text-muted); }
        .sala-control-index .status { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 3px 9px; border-radius: 100px; background: var(--accent-soft); color: var(--accent); }
        .sala-control-index .empty { padding: 40px 24px; color: var(--text-muted); font-size: 13px; }
      `}</style>
      <header className="header">
        <span className="brand-mark" />
        <h1>Sala de Control — Sprints</h1>
      </header>
      <div className="list">
        {sprints === null && <div className="empty">Cargando…</div>}
        {sprints?.length === 0 && <div className="empty">No hay sprints todavía.</div>}
        {sprints?.map((s) => (
          <Link key={s.id} href={`/control/${s.id}`} className="row">
            <span className="code">{s.sprintCode ?? s.id.slice(0, 8)}</span>
            <span className="name">{s.name}</span>
            <span className="meta">{s.solucion?.nombre ?? '—'} · {s._count.items} tasks</span>
            <span className="status">{STATUS_LABEL[s.status] ?? s.status}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
