// Composant d'affichage d'une miniature de fichier image avec bouton de suppression.

interface ImagePreviewProps {
  url: string
  filename: string
  onRemove: () => void
}

export function ImagePreview({ url, filename, onRemove }: ImagePreviewProps) {
  return (
    <div className="relative inline-flex items-center gap-2 bg-gray-800 rounded-lg p-2 border border-gray-700">
      <img
        src={url}
        alt={filename}
        className="h-12 w-12 object-cover rounded"
      />
      <span className="text-xs text-gray-400 max-w-[120px] truncate">{filename}</span>
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-2 bg-gray-700 hover:bg-red-700 text-white rounded-full h-5 w-5 flex items-center justify-center transition-colors"
        aria-label={`Supprimer ${filename}`}
      >
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  )
}
