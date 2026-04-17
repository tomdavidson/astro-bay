// src/bin/derive.ts
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { buildCoOccurrenceMatrix } from '../cooccurrence.ts'
import { slugifyTopic } from '../slugify.ts'

const { values, positionals } = parseArgs({
  options: {
    output: { type: 'string', short: 'o', default: 'taxonomy.derived.json' },
    content: { type: 'string', short: 'c', multiple: true },
    field: { type: 'string', short: 'f', default: 'topics' },
    'min-count': { type: 'string', default: '2' },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
})

const command = positionals[0]

if (values.help || command !== 'derive') {
  console.log(`Usage: astro-taxonomy derive [options]

Options:
  -c, --content <dir>     Content directory to scan (repeatable)
  -o, --output <path>     Output file (default: taxonomy.derived.json)
  -f, --field <name>      Frontmatter field to read (default: topics)
      --min-count <n>     Minimum co-occurrence count (default: 2)
  -h, --help              Show this help`)
  process.exit(command === 'derive' || values.help ? 0 : 1)
}

const output = resolve(values.output ?? 'taxonomy.derived.json')
const field = values.field ?? 'topics'
const minCount = parseInt(values['min-count'] ?? '2', 10)
const contentDirs = values.content ?? []

if (contentDirs.length === 0) {
  console.error('[astro-taxonomy] No --content directories provided.')
  process.exit(1)
}

// Extract frontmatter topics from markdown files

const extractFrontmatter = (raw: string): Record<string, unknown> | null => {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match?.[1]) return null
  const obj: Record<string, unknown> = {}
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    let val: unknown = line.slice(colon + 1).trim()
    // Inline YAML array: [a, b, c]
    if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
    }
    obj[key] = val
  }
  return obj
}

const collectFiles = (dir: string): string[] => {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full))
    } else if (['.md', '.mdx'].includes(extname(full))) {
      results.push(full)
    }
  }
  return results
}

const entries: Array<{ topics: string[] }> = []

for (const dir of contentDirs) {
  const fullDir = resolve(dir)
  const files = collectFiles(fullDir)
  for (const file of files) {
    const raw = readFileSync(file, 'utf8')
    const fm = extractFrontmatter(raw)
    if (!fm) continue
    const topics = fm[field]
    if (Array.isArray(topics) && topics.length > 0) {
      entries.push({ topics: topics.map(String).map(slugifyTopic) })
    }
  }
}

console.log(`[astro-taxonomy] Scanned ${entries.length} entries from ${contentDirs.length} directory(s)`)

if (entries.length === 0) {
  console.warn('[astro-taxonomy] No entries with topics found. Writing empty taxonomy.')
  writeFileSync(output, JSON.stringify({ edges: [], synonyms: [] }, null, 2) + '\n')
  process.exit(0)
}

const matrix = buildCoOccurrenceMatrix(entries)

const edges: Array<{ parent: string; child: string; confidence: number; source: string }> = []
const seen = new Set<string>()

for (const [topic, row] of matrix) {
  for (const [related, count] of row) {
    if (count < minCount) continue
    const key = [topic, related].sort().join('::')
    if (seen.has(key)) continue
    seen.add(key)

    const topicTotal = [...(matrix.get(topic) ?? [])].reduce((s, [, c]) => s + c, 0)
    const relatedTotal = [...(matrix.get(related) ?? [])].reduce((s, [, c]) => s + c, 0)
    const confidence = count / Math.min(topicTotal, relatedTotal)

    const [parent, child] = topicTotal >= relatedTotal ? [topic, related] : [related, topic]
    edges.push({ parent, child, confidence: Math.round(confidence * 100) / 100, source: 'derived' })
  }
}

edges.sort((a, b) => b.confidence - a.confidence)
writeFileSync(output, JSON.stringify({ edges, synonyms: [] }, null, 2) + '\n')
console.log(`[astro-taxonomy] Wrote ${edges.length} edges to ${output}`)
