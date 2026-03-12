// Point d'entrée de l'application React : monte le composant App dans le nœud DOM racine.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Élément racine #root introuvable dans le DOM.')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
