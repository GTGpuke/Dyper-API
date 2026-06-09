// Section « Préférences d'analyse » : valeurs par défaut appliquées dans l'analyzer.
import { Segmented } from '../ui/Segmented'
import { SettingsCard, SettingRow } from './SettingsCard'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../contexts/I18nContext'
import * as api from '../../services/api'
import type { AnalysisSettings } from '../../types'

export function AnalysisPrefsSection() {
  const { settings, setSettings } = useAuth()
  const { t } = useI18n()

  async function persist(patch: Partial<AnalysisSettings>): Promise<void> {
    const next = await api.updateSettings({ analysis: { ...settings.analysis, ...patch } })
    setSettings(next)
  }

  return (
    <SettingsCard title={t('settings.analysis.title')} description={t('settings.analysis.desc')}>
      <SettingRow
        label={t('settings.analysis.defaultType')}
        hint={t('settings.analysis.defaultTypeHint')}
      >
        <Segmented
          value={settings.analysis.defaultType}
          onChange={(v) => void persist({ defaultType: v })}
          options={[
            { value: 'file', label: t('input.tab.file') },
            { value: 'url', label: t('input.tab.url') },
            { value: 'prompt', label: t('input.tab.prompt') },
          ]}
        />
      </SettingRow>
    </SettingsCard>
  )
}
