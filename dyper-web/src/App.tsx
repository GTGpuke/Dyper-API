// Composant racine : routage + synchronisation des préférences serveur vers le thème/langue.
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { LoadingScreen } from './components/feedback/LoadingScreen'
import { AppLayout } from './components/layout/AppLayout'
import { DocsHome } from './components/docs/DocsHome'
import { DocsLayout } from './components/docs/DocsLayout'
import { GuidePage } from './components/docs/GuidePage'
import { ReferencePage } from './components/docs/ReferencePage'
import { WhitePaperPage } from './components/docs/WhitePaperPage'
import { useAuth } from './contexts/AuthContext'
import { useI18n } from './contexts/I18nContext'
import { useTheme } from './contexts/ThemeContext'
import type { Lang } from './i18n/translations'
import { ChatPage } from './pages/ChatPage'
import { DetailPage } from './pages/DetailPage'
import { DevelopersPage } from './pages/DevelopersPage'
import { GlobalPage } from './pages/GlobalPage'
import { HistoryPage } from './pages/HistoryPage'
import { LoginPage } from './pages/LoginPage'
import { MaintenancePage } from './pages/MaintenancePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PricingPage } from './pages/PricingPage'
import { PublicationDetailPage } from './pages/PublicationDetailPage'
import { PublicPublicationPage } from './pages/PublicPublicationPage'
import { RegisterPage } from './pages/RegisterPage'
import { SettingsPage } from './pages/SettingsPage'
import { StatusPage } from './pages/StatusPage'

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

// Écran d'état pleine page qui court-circuite toute l'application. Trois valeurs possibles :
//
//   • null            → fonctionnement NORMAL (valeur par défaut). L'écran de chargement réel
//                        s'affiche quand même automatiquement pendant la restauration de session
//                        (cf. ProtectedRoute) ; inutile d'y toucher au quotidien.
//   • 'maintenance'   → coupe TOUTE l'application et affiche la page de maintenance (à utiliser
//                        pendant une intervention ; aucune route n'est servie).
//   • 'loading'       → affiche en continu l'écran de chargement (utile pour le PRÉVISUALISER en
//                        développement, car en conditions réelles il ne dure que le temps du
//                        bootstrap). À remettre à null ensuite.
const APP_SCREEN: 'loading' | 'maintenance' | null = null

export function App() {
  if (APP_SCREEN === 'maintenance') return <MaintenancePage />
  if (APP_SCREEN === 'loading') return <LoadingScreen />

  return (
    <>
      <PreferencesSync />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* Page publique d'une publication partagée (accessible sans compte). */}
        <Route path="/p/:slug" element={<PublicPublicationPage />} />
        {/* Documentation publique (accessible sans compte) : accueil, guides et référence API. */}
        <Route path="/api-docs" element={<DocsLayout />}>
          <Route index element={<DocsHome />} />
          <Route path="guide/:guideId" element={<GuidePage />} />
          <Route path="reference/:sectionId" element={<ReferencePage />} />
          <Route path="whitepaper" element={<WhitePaperPage />} />
          <Route path="developers" element={<DevelopersPage />} />
          <Route path="*" element={<Navigate to="/api-docs" replace />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {/* Chat : « /c » (nouvelle) et « /c/:conversationId » partagent le même composant (pas
                de remontage). « / » redirige vers « /c ». Les chemins inconnus tombent sur la 404. */}
            <Route index element={<Navigate to="/c" replace />} />
            <Route path="c/:conversationId?" element={<ChatPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="analysis/:id" element={<DetailPage />} />
            <Route path="global" element={<GlobalPage />} />
            <Route path="global/:id" element={<PublicationDetailPage />} />
            <Route path="status" element={<StatusPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/:section" element={<SettingsPage />} />
            <Route path="pricing" element={<PricingPage />} />
          </Route>
        </Route>

        {/* Toute route inconnue : page 404. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
