// Couleur stable dérivée d'un label d'objet : teinte HSL déterministe (même label → même couleur).
// Accorde les boîtes englobantes (image annotée) et les pastilles de la liste d'objets.
export function labelColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  }
  return `hsl(${hash % 360} 80% 60%)`
}
