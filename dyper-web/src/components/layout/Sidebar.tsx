// Barre latérale (inspiration claude.ai) : nouvelle conversation, navigation à libellés
// (documentation API incluse), conversations récentes, forfait et menu du profil.
import { useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../contexts/I18nContext'
import { useHealth } from '../../hooks/useHealth'
import { usePlan } from '../../hooks/usePlan'
import { cn } from '../../lib/cn'
import logo from '../../assets/dyper-logo.svg'
import { ConversationList } from '../chat/ConversationList'
import { UserMenu } from './UserMenu'

interface NavItem {
  to: string
  labelKey: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/history',
    labelKey: 'nav.history',
    icon: <path d="M12 8v4l3 3M3 12a9 9 0 1 0 9-9 9 9 0 0 0-9 9z" />,
  },
  {
    to: '/global',
    labelKey: 'nav.global',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
      </>
    ),
  },
  {
    to: '/status',
    labelKey: 'nav.status',
    icon: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  },
  // Les Paramètres vivent dans le menu du profil (bloc utilisateur), pas dans la navigation.
  {
    to: '/api-docs',
    labelKey: 'nav.docs.full',
    icon: <path d="M8 4l-5 8 5 8M16 4l5 8-5 8" />,
  },
]

// Pastille de statut live affichée sur l'onglet Statut (vert/orange/rouge, gris si inconnu).
function StatusDot() {
  const health = useHealth()
  const { t } = useI18n()
  const tone = !health
    ? 'unknown'
    : health.status !== 'ok' || health.db !== 'ok'
      ? 'down'
      : health.ai !== 'ok'
        ? 'partial'
        : 'ok'
  const cls = {
    ok: 'bg-emerald-500',
    partial: 'bg-amber-400',
    down: 'bg-red-500',
    unknown: 'bg-ink-300 dark:bg-ink-600',
  }[tone]
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', cls)} title={t('nav.status')} />
}

// Rangée de navigation : icône + libellé (style claude.ai), avec élément de fin optionnel.
function NavRow({ item, label, trailing }: { item: NavItem; label: string; trailing?: ReactNode }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-ink-100 font-medium text-ink-900 dark:bg-ink-800/80 dark:text-ink-50'
            : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800/60 dark:hover:text-ink-100'
        )
      }
    >
      <svg
        className="h-[18px] w-[18px] shrink-0 text-ink-400 dark:text-ink-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {item.icon}
      </svg>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </NavLink>
  )
}

export function Sidebar() {
  const { user } = useAuth()
  const { t } = useI18n()
  const { plan } = usePlan()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const initial = (user?.displayName || user?.email || '?').charAt(0).toUpperCase()

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-ink-200 bg-ink-50 px-3 py-4 dark:border-ink-800 dark:bg-ink-950">
      {/* Logo. */}
      <Link to="/" className="mb-3 flex items-center gap-2.5 px-2">
        <img src={logo} alt="" className="h-9 w-9 rounded-xl object-contain" />
        <p className="font-bold tracking-tight text-ink-900 dark:text-ink-50">Dyper AI</p>
      </Link>

      {/* Nouvelle conversation (rangée, style claude.ai). */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-2 flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-400/10"
      >
        <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-white">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </span>
        {t('chat.new')}
      </button>

      {/* Navigation à libellés. */}
      <nav className="flex flex-col gap-0.5 border-b border-ink-200/70 pb-3 dark:border-ink-800/70">
        {NAV_ITEMS.map((item) => (
          <NavRow
            key={item.to}
            item={item}
            label={t(item.labelKey)}
            trailing={item.to === '/status' ? <StatusDot /> : undefined}
          />
        ))}
      </nav>

      {/* Récents : liste des conversations (zone défilante principale). */}
      <p className="eyebrow mt-3 px-2.5 pb-1.5">{t('sidebar.recents')}</p>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <ConversationList />
      </div>

      {/* Pied : mise à niveau, bloc utilisateur avec forfait. */}
      <div className="mt-3 flex flex-col gap-2 border-t border-ink-200/70 pt-3 dark:border-ink-800/70">
        {plan === 'free' && (
          <Link
            to="/pricing"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-card transition-all hover:shadow-card-hover hover:brightness-110"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.4 6.2L21 9l-5 4.3 1.6 6.7L12 16.5 6.4 20l1.6-6.7L3 9l6.6-.8L12 2z" />
            </svg>
            {t('pricing.upgrade')}
          </Link>
        )}

        {/* Bloc utilisateur : ouvre le menu du profil (paramètres, langue, thème, abonnement…). */}
        <div className="relative">
          <UserMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors',
              menuOpen
                ? 'bg-ink-100 dark:bg-ink-800/70'
                : 'hover:bg-ink-100/70 dark:hover:bg-ink-800/50'
            )}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500/20 to-violet-600/20 text-sm font-semibold text-violet-700 dark:text-violet-300">
                {initial}
              </span>
            )}
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-ink-800 dark:text-ink-100">
                {user?.displayName || t('nav.account')}
              </span>
              <span className="block truncate text-[11px] text-ink-400 dark:text-ink-500">
                {t(`pricing.${plan}.label`)}
              </span>
            </span>
            <svg
              className="h-4 w-4 shrink-0 text-ink-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 9l5-5 5 5M7 15l5 5 5-5" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
