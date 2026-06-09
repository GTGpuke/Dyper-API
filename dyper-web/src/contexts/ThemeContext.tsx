// Contexte de thème : gère le mode clair/sombre et la densité, persistés en localStorage
// et appliqués sur <html>. Fonctionne sans authentification (page de connexion incluse).
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppearanceSettings } from '../types'

type Theme = AppearanceSettings['theme']
type Density = AppearanceSettings['density']

interface ThemeContextValue {
  theme: Theme
  density: Density
  setTheme: (t: Theme) => void
  setDensity: (d: Density) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const THEME_KEY = 'dyper-theme'
const DENSITY_KEY = 'dyper-density'

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

// Applique (ou retire) la classe `dark` sur <html> selon le thème résolu.
function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && prefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

function applyDensity(density: Density): void {
  document.documentElement.classList.toggle('density-compact', density === 'compact')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme | null) ?? 'system'
  )
  const [density, setDensityState] = useState<Density>(
    () => (localStorage.getItem(DENSITY_KEY) as Density | null) ?? 'comfortable'
  )

  // Applique le thème et réagit aux changements de préférence système (mode « system »).
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  useEffect(() => {
    applyDensity(density)
  }, [density])

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(THEME_KEY, t)
    setThemeState(t)
  }, [])

  const setDensity = useCallback((d: Density) => {
    localStorage.setItem(DENSITY_KEY, d)
    setDensityState(d)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, density, setTheme, setDensity }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme doit être utilisé dans un ThemeProvider.')
  return ctx
}
