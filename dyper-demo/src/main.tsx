// Point d'entrée React de la démo API Dyper.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './style.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Élément racine #root introuvable dans le DOM.')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
