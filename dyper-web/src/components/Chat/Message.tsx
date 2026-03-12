// Composant d'affichage d'un message unique du chat selon son rôle et son type de contenu.
import { motion } from 'framer-motion'
import { ResultCard } from '../Result/ResultCard'
import { FollowUpChat } from '../Result/FollowUpChat'
import { ErrorBanner } from '../UI/ErrorBanner'
import { formatTime } from '../../utils/formatters'
import type { ChatMessage } from '../../types'

interface MessageProps {
  message: ChatMessage
}

export function Message({ message }: MessageProps) {
  const { role, timestamp, content } = message

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex flex-col gap-1 ${role === 'user' ? 'items-end' : 'items-start'}`}
    >
      {/* Bulle de message utilisateur : texte. */}
      {role === 'user' && content.type === 'text' && (
        <div className="max-w-[80%] bg-gray-700 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5">
          {content.text}
        </div>
      )}

      {/* Bulle de message utilisateur : image avec texte optionnel. */}
      {role === 'user' && content.type === 'image' && (
        <div className="max-w-[80%] bg-gray-700 text-white text-sm rounded-2xl rounded-br-sm overflow-hidden">
          <img
            src={content.previewUrl}
            alt={content.file.name}
            className="w-full max-h-48 object-cover"
          />
          {content.text && (
            <p className="px-4 py-2.5">{content.text}</p>
          )}
        </div>
      )}

      {/* Carte de résultat du bot. */}
      {role === 'bot' && content.type === 'result' && (
        <div className="w-full max-w-full">
          <ResultCard result={content.result} />
          <FollowUpChat result={content.result} />
        </div>
      )}

      {/* Bandeau d'erreur. */}
      {role === 'error' && content.type === 'error' && (
        <div className="w-full">
          <ErrorBanner message={content.message} />
        </div>
      )}

      {/* Horodatage du message. */}
      <span className="text-xs text-gray-600 px-1">{formatTime(timestamp)}</span>
    </motion.div>
  )
}
