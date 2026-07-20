'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const PageActionsContext = createContext<{
  actions: React.ReactNode | null
  setActions: (a: React.ReactNode | null) => void
}>({ actions: null, setActions: () => {} })

export function PageActionsProvider({ children }: { children: React.ReactNode }) {
  const [actions, setActions] = useState<React.ReactNode | null>(null)
  return (
    <PageActionsContext.Provider value={{ actions, setActions }}>
      {children}
    </PageActionsContext.Provider>
  )
}

export function usePageActions() {
  return useContext(PageActionsContext)
}

export function useSetPageActions(actions: React.ReactNode | null) {
  const { setActions } = usePageActions()
  useEffect(() => {
    setActions(actions)
    return () => setActions(null)
  }, [])
}
