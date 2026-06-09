// Composant racine : routage + synchronisation des préférences serveur vers le thème.
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { useAuth } from './contexts/AuthContext'
import { useI18n } from './contexts/I18nContext'
import { useTheme } from './contexts/ThemeContext'
import type { Lang } from './i18n/translations'
import { AnalyzerPage } from './pages/AnalyzerPage'
import { DashboardPage } from './pages/DashboardPage'
import { DetailPage } from './pages/DetailPage'
import { HistoryPage } from './pages/HistoryPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { SettingsPage } from './pages/SettingsPage'

// Applique les préférences du compte (source de vérité) au thème et à la langue après connexion.
function PreferencesSync() {
  const { user, settings } = useAuth()
  const { setTheme, setDensity } = useTheme()
  const { setLang } = useI18n()

  useEffect(() => {
    if (!user) return
    setTheme(settings.appearance.theme)
    setDensity(settings.appearance.density)
    setLang(settings.analysis.defaultLang as Lang)
  }, [
    user,
    settings.appearance.theme,
    settings.appearance.density,
    settings.analysis.defaultLang,
    setTheme,
    setDensity,
    setLang,
  ])

  return null
}

export function App() {
  return (
    <>
      <PreferencesSync />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<AnalyzerPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="analysis/:id" element={<DetailPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/:section" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
