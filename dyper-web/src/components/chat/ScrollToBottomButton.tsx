// Bouton flottant « revenir en bas » affiché quand l'utilisateur a remonté le fil.
import { motion } from 'framer-motion'
import { useI18n } from '../../contexts/I18nContext'

export function ScrollToBottomButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n()
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 shadow-card transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
      aria-label={t('chat.scrollToBottom')}
    >
      ↓ {t('chat.scrollToBottom')}
    </motion.button>
  )
}
