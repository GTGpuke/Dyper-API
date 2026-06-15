// Boîte de détection partagée par l'image annotée et le lecteur vidéo — apparence unifiée.
// Position et taille en pourcentages du média (responsive). Le badge de label reste dans le
// cadre (sous le bord haut si la boîte touche le sommet, ancré à droite près du bord droit) et
// son texte adopte automatiquement la couleur la plus lisible.
import { cn } from '../../lib/cn'
import { textOnColor } from '../../utils/labelColor'

interface Props {
  leftPct: number
  topPct: number
  widthPct: number
  heightPct: number
  color: string
  label: string
  /** Complément après le label : « #3 » (piste vidéo) ou « 92 % » (confiance image). */
  sublabel?: string
  /** Met la boîte en avant et assombrit le reste (survol croisé avec la liste). */
  active?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export function DetectionBox({
  leftPct,
  topPct,
  widthPct,
  heightPct,
  color,
  label,
  sublabel,
  active,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const nearTop = topPct < 6
  const nearRight = leftPct + widthPct > 85
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute rounded-[3px] border-2"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
        borderColor: color,
        boxShadow: active ? '0 0 0 9999px rgba(15,23,42,0.5)' : 'none',
      }}
    >
      <span
        className={cn(
          'absolute whitespace-nowrap rounded px-1 py-0.5 font-mono text-[10px] font-semibold leading-none',
          nearTop ? 'top-0' : 'bottom-full mb-px',
          nearRight ? 'right-0' : 'left-0'
        )}
        style={{ backgroundColor: color, color: textOnColor(color) }}
      >
        {label}
        {sublabel ? ` ${sublabel}` : ''}
      </span>
    </div>
  )
}
