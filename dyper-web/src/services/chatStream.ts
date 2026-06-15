// Client SSE du chat streamé : fetch + ReadableStream (POST + cookie + X-App-Key,
// impossibles avec EventSource). Parse les frames `data:`/`event:` séparées par \n\n.
import type { ApiError } from '../types'

export interface ChatStreamHandlers {
  onDelta: (chunk: string) => void
  onDone: (messageId: string) => void
  onError: (err: ApiError) => void
}

// Délai maximal sans aucun octet reçu avant d'abandonner le flux.
const STALL_TIMEOUT_MS = 30_000

export async function streamChat(
  conversationId: string,
  payload: { question: string; lang: string },
  handlers: ChatStreamHandlers,
  signal: AbortSignal
): Promise<void> {
  const base = import.meta.env.VITE_API_URL ?? ''
  let response: Response
  try {
    response = await fetch(`${base}/api/v1/conversations/${conversationId}/messages/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Key': import.meta.env.VITE_APP_KEY ?? '',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ text: payload.question, lang: payload.lang }),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    handlers.onError({ code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' })
    return
  }

  // Erreur avant le flux (404/503/400…) : enveloppe JSON standard.
  if (!response.ok) {
    let err: ApiError = { code: `STREAM_HTTP_${response.status}`, message: 'Erreur du serveur.' }
    try {
      const body = await response.json()
      if (body?.error) err = body.error
    } catch {
      // Corps non JSON : on garde l'erreur synthétique.
    }
    handlers.onError(err)
    return
  }
  if (!response.body) {
    handlers.onError({ code: 'STREAM_UNSUPPORTED', message: 'Flux non supporté.' })
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false

  // Minuterie anti-blocage : réarmée à chaque octet reçu.
  let stallTimer: ReturnType<typeof setTimeout> | undefined
  const armStallTimer = () => {
    clearTimeout(stallTimer)
    stallTimer = setTimeout(() => {
      reader.cancel().catch(() => undefined)
      handlers.onError({ code: 'STREAM_TIMEOUT', message: 'Le flux ne répond plus.' })
      finished = true
    }, STALL_TIMEOUT_MS)
  }

  // Traite un bloc d'évènement SSE complet (lignes event:/data:).
  const handleEvent = (block: string): void => {
    let eventName = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
    }
    if (dataLines.length === 0) return
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(dataLines.join('\n'))
    } catch {
      return
    }
    if (eventName === 'error') {
      handlers.onError({
        code: String(parsed.code ?? 'STREAM_ERROR'),
        message: String(parsed.message ?? 'Erreur du flux.'),
      })
      finished = true
    } else if (eventName === 'done') {
      handlers.onDone(String(parsed.messageId ?? ''))
      finished = true
    } else if (typeof parsed.delta === 'string') {
      handlers.onDelta(parsed.delta)
    }
  }

  try {
    armStallTimer()
    while (!finished) {
      const { done, value } = await reader.read()
      if (done) break
      armStallTimer()
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      let idx = buffer.indexOf('\n\n')
      while (idx !== -1 && !finished) {
        handleEvent(buffer.slice(0, idx))
        buffer = buffer.slice(idx + 2)
        idx = buffer.indexOf('\n\n')
      }
    }
    // Connexion fermée sans frame terminal : flux interrompu.
    if (!finished && !signal.aborted) {
      handlers.onError({ code: 'STREAM_INTERRUPTED', message: 'Le flux a été interrompu.' })
    }
  } catch (e) {
    if (!signal.aborted && (e as Error).name !== 'AbortError') {
      handlers.onError({ code: 'STREAM_ERROR', message: 'Erreur de lecture du flux.' })
    }
  } finally {
    clearTimeout(stallTimer)
  }
}
