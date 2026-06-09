// Page de connexion.
import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthShell, Field } from '../components/auth/AuthShell'
import { Button } from '../components/ui/Button'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import type { ApiError } from '../types'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError((err as ApiError).message ?? t('auth.login.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            {t('auth.login.create')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <ErrorBanner error={error} />}
        <Field
          label={t('auth.field.email')}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label={t('auth.field.password')}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={submitting} className="mt-2 w-full">
          {t('auth.login.submit')}
        </Button>
      </form>
    </AuthShell>
  )
}
