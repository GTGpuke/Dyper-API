// Section « Données & confidentialité » : export, purge de l'historique, suppression du compte.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field } from '../auth/AuthShell'
import { Button } from '../ui/Button'
import { ErrorBanner } from '../ui/ErrorBanner'
import { SettingsCard } from './SettingsCard'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../contexts/I18nContext'
import * as api from '../../services/api'
import type { ApiError } from '../../types'

export function PrivacySection() {
  const { logout } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [password, setPassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleExport(): Promise<void> {
    setBusy('export')
    try {
      const blob = await api.exportData()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'dyper-export.json'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(null)
    }
  }

  async function handlePurge(): Promise<void> {
    setBusy('purge')
    setMsg(null)
    try {
      const deleted = await api.purgeHistory()
      setMsg(t('settings.purge.done', { n: deleted }))
      setConfirmPurge(false)
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(): Promise<void> {
    setBusy('delete')
    setDeleteError(null)
    try {
      await api.deleteAccount(password)
      await logout()
      navigate('/login')
    } catch (err) {
      setDeleteError((err as ApiError).message ?? t('settings.delete.error'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard title={t('settings.export.title')} description={t('settings.export.desc')}>
        <Button variant="secondary" onClick={handleExport} loading={busy === 'export'}>
          {t('settings.export.btn')}
        </Button>
      </SettingsCard>

      <SettingsCard title={t('settings.purge.title')} description={t('settings.purge.desc')}>
        {msg && <p className="mb-3 text-sm text-emerald-600">{msg}</p>}
        {confirmPurge ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink-600 dark:text-ink-300">{t('settings.purge.confirm')}</span>
            <Button variant="secondary" size="sm" onClick={() => setConfirmPurge(false)}>{t('common.cancel')}</Button>
            <Button size="sm" loading={busy === 'purge'} onClick={handlePurge} className="bg-red-600 hover:bg-red-700">
              {t('settings.purge.yes')}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmPurge(true)}>{t('settings.purge.btn')}</Button>
        )}
      </SettingsCard>

      <SettingsCard title={t('settings.delete.title')} description={t('settings.delete.desc')} danger>
        {confirmDelete ? (
          <div className="flex flex-col gap-3">
            {deleteError && <ErrorBanner error={deleteError} />}
            <Field
              label={t('settings.delete.confirmLabel')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
              <Button
                size="sm"
                loading={busy === 'delete'}
                disabled={!password}
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-300"
              >
                {t('settings.delete.confirm')}
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setConfirmDelete(true)} className="bg-red-600 hover:bg-red-700">
            {t('settings.delete.btn')}
          </Button>
        )}
      </SettingsCard>
    </div>
  )
}
