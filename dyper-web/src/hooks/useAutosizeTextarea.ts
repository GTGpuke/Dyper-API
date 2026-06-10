// Hook d'auto-redimensionnement du textarea du composer (croît avec le contenu, plafonné).
import { useEffect, type RefObject } from 'react'

const MAX_HEIGHT_PX = 200

export function useAutosizeTextarea(ref: RefObject<HTMLTextAreaElement>, value: string): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? 'auto' : 'hidden'
  }, [ref, value])
}
