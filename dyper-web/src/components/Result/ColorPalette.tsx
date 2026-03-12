// Composant d'affichage de la palette des couleurs dominantes détectées dans l'image.

interface ColorPaletteProps {
  colors: string[]
}

export function ColorPalette({ colors }: ColorPaletteProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Couleurs dominantes
      </h3>
      <div className="flex flex-wrap gap-3">
        {colors.map((color) => (
          <div key={color} className="flex flex-col items-center gap-1">
            <div
              className="h-8 w-8 rounded border border-gray-700 shadow"
              style={{ backgroundColor: color }}
              aria-label={`Couleur ${color}`}
            />
            <span className="text-xs text-gray-400 font-mono">{color}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
