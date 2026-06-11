// Composant racine : routage + synchronisation des préférences serveur vers le thème/langue.
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { DocsHome } from './components/docs/DocsHome'
import { DocsLayout } from './components/docs/DocsLayout'
import { GuidePage } from './components/docs/GuidePage'
import { ReferencePage } from './components/docs/ReferencePage'
import { useAuth } from './contexts/AuthContext'
import { useI18n } from './contexts/I18nContext'
import { useTheme } from './contexts/ThemeContext'
import type { Lang } from './i18n/translations'
import { ChatPage } from './pages/ChatPage'
import { DashboardPage } from './pages/DashboardPage'
import { DetailPage } from './pages/DetailPage'
import { HistoryPage } from './pages/HistoryPage'
import { LoginPage } from './pages/LoginPage'
import { PricingPage } from './pages/PricingPage'
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
        {/* Documentation publique (accessible sans compte) : accueil, guides et référence API. */}
        <Route path="/api-docs" element={<DocsLayout />}>
          <Route index element={<DocsHome />} />
          <Route path="guide/:guideId" element={<GuidePage />} />
          <Route path="reference/:sectionId" element={<ReferencePage />} />
          <Route path="*" element={<Navigate to="/api-docs" replace />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {/* Route unique du chat : « / », « /c » et « /c/:conversationId ». */}
            <Route path="c?/:conversationId?" element={<ChatPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="analysis/:id" element={<DetailPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/:section" element={<SettingsPage />} />
            <Route path="pricing" element={<PricingPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
