// Démo de l'API Dyper :
//   1. On se connecte (ou on crée un compte) puis on génère une CLÉ API.
//   2. On capture la caméra OU un partage d'écran comme un VRAI FLUX VIDÉO (enregistré via
//      MediaRecorder). En parallèle, des frames sont envoyées à l'API (détection rapide, realtime)
//      pour afficher les BOÎTES de détection en TEMPS RÉEL — authentifié uniquement par la clé.
//   3. À l'arrêt, la vidéo enregistrée est envoyée au pipeline vidéo complet pour une DESCRIPTION
//      DÉTAILLÉE de ce qui s'est passé (exactement comme un envoi vidéo classique), avec relecture.
import { useEffect, useRef, useState } from 'react'
import { analyzeFrame, analyzeRecording, ApiError, authenticate, createApiKey } from './api'
import type { AnalysisResult, Source } from './types'

// Largeur max de la frame envoyée pour la détection : réduite pour accélérer et alléger.
const CAPTURE_MAX_WIDTH = 960
// Intervalle minimal entre deux détections (ms) : ~4 images/seconde pour des boîtes fluides.
const MIN_INTERVAL_MS = 250

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

interface Status {
  text: string
  kind: '' | 'ok' | 'err'
}

export function App() {
  // Authentification / clé.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [register, setRegister] = useState(false)
  const [pasteKey, setPasteKey] = useState('')
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<Status>({ text: '', kind: '' })
  const [busy, setBusy] = useState(false)

  // Détection.
  const [source, setSource] = useState<Source>('camera')
  const [running, setRunning] = useState(false)
  const [detStatus, setDetStatus] = useState<Status>({ text: '', kind: '' })

  // Résumé final : vidéo enregistrée (relecture) + description détaillée « ce qui s'est passé ».
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)

  // Refs (valeurs lues par la boucle asynchrone et l'enregistrement, hors cycle de rendu).
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const captureRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const runningRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Arrêt propre du flux si le composant est démonté en pleine capture.
  useEffect(() => {
    return () => stopStream()
  }, [])

  // Libère l'URL objet de la vidéo enregistrée (changement ou démontage) pour éviter les fuites.
  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    }
  }, [recordedUrl])

  // ─── Étape 1 : authentification + génération de clé ─────────────────────────────────────────
  async function handleGenerate(): Promise<void> {
    if (!email.trim() || !password) {
      setAuthStatus({ text: 'Renseignez e-mail et mot de passe.', kind: 'err' })
      return
    }
    setBusy(true)
    setAuthStatus({ text: 'Connexion…', kind: '' })
    try {
      await authenticate(email.trim(), password, register)
      setAuthStatus({ text: 'Génération de la clé…', kind: '' })
      const secret = await createApiKey()
      setApiKey(secret)
      setAuthStatus({ text: 'Clé générée avec succès.', kind: 'ok' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setAuthStatus({ text: register ? `Inscription échouée : ${msg}` : `Connexion échouée : ${msg}`, kind: 'err' })
    } finally {
      setBusy(false)
    }
  }

  function handleUseKey(): void {
    const k = pasteKey.trim()
    if (!k) return
    setApiKey(k)
    setAuthStatus({ text: 'Clé existante chargée.', kind: 'ok' })
  }

  // ─── Étape 2 : capture + enregistrement + boucle de détection ───────────────────────────────
  async function startStream(src: Source): Promise<void> {
    const stream =
      src === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        : await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    // L'utilisateur peut couper le partage depuis le navigateur : on s'aligne dessus.
    stream.getVideoTracks()[0]?.addEventListener('ended', stopDetection)
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    }
  }

  function stopStream(): void {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }

  // Format d'enregistrement supporté par le navigateur (mp4 de préférence, sinon webm).
  function pickRecordMime(): string {
    const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm']
    return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
  }

  // Enregistre la session (vidéo réelle) : à l'arrêt, sa vidéo alimente le résumé final + la relecture.
  function startRecording(): void {
    const stream = streamRef.current
    if (!stream || typeof MediaRecorder === 'undefined') return
    chunksRef.current = []
    const mimeType = pickRecordMime()
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType, videoBitsPerSecond: 2_500_000 } : undefined
    )
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'video/webm' })
      setRecordedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return blob.size > 0 ? URL.createObjectURL(blob) : null
      })
      void summarize(blob)
    }
    recorder.start(1000)
    recorderRef.current = recorder
  }

  // Résumé final : la vidéo enregistrée est envoyée au pipeline vidéo complet (suivi temporel +
  // description) pour décrire « ce qui s'est passé » sur la durée — comme un envoi vidéo classique.
  async function summarize(blob: Blob): Promise<void> {
    if (!apiKey || blob.size === 0) return
    setSummarizing(true)
    setSummary(null)
    try {
      const result = await analyzeRecording(apiKey, blob)
      setSummary(result.description || 'Aucune description disponible pour cette séquence.')
      setDetStatus({ text: 'Résumé prêt.', kind: 'ok' })
    } catch (e) {
      setSummary(null)
      setDetStatus({ text: `Résumé indisponible : ${e instanceof Error ? e.message : String(e)}`, kind: 'err' })
    } finally {
      setSummarizing(false)
    }
  }

  // Capture la frame courante (redimensionnée) en blob JPEG.
  function grabFrame(): Promise<Blob | null> {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return Promise.resolve(null)
    if (!captureRef.current) captureRef.current = document.createElement('canvas')
    const canvas = captureRef.current
    const scale = Math.min(1, CAPTURE_MAX_WIDTH / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
  }

  function clearOverlay(): void {
    const canvas = overlayRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Dessine les boîtes de détection. Le canvas adopte la résolution de la frame envoyée ; le CSS
  // l'étire sur la vidéo (même rapport d'aspect → alignement correct).
  function drawDetections(result: AnalysisResult): void {
    const canvas = overlayRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const w = result.sourceWidth || captureRef.current?.width || canvas.width
    const h = result.sourceHeight || captureRef.current?.height || canvas.height
    canvas.width = w
    canvas.height = h
    ctx.clearRect(0, 0, w, h)
    ctx.lineWidth = Math.max(2, Math.round(w / 320))
    ctx.font = `${Math.max(14, Math.round(w / 45))}px system-ui, sans-serif`
    ctx.textBaseline = 'top'

    for (const obj of result.visualization.objects) {
      if (!obj.boundingBox) continue
      const { x, y, w: bw, h: bh } = obj.boundingBox
      const color = obj.priority === false ? '#8b5cf6' : '#34d399'
      ctx.strokeStyle = color
      ctx.strokeRect(x, y, bw, bh)
      const label = `${obj.label} ${Math.round(obj.confidence * 100)}%`
      const th = Math.max(16, Math.round(w / 40))
      ctx.fillStyle = color
      ctx.fillRect(x, Math.max(0, y - th), ctx.measureText(label).width + 10, th)
      ctx.fillStyle = '#0b0f1a'
      ctx.fillText(label, x + 5, Math.max(0, y - th) + 2)
    }
  }

  // Retour live (sans texte qui défile) : juste le nombre d'objets actuellement suivis.
  function updateLiveCount(result: AnalysisResult): void {
    const n = result.visualization.objects.length
    setDetStatus({
      text: n === 0 ? 'Aucun objet dans le champ…' : `${n} objet${n > 1 ? 's' : ''} détecté${n > 1 ? 's' : ''}…`,
      kind: 'ok',
    })
  }

  async function startDetection(): Promise<void> {
    if (!apiKey) {
      setDetStatus({ text: 'Générez ou chargez une clé API d’abord.', kind: 'err' })
      return
    }
    try {
      setDetStatus({ text: 'Accès au flux…', kind: '' })
      await startStream(source)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setDetStatus({ text: `Accès au flux refusé : ${msg}`, kind: 'err' })
      return
    }
    runningRef.current = true
    setRunning(true)
    // Réinitialise le résumé précédent et démarre l'enregistrement de la nouvelle session.
    setSummary(null)
    setRecordedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    startRecording()
    setDetStatus({ text: 'Détection en cours…', kind: 'ok' })

    const key = apiKey
    while (runningRef.current) {
      const started = performance.now()
      try {
        const blob = await grabFrame()
        if (blob) {
          const result = await analyzeFrame(key, blob, true)
          if (runningRef.current) {
            drawDetections(result)
            updateLiveCount(result)
          }
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 429) {
          // Limite de débit : transitoire, on patiente puis on réessaie.
          setDetStatus({ text: `Limite de débit atteinte — pause ${e.retryAfter}s.`, kind: 'err' })
          await sleep(e.retryAfter * 1000)
        } else if (e instanceof ApiError && e.code === 'QUOTA_EXCEEDED') {
          // Quota mensuel épuisé : définitif, on arrête proprement.
          stopDetection()
          setDetStatus({ text: 'Quota mensuel API atteint.', kind: 'err' })
          break
        } else {
          setDetStatus({ text: `Erreur : ${e instanceof Error ? e.message : String(e)}`, kind: 'err' })
        }
      }
      const elapsed = performance.now() - started
      await sleep(Math.max(0, MIN_INTERVAL_MS - elapsed))
    }
  }

  function stopDetection(): void {
    if (!runningRef.current) return
    runningRef.current = false
    setRunning(false)
    // Finalise l'enregistrement (déclenche onstop → résumé) AVANT de couper les pistes.
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    recorderRef.current = null
    stopStream()
    clearOverlay()
    setDetStatus({ text: 'Capture terminée — analyse du résumé…', kind: '' })
  }

  const maskedKey =
    apiKey && apiKey.length > 20 ? `${apiKey.slice(0, 16)}…${apiKey.slice(-4)}` : apiKey

  return (
    <main className="app">
      <header className="head">
        <h1>Dyper · Démo API</h1>
        <p className="sub">
          Détection d'objets en temps réel via l'API publique (caméra ou partage d'écran), puis
          description détaillée de la séquence enregistrée — authentifié par une clé API.
        </p>
      </header>

      {/* Étape 1 — Clé API. */}
      <section className="card">
        <h2>
          <span className="step">1</span> Clé API
        </h2>
        <div className="grid">
          <label>
            E-mail
            <input
              type="email"
              autoComplete="username"
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>

        <label className="check">
          <input type="checkbox" checked={register} onChange={(e) => setRegister(e.target.checked)} />
          Je n'ai pas encore de compte (le créer)
        </label>

        <div className="row">
          <button className="btn btn-primary" disabled={busy} onClick={() => void handleGenerate()}>
            Se connecter & générer une clé
          </button>
          <span className={`status ${authStatus.kind}`}>{authStatus.text}</span>
        </div>

        <details className="paste">
          <summary>ou utiliser une clé API existante</summary>
          <div className="row">
            <input
              type="text"
              placeholder="dyk_live_…"
              value={pasteKey}
              onChange={(e) => setPasteKey(e.target.value)}
            />
            <button className="btn" onClick={handleUseKey}>
              Utiliser
            </button>
          </div>
        </details>

        {apiKey && (
          <div className="keybox">
            <span className="keybox-label">
              Clé active (utilisée en <code>Authorization: Bearer</code>) :
            </span>
            <code className="keybox-value">{maskedKey}</code>
          </div>
        )}
      </section>

      {/* Étape 2 — Capture + détection temps réel (boîtes). */}
      <section className="card">
        <h2>
          <span className="step">2</span> Capture & détection temps réel
        </h2>
        <div className="row">
          <label className="seg">
            Source
            <select
              value={source}
              disabled={running}
              onChange={(e) => setSource(e.target.value as Source)}
            >
              <option value="camera">Caméra</option>
              <option value="screen">Partage d'écran</option>
            </select>
          </label>
          <button
            className={`btn btn-primary ${running ? 'recording' : ''}`}
            disabled={!apiKey || summarizing}
            onClick={() => (running ? stopDetection() : void startDetection())}
          >
            {running ? 'Arrêter & analyser' : 'Démarrer la capture'}
          </button>
          <span className={`status ${detStatus.kind}`}>{detStatus.text}</span>
        </div>

        <div className="stage">
          <video ref={videoRef} autoPlay playsInline muted />
          <canvas ref={overlayRef} />
        </div>
      </section>

      {/* Étape 3 — Résumé final : relecture de la vidéo + description détaillée. */}
      {(recordedUrl || summarizing || summary) && (
        <section className="card">
          <h2>
            <span className="step">3</span> Résumé de la capture
          </h2>
          {recordedUrl && <video className="replay" src={recordedUrl} controls />}
          {summarizing && (
            <p className="status">⏳ Analyse de la séquence enregistrée (pipeline vidéo)…</p>
          )}
          {summary && <p className="summary">{summary}</p>}
        </section>
      )}
    </main>
  )
}
