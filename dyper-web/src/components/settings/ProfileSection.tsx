// Section « Profil & sécurité » : informations du compte, mot de passe, sessions, déconnexion.
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field } from '../auth/AuthShell'
import { Button } from '../ui/Button'
import { ErrorBanner } from '../ui/ErrorBanner'
import { SettingsCard, SettingRow } from './SettingsCard'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../contexts/I18nContext'
import * as api from '../../services/api'
import type { ApiError, SessionInfo } from '../../types'

export function ProfileSection() {
  const { user, setUser, logout } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '')
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdMsg, setPwdMsg] = useState<string | null>(null)
  const [savingPwd, setSavingPwd] = useState(false)

  const [sessions, setSessions] = useState<SessionInfo[]>([])

  useEffect(() => {
    api.getSessions().then(setSessions).catch(() => undefined)
  }, [])

  async function saveProfile(e: FormEvent): Promise<void> {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      const updated = await api.updateProfile({ displayName, bio, avatarUrl })
      setUser(updated)
      setProfileMsg(t('settings.profile.saved'))
    } catch {
      setProfileMsg(t('settings.profile.saveError'))
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(e: FormEvent): Promise<void> {
    e.preventDefault()
    setPwdError(null)
    setPwdMsg(null)
    if (newPassword.length < 8) {
      setPwdError(t('settings.pw.tooShort'))
      return
    }
    setSavingPwd(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setPwdMsg(t('settings.pw.saved'))
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setPwdError((err as ApiError).message ?? t('settings.pw.error'))
    } finally {
      setSavingPwd(false)
    }
  }

  async function handleLogout(): Promise<void> {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard title={t('settings.profile.title')} description={t('settings.profile.desc')}>
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">{t('auth.field.email')}</span>
            <p className="rounded-xl bg-ink-50 px-4 py-2.5 text-sm text-ink-500 dark:bg-ink-800 dark:text-ink-400">
              {user?.email}
            </p>
          </div>
          <Field label={t('settings.profile.displayName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Field label={t('settings.profile.avatar')} value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">{t('settings.profile.bio')}</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50"
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={savingProfile}>{t('settings.profile.save')}</Button>
            {profileMsg && <span className="text-sm text-ink-500 dark:text-ink-400">{profileMsg}</span>}
          </div>
        </form>
      </SettingsCard>

      <SettingsCard title={t('settings.pw.title')} description={t('settings.pw.desc')}>
        <form onSubmit={savePassword} className="flex flex-col gap-4">
          {pwdError && <ErrorBanner error={pwdError} />}
          <Field
            label={t('settings.pw.current')}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Field
            label={t('settings.pw.new')}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" loading={savingPwd}>{t('settings.pw.submit')}</Button>
            {pwdMsg && <span className="text-sm text-emerald-600">{pwdMsg}</span>}
          </div>
        </form>
      </SettingsCard>

      <SettingsCard title={t('settings.sessions.title')} description={t('settings.sessions.desc')}>
        {sessions.map((s, i) => (
          <SettingRow
            key={i}
            label={s.current ? t('settings.sessions.current') : t('settings.sessions.other')}
            hint={s.userAgent ?? s.ip}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </SettingRow>
        ))}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => api.revokeAllSessions().then(() => undefined)}
          >
            {t('settings.sessions.revoke')}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            {t('nav.logout')}
          </Button>
        </div>
      </SettingsCard>
    </div>
  )
}
