// Transcription audio « karaoké » : les mots s'illuminent au fil de la lecture vidéo. Les tranches
// horodatées de Whisper (start/end de phrase) sont découpées en mots dont l'horodatage est
// approché au prorata de la longueur (Whisper n'horodate pas au mot près). La position de lecture
// est lue dans le `timeRef` publié par le lecteur (aucun re-render par frame : l'état ne change que
// lorsque le mot courant change). Sans lecteur (pas de `timeRef`) ou sans tranches : texte simple.
import { Fragment, useEffect, useMemo, useState, type MutableRefObject } from 'react'
import { cn } from '../../lib/cn'
import type { TranscriptSegment } from '../../types'

interface Word {
  text: string
  start: number
}

// Découpe les tranches horodatées en mots, en répartissant la durée de chaque tranche sur ses mots
// au prorata de leur longueur (approximation, faute d'horodatage au mot près).
function buildWords(segments: TranscriptSegment[]): Word[] {
  const words: Word[] = []
  for (const seg of segments) {
    const tokens = seg.text.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    const totalLen = tokens.reduce((sum, w) => sum + w.length, 0) || 1
    const dur = Math.max(0, seg.end - seg.start)
    let acc = 0
    for (const token of tokens) {
      words.push({ text: token, start: seg.start + (acc / totalLen) * dur })
      acc += token.length
    }
  }
  return words
}

// Indice du dernier mot dont le début est atteint par `t` (mots triés par début) ; -1 avant le 1er.
function activeWordIndex(words: Word[], t: number): number {
  let idx = -1
  for (let i = 0; i < words.length; i += 1) {
    if (words[i].start <= t) idx = i
    else break
  }
  return idx
}

const BLOCKQUOTE_CLASS =
  'rounded-xl border-l-2 border-brand-400 bg-ink-50 px-3.5 py-2.5 text-sm italic leading-relaxed text-ink-600 dark:bg-ink-800/60 dark:text-ink-300'

export function TranscriptKaraoke({
  text,
  segments,
  timeRef,
  playing = false,
}: {
  /** Transcription complète : repli affiché tel quel quand la synchronisation est indisponible. */
  text?: string | null
  /** Tranches horodatées : nécessaires au surlignage mot à mot. */
  segments?: TranscriptSegment[] | null
  /** Position de lecture courante (s) publiée par le lecteur ; absente = pas de surlignage. */
  timeRef?: MutableRefObject<number>
  /** Vrai pendant la lecture (déclenche le balayage du mot courant). */
  playing?: boolean
}) {
  const words = useMemo(() => (segments ? buildWords(segments) : []), [segments])
  const synced = words.length > 0 && Boolean(timeRef)
  const [active, setActive] = useState(-1)

  // Surligne le mot prononcé : balayage continu pendant la lecture, calage unique à l'arrêt.
  // setActive n'agit que lorsque l'indice change (pas de re-render à chaque frame).
  useEffect(() => {
    if (!synced || !timeRef) return
    const ref = timeRef
    const update = () =>
      setActive((prev) => {
        const idx = activeWordIndex(words, ref.current)
        return prev === idx ? prev : idx
      })
    update()
    if (!playing) return
    let raf = 0
    const tick = () => {
      update()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [synced, playing, words, timeRef])

  if (!synced) {
    return <blockquote className={BLOCKQUOTE_CLASS}>{text}</blockquote>
  }

  return (
    <blockquote className={BLOCKQUOTE_CLASS}>
      {words.map((word, i) => (
        <Fragment key={`${i}-${word.start}`}>
          <span
            className={cn(
              // -mx/px compensés : le fond du mot courant respire sans décaler la mise en page.
              '-mx-0.5 rounded px-0.5 transition-colors duration-200',
              i === active
                ? 'bg-brand-500/20 font-medium text-brand-800 dark:text-brand-200'
                : i < active
                  ? 'text-ink-700 dark:text-ink-200'
                  : 'text-ink-400 dark:text-ink-600'
            )}
          >
            {word.text}
          </span>{' '}
        </Fragment>
      ))}
    </blockquote>
  )
}
