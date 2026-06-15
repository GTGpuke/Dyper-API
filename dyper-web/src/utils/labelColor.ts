// Système de couleurs partagé entre l'image annotée et le lecteur vidéo, pour une apparence
// unifiée. Toutes les teintes sont des HSL vibrantes de même saturation/luminosité :
//   • labelColor(label)   → couleur stable par label (image, pastilles de liste, filtres) ;
//   • trackColor(trackId)  → couleur stable et bien distincte par piste suivie (vidéo).
const PALETTE_S = 80
const PALETTE_L = 60

/** Couleur stable dérivée d'un label (même label → même couleur). */
export function labelColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  }
  return `hsl(${hash % 360} ${PALETTE_S}% ${PALETTE_L}%)`
}

/** Couleur d'une piste suivie : rotation par angle d'or → teintes très distinctes d'une piste à l'autre. */
export function trackColor(trackId: number): string {
  const hue = Math.round((trackId * 137.508) % 360)
  return `hsl(${hue} ${PALETTE_S}% ${PALETTE_L}%)`
}

/** Couleur de texte (sombre ou blanche) la plus lisible sur une couleur de la palette. */
export function textOnColor(color: string): string {
  const match = /hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/.exec(color)
  if (!match) return '#ffffff'
  const [r, g, b] = hslToRgb(Number(match[1]) / 360, Number(match[2]) / 100, Number(match[3]) / 100)
  // Luminance relative perçue (pondération sRGB) → seuil de bascule sombre/clair.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#0b1020' : '#ffffff'
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number): number => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)]
}
