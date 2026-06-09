// Point d'entrée de l'application React : providers (thème, auth) + routeur.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { AuthProvider } from './contexts/AuthContext'
import { I18nProvider } from './contexts/I18nContext'
import { ThemeProvider } from './contexts/ThemeContext'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Élément racine #root introuvable dans le DOM.')

createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>
)
