// Barre latérale de navigation principale + bloc utilisateur.
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../contexts/I18nContext'
import { cn } from '../../lib/cn'
import { HealthBadge } from './HealthBadge'

interface NavItem {
  to: string
  labelKey: string
  icon: ReactNode
}

const NAV: NavItem[] = [
  { to: '/', labelKey: 'nav.analyze', icon: <path d="M4 4h6v6H4V4zm0 10h6v6H4v-6zM14 4h6v6h-6V4zm0 10h6v6h-6v-6z" /> },
  { to: '/history', labelKey: 'nav.history', icon: <path d="M12 8v4l3 3M3 12a9 9 0 1 0 9-9 9 9 0 0 0-9 9z" /> },
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: <path d="M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z" /> },
  { to: '/settings', labelKey: 'nav.settings', icon: <path d="M10.3 3.2a1 1 0 0 1 3.4 0l.2.9a7 7 0 0 1 1.7 1l.9-.3a1 1 0 0 1 1.2.5l1 1.7a1 1 0 0 1-.3 1.3l-.7.5a7 7 0 0 1 0 2l.7.5a1 1 0 0 1 .3 1.3l-1 1.7a1 1 0 0 1-1.2.5l-.9-.3a7 7 0 0 1-1.7 1l-.2.9a1 1 0 0 1-3.4 0l-.2-.9a7 7 0 0 1-1.7-1l-.9.3a1 1 0 0 1-1.2-.5l-1-1.7a1 1 0 0 1 .3-1.3l.7-.5a7 7 0 0 1 0-2l-.7-.5a1 1 0 0 1-.3-1.3l1-1.7a1 1 0 0 1 1.2-.5l.9.3a7 7 0 0 1 1.7-1l.2-.9zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /> },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  async function handleLogout(): Promise<void> {
    await logout()
    navigate('/login')
  }

  const initial = (user?.displayName || user?.email || '?').charAt(0).toUpperCase()

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-ink-200 bg-white px-4 py-5 dark:border-ink-800 dark:bg-ink-900">
      {/* Logo. */}
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" strokeLinecap="round" />
          </svg>
        </div>
        <div className="leading-tight">
          <p className="font-bold tracking-tight text-ink-900 dark:text-ink-50">Dyper</p>
          <p className="text-[11px] text-ink-400 dark:text-ink-500">{t('nav.tagline')}</p>
        </div>
      </div>

      {/* Navigation. */}
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300'
                  : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
              )
            }
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {item.icon}
            </svg>
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      {/* Pied : santé des services + utilisateur. */}
      <div className="mt-auto flex flex-col gap-3 pt-4">
        <HealthBadge />
        <div className="flex items-center gap-2.5 rounded-xl border border-ink-200 p-2 dark:border-ink-800">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
              {initial}
            </span>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">
              {user?.displayName || t('nav.account')}
            </p>
            <p className="truncate text-[11px] text-ink-400 dark:text-ink-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
            aria-label={t('nav.logout')}
            title={t('nav.logout')}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
