// Garde de routes : redirige vers /login si non authentifié, affiche un loader pendant la
// restauration de session.
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Spinner } from '../ui/Spinner'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid h-screen place-items-center bg-ink-50 dark:bg-ink-900">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}
