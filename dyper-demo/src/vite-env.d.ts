/// <reference types="vite/client" />

// Variables d'environnement Vite consommées par la démo.
interface ImportMetaEnv {
  /** Clé applicative envoyée en en-tête X-App-Key (login + génération de clé). */
  readonly VITE_APP_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
