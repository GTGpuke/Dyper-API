// Hook de défilement « collé en bas » façon claude.ai : suit le flux tant que l'utilisateur
// est en bas, se libère dès qu'il remonte, et expose un bouton « revenir en bas ».
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const BOTTOM_THRESHOLD_PX = 80

interface UseStickToBottomReturn {
  atBottom: boolean
  follow: () => void
  scrollToBottom: (smooth?: boolean) => void
}

export function useStickToBottom(ref: RefObject<HTMLElement>): UseStickToBottomReturn {
  const [atBottom, setAtBottom] = useState(true)
  const atBottomRef = useRef(true)
  const isAutoScrollingRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      if (isAutoScrollingRef.current) return
      const near = el.scrollTop + el.clientHeight >= el.scrollHeight - BOTTOM_THRESHOLD_PX
      atBottomRef.current = near
      setAtBottom(near)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [ref])

  const scrollToBottom = useCallback(
    (smooth = true) => {
      const el = ref.current
      if (!el) return
      isAutoScrollingRef.current = true
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
      atBottomRef.current = true
      setAtBottom(true)
      // Fenêtre de grâce : les évènements scroll programmés ne libèrent pas le verrou.
      setTimeout(() => {
        isAutoScrollingRef.current = false
      }, 250)
    },
    [ref]
  )

  // Suit le contenu uniquement si l'utilisateur est resté en bas.
  const follow = useCallback(() => {
    if (atBottomRef.current) scrollToBottom(false)
  }, [scrollToBottom])

  return { atBottom, follow, scrollToBottom }
}
