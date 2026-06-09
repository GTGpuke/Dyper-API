// Coquille applicative : barre latérale fixe + zone de contenu défilante.
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-ink-50 dark:bg-ink-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
