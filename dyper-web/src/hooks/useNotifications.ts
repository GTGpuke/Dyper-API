// Notifications navigateur (Web Notifications API) : permission + envoi. Permet de prévenir
// l'utilisateur quand un traitement se termine alors qu'il n'est plus sur la conversation concernée.
import { useCallback, useState } from 'react'

type Permission = NotificationPermission | 'unsupported'

const SUPPORTED = typeof window !== 'undefined' && 'Notification' in window

export function useNotifications() {
  const [permission, setPermission] = useState<Permission>(
    SUPPORTED ? Notification.permission : 'unsupported'
  )

  // Demande la permission à l'utilisateur (déclenché par une action explicite, jamais au chargement).
  const request = useCallback(async (): Promise<void> => {
    if (!SUPPORTED) return
    try {
      setPermission(await Notification.requestPermission())
    } catch {
      // Permission refusée ou indisponible : on ignore silencieusement.
    }
  }, [])

  // Affiche une notification si — et seulement si — la permission a été accordée.
  const notify = useCallback(
    (title: string, opts?: { body?: string; onClick?: () => void }): void => {
      if (!SUPPORTED || Notification.permission !== 'granted') return
      try {
        const n = new Notification(title, { body: opts?.body, icon: '/favicon.ico' })
        if (opts?.onClick) {
          n.onclick = () => {
            window.focus()
            opts.onClick?.()
            n.close()
          }
        }
      } catch {
        // Certains navigateurs lèvent si le contexte n'est pas sécurisé : sans gravité.
      }
    },
    []
  )

  return { supported: SUPPORTED, permission, request, notify }
}
