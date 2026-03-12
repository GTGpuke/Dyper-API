// Bouton d'envoi du message représenté par une icône flèche SVG.

interface SendButtonProps {
  disabled: boolean
  onClick: () => void
}

export function SendButton({ disabled, onClick }: SendButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        flex items-center justify-center h-8 w-8 rounded-lg
        bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
        text-white disabled:text-gray-500
        transition-colors disabled:cursor-not-allowed
      "
      aria-label="Envoyer le message"
    >
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
      </svg>
    </button>
  )
}
