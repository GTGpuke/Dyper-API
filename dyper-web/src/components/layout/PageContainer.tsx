// Conteneur de page standard : zone défilante centrée (Historique, Détail, Dashboard, Paramètres).
// La page de chat gère son propre défilement et n'utilise pas ce conteneur.
import type { ReactNode } from 'react'

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10">{children}</div>
    </div>
  )
}
