// Panneau de résultat d'analyse « live » : image annotée + détails structurés.
import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { BoundingBoxOverlay } from './BoundingBoxOverlay'
import { ColorPalette } from './ColorPalette'
import { ObjectList } from './ObjectList'
import { SceneBadge } from './SceneBadge'
import { TagCloud } from './TagCloud'
import { useI18n } from '../../contexts/I18nContext'
import type { AnalysisResult } from '../../types'
import { formatProcessingTime } from '../../utils/formatters'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="eyebrow">{title}</h3>
      {children}
    </div>
  )
}

export function ResultPanel({
  result,
  previewUrl,
}: {
  result: AnalysisResult
  previewUrl?: string | null
}) {
  const { t } = useI18n()
  const [hover, setHover] = useState<number | null>(null)
  const { description, visualization, model, processingTime } = result

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-6 lg:grid-cols-2"
    >
      {/* Colonne média (uniquement si un aperçu local est disponible). */}
      {previewUrl && (
        <div className="flex flex-col gap-3">
          <BoundingBoxOverlay
            src={previewUrl}
            objects={visualization.objects}
            highlightIndex={hover}
            onHover={setHover}
          />
        </div>
      )}

      {/* Colonne détails. */}
      <div className={previewUrl ? 'flex flex-col gap-6' : 'flex flex-col gap-6 lg:col-span-2'}>
        <Section title={t('result.description')}>
          <p className="text-[15px] leading-relaxed text-ink-700 dark:text-ink-200">{description}</p>
        </Section>

        <Section title={t('result.scene')}>
          <SceneBadge
            label={visualization.scene.label}
            confidence={visualization.scene.confidence}
            indoor={visualization.scene.indoor}
          />
        </Section>

        {visualization.objects.length > 0 && (
          <Section title={`${t('result.objects')} (${visualization.objects.length})`}>
            <ObjectList objects={visualization.objects} highlightIndex={hover} onHover={setHover} />
          </Section>
        )}

        {visualization.colors.length > 0 && (
          <Section title={t('result.colors')}>
            <ColorPalette colors={visualization.colors} />
          </Section>
        )}

        {visualization.tags.length > 0 && (
          <Section title={t('result.tags')}>
            <TagCloud tags={visualization.tags} />
          </Section>
        )}

        {visualization.text.length > 0 && (
          <Section title={t('result.text')}>
            <p className="rounded-lg bg-ink-50 p-3 font-mono text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300">
              {visualization.text.join(' · ')}
            </p>
          </Section>
        )}

        <div className="flex items-center justify-between border-t border-ink-100 pt-4 text-xs text-ink-400 dark:border-ink-800 dark:text-ink-500">
          <span className="font-mono">{model}</span>
          <span>{formatProcessingTime(processingTime)}</span>
        </div>
      </div>
    </motion.div>
  )
}
