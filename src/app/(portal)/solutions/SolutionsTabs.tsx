'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Package, Lightbulb, FolderKanban, FlaskConical, Handshake } from 'lucide-react'

export default function SolutionsTabs() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as { role?: string })?.role === 'SUPERADMIN'
  const [pending, setPending] = useState(0)

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
    { href: '/solutions/iniciativas', label: 'Iniciativas', icon: Lightbulb, exact: false },
  ]

  return (
    <div className="border-b border-gray-800 px-4 md:px-8">
      <nav className="flex gap-1">
        {tabs.map(t => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
          const Icon = t.icon
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'text-orange-400 border-orange-500'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              <Icon size={15} />
              {t.label}
              {t.href === '/solutions/iniciativas' && isSuperAdmin && pending > 0 && (
                <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {pending}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
