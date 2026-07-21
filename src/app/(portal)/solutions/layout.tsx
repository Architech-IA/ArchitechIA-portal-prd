'use client'

import { usePathname } from 'next/navigation'
import SolutionsTabs from './SolutionsTabs'

export default function SolutionsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPocDetail = /^\/solutions\/pilots\/[^/]+$/.test(pathname || '')
  return (
    <div>
      {!isPocDetail && <SolutionsTabs />}
      {children}
    </div>
  )
}
