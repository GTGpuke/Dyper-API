// Coquille applicative : sidebar fixe (desktop) ou tiroir (mobile) + zone de contenu.
// Chaque page gère son propre défilement (PageContainer ou fil de chat).
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ConversationsProvider } from '../../contexts/ConversationsContext'
import { useI18n } from '../../contexts/I18nContext'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const { t } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Le tiroir mobile se referme à chaque navigation et sur Échap.
  useEffect(() => {
    setSidebarOpen(false)
  }, [location])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  return (
    <ConversationsProvider>
      <div className="flex h-screen overflow-hidden bg-ink-50 dark:bg-ink-900">
        {/* Sidebar fixe (desktop). */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Tiroir mobile. */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.button
                type="button"
                className="fixed inset-0 z-40 bg-black/40 md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                aria-label={t('sidebar.closeMenu')}
              />
              <motion.div
                className="fixed inset-y-0 left-0 z-50 md:hidden"
                initial={{ x: -288 }}
                animate={{ x: 0 }}
                exit={{ x: -288 }}
                transition={{ type: 'tween', duration: 0.2 }}
              >
                <Sidebar />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Colonne principale : barre mobile + contenu. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 bg-white px-4 dark:border-ink-800 dark:bg-ink-900 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
              aria-label={t('sidebar.openMenu')}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link to="/" className="font-bold tracking-tight text-ink-900 dark:text-ink-50">
              Dyper
            </Link>
          </header>

          <main className="min-h-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </ConversationsProvider>
  )
}
