'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const PageTitleContext = createContext<{ title: string | null; setTitle: (t: string | null) => void; onBack: (() => void) | null; setBack: (f: (() => void) | null) => void }>({
  title: null,
  setTitle: () => {},
  onBack: null,
  setBack: () => {},
})

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null)
  // Una página puede pedir una flecha de volver junto al título (el editor de documentos la usa).
  const [onBack, setOnBack] = useState<(() => void) | null>(null)
  const setBack = useCallback((f: (() => void) | null) => setOnBack(() => f), [])
  return (
    <PageTitleContext.Provider value={{ title, setTitle, onBack, setBack }}>
      {children}
    </PageTitleContext.Provider>
  )
}

export function usePageTitleOverride() {
  return useContext(PageTitleContext)
}

/** Las páginas que cargan su propio nombre por id lo anuncian con este hook,
 *  para que el TopBar lo muestre en vez del id crudo de la URL. Se limpia solo al desmontar. */
export function useSetPageTitle(title: string | null) {
  const { setTitle } = usePageTitleOverride()
  useEffect(() => {
    setTitle(title)
    return () => setTitle(null)
  }, [title, setTitle])
}
