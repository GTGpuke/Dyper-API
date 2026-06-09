/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de base de la passerelle dyper-api (ex : http://localhost:3000). */
  readonly VITE_API_URL: string
  /** Clé applicative envoyée dans le header X-App-Key. */
  readonly VITE_APP_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
