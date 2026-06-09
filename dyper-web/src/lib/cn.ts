// Petit utilitaire de composition de classes conditionnelles (alias de clsx).
import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
