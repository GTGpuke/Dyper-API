// Section « Apparence » : langue, thème clair/sombre/système et densité d'affichage.
import { Segmented } from '../ui/Segmented'
import { SettingsCard, SettingRow } from './SettingsCard'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../contexts/I18nContext'
import { useTheme } from '../../contexts/ThemeContext'
import * as api from '../../services/api'
import type { Lang } from '../../i18n/translations'
import type { AppearanceSettings } from '../../types'

export function AppearanceSection() {
  const { settings, setSettings } = useAuth()
  const { theme, density, setTheme, setDensity } = useTheme()
  const { t, lang, setLang } = useI18n()

  // Applique immédiatement au thème local puis persiste côté serveur.
  async function persistAppearance(patch: Partial<AppearanceSettings>): Promise<void> {
    const next = await api.updateSettings({ appearance: { ...settings.appearance, ...patch } })
    setSettings(next)
  }

  // La langue pilote l'UI (immédiat) et la langue des réponses IA (persistée dans analysis.defaultLang).
  async function persistLang(l: Lang): Promise<void> {
    setLang(l)
    const next = await api.updateSettings({ analysis: { ...settings.analysis, defaultLang: l } })
    setSettings(next)
  }

  return (
    <SettingsCard title={t('settings.appearance.title')} description={t('settings.appearance.desc')}>
      <SettingRow label={t('settings.appearance.language')} hint={t('settings.appearance.languageHint')}>
        <Segmented
          value={lang}
          onChange={(l) => void persistLang(l)}
          options={[
            { value: 'fr', label: 'Français' },
            { value: 'en', label: 'English' },
          ]}
        />
      </SettingRow>

      <SettingRow label={t('settings.appearance.theme')} hint={t('settings.appearance.themeHint')}>
        <Segmented
          value={theme}
          onChange={(th) => {
            setTheme(th)
            void persistAppearance({ theme: th })
          }}
          options={[
            { value: 'light', label: t('settings.theme.light') },
            { value: 'dark', label: t('settings.theme.dark') },
            { value: 'system', label: t('settings.theme.system') },
          ]}
        />
      </SettingRow>

      <SettingRow label={t('settings.appearance.density')} hint={t('settings.appearance.densityHint')}>
        <Segmented
          value={density}
          onChange={(d) => {
            setDensity(d)
            void persistAppearance({ density: d })
          }}
          options={[
            { value: 'comfortable', label: t('settings.density.comfortable') },
            { value: 'compact', label: t('settings.density.compact') },
          ]}
        />
      </SettingRow>
    </SettingsCard>
  )
}
