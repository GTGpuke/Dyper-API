// Menu du profil (inspiration claude.ai) : ouvert depuis le bloc utilisateur de la sidebar.
// E-mail, Paramètres, Langue et Thème (persistés), abonnement et déconnexion.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../contexts/I18nContext'
import { useTheme } from '../../contexts/ThemeContext'
import { usePlan } from '../../hooks/usePlan'
import type { Lang } from '../../i18n/translations'
import { cn } from '../../lib/cn'
import * as api from '../../services/api'

type Submenu = 'lang' | 'theme' | null

const LANGS: Array<{ id: Lang; label: string }> = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
]

const THEMES = ['light', 'dark', 'system'] as const

// Rangée de menu générique (icône + libellé + contenu optionnel à droite).
function MenuRow({
  icon,
  label,
  onClick,
  trailing,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800"
    >
      <svg
        className="h-[18px] w-[18px] shrink-0 text-ink-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon}
      </svg>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  )
}

// Coche de sélection des sous-menus.
function Check({ visible }: { visible: boolean }) {
  return visible ? (
    <svg className="h-4 w-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <span className="h-4 w-4" />
  )
}

export function UserMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, settings, setSettings, logout } = useAuth()
  const { t, lang } = useI18n()
  const { theme } = useTheme()
  const { plan } = usePlan()
  const navigate = useNavigate()
  const [submenu, setSubmenu] = useState<Submenu>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fermeture au clic extérieur et à Échap.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) setSubmenu(null)
  }, [open])

  // Persiste la langue côté compte (PreferencesSync l'applique ensuite partout).
  async function chooseLang(next: Lang): Promise<void> {
    onClose()
    const merged = await api.updateSettings({
      analysis: { ...settings.analysis, defaultLang: next },
    })
    setSettings(merged)
  }

  // Persiste le thème côté compte.
  async function chooseTheme(next: (typeof THEMES)[number]): Promise<void> {
    onClose()
    const merged = await api.updateSettings({
      appearance: { ...settings.appearance, theme: next },
    })
    setSettings(merged)
  }

  function go(path: string): void {
    onClose()
    navigate(path)
  }

  async function handleLogout(): Promise<void> {
    onClose()
    await logout()
    navigate('/login')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: 0.14 }}
          className="absolute bottom-full left-0 right-0 z-30 mb-2 origin-bottom rounded-2xl border border-ink-200 bg-white p-1.5 shadow-card-hover dark:border-ink-700 dark:bg-ink-900"
          role="menu"
        >
          {/* E-mail du compte. */}
          <p className="truncate px-2.5 pb-1.5 pt-1 text-xs text-ink-400 dark:text-ink-500">
            {user?.email}
          </p>
          <div className="mb-1 border-t border-ink-100 dark:border-ink-800" />

          <MenuRow
            icon={
              <path d="M10.3 3.2a1 1 0 0 1 3.4 0l.2.9a7 7 0 0 1 1.7 1l.9-.3a1 1 0 0 1 1.2.5l1 1.7a1 1 0 0 1-.3 1.3l-.7.5a7 7 0 0 1 0 2l.7.5a1 1 0 0 1 .3 1.3l-1 1.7a1 1 0 0 1-1.2.5l-.9-.3a7 7 0 0 1-1.7 1l-.2.9a1 1 0 0 1-3.4 0l-.2-.9a7 7 0 0 1-1.7-1l-.9.3a1 1 0 0 1-1.2-.5l-1-1.7a1 1 0 0 1 .3-1.3l.7-.5a7 7 0 0 1 0-2l-.7-.5a1 1 0 0 1-.3-1.3l1-1.7a1 1 0 0 1 1.2-.5l.9.3a7 7 0 0 1 1.7-1l.2-.9zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            }
            label={t('nav.settings')}
            onClick={() => go('/settings')}
          />

          {/* Langue (sous-menu déplié en place). */}
          <MenuRow
            icon={
              <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
            }
            label={t('settings.appearance.language')}
            onClick={() => setSubmenu(submenu === 'lang' ? null : 'lang')}
            trailing={
              <svg className={cn('h-4 w-4 text-ink-400 transition-transform', submenu === 'lang' && 'rotate-90')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          {submenu === 'lang' &&
            LANGS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => void chooseLang(option.id)}
                className="flex w-full items-center gap-2.5 rounded-lg py-1.5 pl-10 pr-2.5 text-left text-sm text-ink-600 transition-colors hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                <span className="min-w-0 flex-1">{option.label}</span>
                <Check visible={lang === option.id} />
              </button>
            ))}

          {/* Thème (sous-menu déplié en place). */}
          <MenuRow
            icon={<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />}
            label={t('settings.appearance.theme')}
            onClick={() => setSubmenu(submenu === 'theme' ? null : 'theme')}
            trailing={
              <svg className={cn('h-4 w-4 text-ink-400 transition-transform', submenu === 'theme' && 'rotate-90')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          {submenu === 'theme' &&
            THEMES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => void chooseTheme(option)}
                className="flex w-full items-center gap-2.5 rounded-lg py-1.5 pl-10 pr-2.5 text-left text-sm text-ink-600 transition-colors hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                <span className="min-w-0 flex-1">{t(`settings.theme.${option}`)}</span>
                <Check visible={theme === option} />
              </button>
            ))}

          <div className="my-1 border-t border-ink-100 dark:border-ink-800" />

          <MenuRow
            icon={<path d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9zM12 8v8M8.5 11.5L12 8l3.5 3.5" />}
            label={plan === 'free' ? t('userMenu.upgrade') : t('userMenu.manage')}
            onClick={() => go('/pricing')}
          />

          <div className="my-1 border-t border-ink-100 dark:border-ink-800" />

          <MenuRow
            icon={<path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />}
            label={t('nav.logout')}
            onClick={() => void handleLogout()}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
