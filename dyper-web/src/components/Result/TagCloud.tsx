// Nuage de tags descriptifs issus de l'analyse.
import { Badge } from '../ui/Badge'

export function TagCloud({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} tone="neutral">
          #{tag}
        </Badge>
      ))}
    </div>
  )
}
