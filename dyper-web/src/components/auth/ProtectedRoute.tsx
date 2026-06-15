// Garde de routes : redirige vers /login si non authentifié, affiche l'écran de chargement animé
// pendant la restauration de session.
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LoadingScreen } from '../feedback/LoadingScreen'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />

  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}
