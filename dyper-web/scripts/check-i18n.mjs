// Script d'audit i18n : parité des clés FR/EN + clés définies non utilisées + clés manquantes.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')
const transFile = join(srcDir, 'i18n', 'translations.ts')

function extractKeys(content, marker) {
  const start = content.indexOf(`const ${marker}: Dict = {`)
  const end = content.indexOf('\n}', start)
  const block = content.slice(start, end)
  const keys = new Set()
  for (const m of block.matchAll(/^\s*'([^']+)':/gm)) keys.add(m[1])
  return keys
}

const trans = readFileSync(transFile, 'utf8')
const frKeys = extractKeys(trans, 'fr')
const enKeys = extractKeys(trans, 'en')

const missingInEn = [...frKeys].filter((k) => !enKeys.has(k))
const missingInFr = [...enKeys].filter((k) => !frKeys.has(k))

function walk(dir) {
  let files = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) files = files.concat(walk(p))
    else if (/\.(ts|tsx)$/.test(p) && !p.includes('translations.ts')) files.push(p)
  }
  return files
}

const used = new Set()
// Préfixes utilisés via des variables (tableaux de clés) — indétectables statiquement.
const dynamicPrefixes = new Set(['analyzing.'])
for (const f of walk(srcDir)) {
  const c = readFileSync(f, 'utf8')
  for (const m of c.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1])
  for (const m of c.matchAll(/(?:labelKey|titleKey|introKey|descKey|key):\s*'([^']+)'/g)) used.add(m[1])
  for (const m of c.matchAll(/(?:labelKey|titleKey|introKey|descKey)\s*=\s*'([^']+)'/g)) used.add(m[1])
  for (const m of c.matchAll(/\bt\(\s*`([^`$]+)\$\{/g)) dynamicPrefixes.add(m[1])
  for (const m of c.matchAll(/'(docs\.[a-zA-Z.]+)'/g)) used.add(m[1])
  for (const m of c.matchAll(/'(chat\.group\.[a-z]+)'/g)) used.add(m[1])
}

const usedMissing = [...used].filter((k) => !frKeys.has(k) && (k.includes('.') ? true : false))
const definedUnused = [...frKeys].filter((k) => {
  if (used.has(k)) return false
  for (const p of dynamicPrefixes) if (k.startsWith(p)) return false
  return true
})

console.log('=== Parité FR/EN ===')
console.log('Clés FR:', frKeys.size, '| Clés EN:', enKeys.size)
console.log('Manquantes en EN:', missingInEn.length ? missingInEn : 'aucune')
console.log('Manquantes en FR:', missingInFr.length ? missingInFr : 'aucune')
console.log('\n=== Préfixes dynamiques ===', [...dynamicPrefixes])
console.log('\n=== Clés utilisées mais NON définies ===')
console.log(usedMissing.length ? usedMissing : 'aucune')
console.log('\n=== Clés définies mais NON utilisées ===')
console.log(definedUnused.length ? definedUnused : 'aucune')
