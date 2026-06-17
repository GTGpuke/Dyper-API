// Démo de l'API Dyper en trois temps :
//   1. On se connecte (ou on crée un compte) puis on génère une CLÉ API.
//   2. On capture la caméra OU un partage d'écran et on envoie chaque frame à l'API, authentifié
//      UNIQUEMENT par la clé (Authorization: Bearer …) — preuve que la clé fonctionne seule.
//   3. Chaque relevé est dessiné sur la vidéo et ajouté à la transcription cumulée, en dessous.
import { useEffect, useRef, useState } from 'react'
import { analyzeFrame, ApiError, authenticate, createApiKey } from './api'
import type { AnalysisResult, LogEntry, Source } from './types'

// Largeur max de la frame envoyée : on réduit pour accélérer l'inférence et alléger la requête.
const CAPTURE_MAX_WIDTH = 960
// Intervalle minimal entre deux analyses (ms) : borne le débit sous la limite globale (60 req/min).
const MIN_INTERVAL_MS = 1200

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const nowTime = (): string => new Date().toLocaleTimeString('fr-FR')

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
  const [log, setLog] = useState<LogEntry[]>([])

  // Refs (valeurs lues par la boucle asynchrone, hors cycle de rendu).
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const captureRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const runningRef = useRef(false)
  const logIdRef = useRef(0)
  const detCountRef = useRef(0)
  const logBoxRef = useRef<HTMLOListElement>(null)

  // Défilement automatique de la transcription vers le bas à chaque ajout.
  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight
  }, [log])

  // Arrêt propre du flux si le composant est démonté en pleine détection.
  useEffect(() => {
    return () => stopStream()
  }, [])

  const detectionCount = log.filter((e) => e.kind === 'detection').length

  function addLog(kind: LogEntry['kind'], text: string): void {
    setLog((prev) => [...prev, { id: logIdRef.current++, kind, time: nowTime(), text }])
  }

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

  // ─── Étape 2 : capture + boucle d'analyse ───────────────────────────────────────────────────
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

  function addDetection(result: AnalysisResult): void {
    detCountRef.current += 1
    const objects = result.visualization.objects
    const scene = result.visualization.scene
    if (objects.length === 0) {
      addLog('detection', 'rien détecté')
      return
    }
    const labels = objects.map((o) => `${o.label} (${Math.round(o.confidence * 100)}%)`).join(', ')
    const sceneTxt = scene?.label ? ` · scène : ${scene.label}` : ''
    addLog('detection', `${objects.length} objet${objects.length > 1 ? 's' : ''} — ${labels}${sceneTxt}`)
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
    detCountRef.current = 0
    setDetStatus({ text: 'Détection en cours…', kind: 'ok' })
    addLog('marker', `▶ Détection démarrée (${source === 'screen' ? 'partage d’écran' : 'caméra'})`)

    const key = apiKey
    while (runningRef.current) {
      const started = performance.now()
      try {
        const blob = await grabFrame()
        if (blob) {
          const result = await analyzeFrame(key, blob)
          if (runningRef.current) {
            drawDetections(result)
            addDetection(result)
          }
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 429) {
          // Limite de débit : transitoire, on patiente puis on réessaie.
          setDetStatus({ text: `Limite de débit atteinte — pause ${e.retryAfter}s.`, kind: 'err' })
          await sleep(e.retryAfter * 1000)
        } else if (e instanceof ApiError && e.code === 'QUOTA_EXCEEDED') {
          // Quota mensuel épuisé : définitif, on arrête proprement.
          addLog('error', e.message)
          stopDetection()
          setDetStatus({ text: 'Quota mensuel API atteint.', kind: 'err' })
          break
        } else {
          addLog('error', e instanceof Error ? e.message : String(e))
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
    stopStream()
    clearOverlay()
    setDetStatus({ text: 'Arrêté.', kind: '' })
    const n = detCountRef.current
    addLog('marker', `■ Détection arrêtée — ${n} relevé${n > 1 ? 's' : ''}`)
  }

  const maskedKey =
    apiKey && apiKey.length > 20 ? `${apiKey.slice(0, 16)}…${apiKey.slice(-4)}` : apiKey

  return (
    <main className="app">
      <header className="head">
        <h1>Dyper · Démo API</h1>
        <p className="sub">
          Détection d'objets en temps réel via l'API publique — caméra ou partage d'écran,
          authentifiée par une clé API.
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

      {/* Étape 2 — Détection temps réel. */}
      <section className="card">
        <h2>
          <span className="step">2</span> Détection temps réel
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
            disabled={!apiKey}
            onClick={() => (running ? stopDetection() : void startDetection())}
          >
            {running ? 'Arrêter la détection' : 'Démarrer la détection'}
          </button>
          <span className={`status ${detStatus.kind}`}>{detStatus.text}</span>
        </div>

        <div className="stage">
          <video ref={videoRef} autoPlay playsInline muted />
          <canvas ref={overlayRef} />
        </div>
      </section>

      {/* Étape 3 — Transcription cumulée. */}
      <section className="card">
        <h2>
          <span className="step">3</span> Transcription
        </h2>
        <div className="row">
          <span className="status">
            {detectionCount} relevé{detectionCount > 1 ? 's' : ''}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setLog([])
              detCountRef.current = 0
            }}
          >
            Effacer
          </button>
        </div>
        <ol className="log" ref={logBoxRef}>
          {log.map((e) => (
            <li key={e.id}>
              {e.kind === 'marker' ? (
                <span className="marker">{e.text}</span>
              ) : (
                <>
                  <span className="t">{e.time}</span>
                  <span className={e.kind === 'error' ? 'err' : ''}>{e.text}</span>
                </>
              )}
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
