// Composant de nuage de tags affichant chaque mot-clé sous forme de badge arrondi.

interface TagCloudProps {
  tags: string[]
}

export function TagCloud({ tags }: TagCloudProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Tags</h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="px-2.5 py-1 text-xs bg-gray-700 text-gray-300 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
