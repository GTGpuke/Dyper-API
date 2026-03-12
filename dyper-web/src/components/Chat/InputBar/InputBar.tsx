// Composant de barre de saisie complète intégrant le champ texte, la zone de dépôt et le bouton d'envoi.
import { useState } from 'react'
import { TextInput } from './TextInput'
import { SendButton } from './SendButton'
import { DropZone } from './DropZone'
import { ImagePreview } from '../../UI/ImagePreview'
import { ErrorBanner } from '../../UI/ErrorBanner'
import { createPreviewUrl, revokePreviewUrl } from '../../../utils/fileHelpers'

interface InputBarProps {
  onSend: (text: string, file?: File) => void
  isDragging: boolean
  disabled: boolean
}

export function InputBar({ onSend, disabled }: InputBarProps) {
  const [text, setText] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dropError, setDropError] = useState<string | null>(null)

  function handleDrop(file: File) {
    // Révoque l'ancienne URL avant d'en créer une nouvelle.
    if (previewUrl) revokePreviewUrl(previewUrl)
    setPendingFile(file)
    setPreviewUrl(createPreviewUrl(file))
    setDropError(null)
  }

  function handleRemoveFile() {
    if (previewUrl) revokePreviewUrl(previewUrl)
    setPendingFile(null)
    setPreviewUrl(null)
  }

  function handleSend() {
    if (!text.trim() && !pendingFile) return
    onSend(text, pendingFile ?? undefined)
    setText('')
    if (previewUrl) revokePreviewUrl(previewUrl)
    setPendingFile(null)
    setPreviewUrl(null)
  }

  return (
    <div className="border-t border-gray-800 p-4 flex flex-col gap-2">
      {dropError && (
        <ErrorBanner message={dropError} onDismiss={() => setDropError(null)} />
      )}
      {pendingFile && previewUrl && (
        <ImagePreview
          url={previewUrl}
          filename={pendingFile.name}
          onRemove={handleRemoveFile}
        />
      )}
      <DropZone onDrop={handleDrop} onError={setDropError} />
      <div className="flex items-end gap-2 bg-gray-900 border border-gray-700 rounded-xl">
        <TextInput
          value={text}
          onChange={setText}
          onEnter={handleSend}
          disabled={disabled}
          placeholder="Posez une question ou déposez une image…"
        />
        <div className="p-2">
          <SendButton
            disabled={disabled || (!text.trim() && !pendingFile)}
            onClick={handleSend}
          />
        </div>
      </div>
    </div>
  )
}
