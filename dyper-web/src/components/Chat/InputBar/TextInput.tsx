// Composant de champ de saisie texte avec redimensionnement automatique et soumission par Shift+Entrée.
import { useRef, useEffect } from 'react'

interface TextInputProps {
  value: string
  onChange: (v: string) => void
  onEnter: () => void
  disabled: boolean
  placeholder: string
}

export function TextInput({ value, onChange, onEnter, disabled, placeholder }: TextInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Ajuste la hauteur du textarea selon le contenu, jusqu'à 4 lignes maximum.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 24
    const maxHeight = lineHeight * 4 + 16
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      onEnter()
    }
  }

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder={placeholder}
      rows={1}
      className="
        flex-1 resize-none bg-transparent text-white placeholder-gray-500
        focus:outline-none text-sm leading-6 py-2 px-3
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    />
  )
}
