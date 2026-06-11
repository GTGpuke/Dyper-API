// Page de guide : rend les blocs typés (titres, prose, code, encadrés, tables) d'un guide.
import { Navigate, useParams } from 'react-router-dom'
import { useI18n } from '../../contexts/I18nContext'
import { getGuide, type GuideBlock } from '../../docs/guides'
import { CodeBlock } from './CodeBlock'

function Block({ block }: { block: GuideBlock }) {
  const { lang } = useI18n()

  switch (block.type) {
    case 'h2':
      return (
        <h2 className="mt-8 text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
          {block.text[lang]}
        </h2>
      )
    case 'p':
      return (
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-600 dark:text-ink-300">
          {block.text[lang]}
        </p>
      )
    case 'callout':
      return (
        <div className="mt-4 rounded-xl border border-brand-300/50 bg-brand-500/5 p-4 text-sm leading-relaxed text-ink-700 dark:border-brand-500/30 dark:text-ink-200">
          💡 {block.text[lang]}
        </div>
      )
    case 'code':
      return (
        <div className="mt-4">
          <CodeBlock title={block.title} code={block.code} />
        </div>
      )
    case 'table':
      return (
        <div className="mt-4 overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800/60">
                {block.headers.map((h) => (
                  <th
                    key={h.fr}
                    className="px-3.5 py-2 text-left font-semibold text-ink-700 dark:text-ink-200"
                  >
                    {h[lang]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr
                  key={row[0].fr}
                  className="border-b border-ink-100 last:border-0 dark:border-ink-800"
                >
                  {row.map((cell, i) => (
                    <td
                      key={cell.fr}
                      className={
                        i === 0
                          ? 'whitespace-nowrap px-3.5 py-2 font-mono text-xs text-brand-700 dark:text-brand-300'
                          : 'px-3.5 py-2 text-ink-600 dark:text-ink-300'
                      }
                    >
                      {cell[lang]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

export function GuidePage() {
  const { lang } = useI18n()
  const { guideId } = useParams<{ guideId: string }>()
  const guide = guideId ? getGuide(guideId) : undefined

  if (!guide) return <Navigate to="/api-docs" replace />

  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
        {guide.title[lang]}
      </h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-500 dark:text-ink-400">
        {guide.intro[lang]}
      </p>
      {guide.blocks.map((block, index) => (
        // Clé par index acceptable : contenu statique, ordre stable.
        <Block key={index} block={block} />
      ))}
    </article>
  )
}
