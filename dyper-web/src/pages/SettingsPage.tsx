// Page Paramètres : navigation par sous-section + rendu de la section active.
import { NavLink, useParams } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { PageHeader } from '../components/layout/PageHeader'
import { AppearanceSection } from '../components/settings/AppearanceSection'
import { PrivacySection } from '../components/settings/PrivacySection'
import { ProfileSection } from '../components/settings/ProfileSection'
import { useI18n } from '../contexts/I18nContext'
import { cn } from '../lib/cn'

const TABS = [
  { id: 'profile', key: 'settings.tab.profile' },
  { id: 'appearance', key: 'settings.tab.appearance' },
  { id: 'privacy', key: 'settings.tab.privacy' },
] as const

export function SettingsPage() {
  const { t } = useI18n()
  const { section } = useParams<{ section?: string }>()
  const active = section ?? 'profile'

  return (
    <PageContainer>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      {/* Navigation des sous-sections. */}
      <nav className="mb-8 flex flex-wrap gap-1 border-b border-ink-200 dark:border-ink-800">
        {TABS.map((tab) => (
          <NavLink
            key={tab.id}
            to={`/settings/${tab.id}`}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              active === tab.id
                ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200'
            )}
          >
            {t(tab.key)}
          </NavLink>
        ))}
      </nav>

      {active === 'profile' && <ProfileSection />}
      {active === 'appearance' && <AppearanceSection />}
      {active === 'privacy' && <PrivacySection />}
    </PageContainer>
  )
}
