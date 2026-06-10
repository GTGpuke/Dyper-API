// Bandeau d'erreur cohérent avec le format d'erreur API { code, message }.
import type { ApiError } from '../../types'

export function ErrorBanner({ error }: { error: ApiError | string }) {
  const message = typeof error === 'string' ? error : error.message
  const code = typeof error === 'string' ? undefined : error.code

  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <svg className="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-5a1 1 0 100 2 1 1 0 000-2z"
          clipRule="evenodd"
        />
      </svg>
      <div>
        <p className="font-medium">{message}</p>
        {code && <p className="mt-0.5 font-mono text-xs text-red-500">{code}</p>}
      </div>
    </div>
  )
}
