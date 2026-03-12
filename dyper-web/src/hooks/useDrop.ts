// Hook de gestion du drag & drop de fichiers avec validation intégrée.
import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { validateFile } from '../utils/fileHelpers'

interface UseDropOptions {
  onDrop: (file: File) => void
  onError?: (message: string) => void
}

interface UseDropReturn {
  isDragging: boolean
  getRootProps: () => object
  getInputProps: () => object
}

export function useDrop({ onDrop, onError }: UseDropOptions): UseDropReturn {
  const [isDragging, setIsDragging] = useState(false)

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [], 'video/mp4': [] },
    maxFiles: 1,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDrop: ([file]) => {
      setIsDragging(false)
      if (!file) return
      const validation = validateFile(file)
      if (!validation.valid) {
        onError?.(validation.error!)
        return
      }
      onDrop(file)
    },
  })

  return { isDragging, getRootProps, getInputProps }
}
