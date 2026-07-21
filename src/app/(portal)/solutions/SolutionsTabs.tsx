'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Package, Lightbulb, FolderKanban, FlaskConical, Handshake, Building2 } from 'lucide-react'
import { usePageActions } from '@/lib/pageActionsContext'

export default function SolutionsTabs() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as { role?: string })?.role === 'SUPERADMIN'
  const [pending, setPending] = useState(0)
  const { setActions } = usePageActions()

  useEffect(() => {
    if (!isSuperAdmin) return
    let active = true
    fetch('/api/iniciativas/delete-requests')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (active) setPending(Array.isArray(d) ? d.length : 0) })
      .catch(() => {})
    return () => { active = false }
  }, [isSuperAdmin, pathname])

  const tabs = [
    { href: '/solutions', label: 'Productos', icon: Package, exact: true },
    { href: '/solutions/projects', label: 'Projects', icon: FolderKanban, exact: false },
    { href: '/solutions/pilots', label: 'Pilots', icon: FlaskConical, exact: false },
    { href: '/solutions/partnership', label: 'Partnership', icon: Handshake, exact: false },
    { href: '/solutions/intern', label: 'Intern', icon: Building2, exact: false },
    { href: '/solutions/iniciativas', label: 'Iniciativas', icon: Lightbulb, exact: false },
  ]

  useEffect(() => {
    setActions(
      <nav className="flex items-center gap-0.5">
        {tabs.map(t => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
          const Icon = t.icon
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: active ? 600 : 400,
                color: active ? '#f97316' : '#9ca3af',
                background: active ? 'rgba(249,115,22,0.12)' : 'transparent',
                textDecoration: 'none',
                transition: 'color 0.15s, background 0.15s',
                whiteSpace: 'nowrap' as const,
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = '#d1d5db'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = '#9ca3af'
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                }
              }}
            >
              <Icon size={12} />
              {t.label}
              {t.href === '/solutions/iniciativas' && isSuperAdmin && pending > 0 && (
                <span style={{
                  minWidth: '16px', height: '16px', padding: '0 3px',
                  borderRadius: '8px', background: '#ef4444', color: '#fff',
                  fontSize: '9px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {pending}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    )
    return () => setActions(null)
  }, [pathname, isSuperAdmin, pending])

  return null
}
