import type { ColumnDef, Row } from '@tanstack/table-core'
import type { NormalizedEntry } from './types.ts'

export type BrowseRow = {
  readonly uid: string
  readonly title: string
  readonly date: string | undefined
  readonly topics: readonly string[]
  readonly excerpt: string | undefined
  readonly source: string
}

export const toBrowseRow = (entry: NormalizedEntry): BrowseRow => ({
  uid: entry.uid,
  title: entry.title,
  date: entry.date?.toISOString(),
  topics: [...entry.topics],
  excerpt: entry.excerpt,
  source: entry.source,
})

export const toBrowseData = (
  entries: ReadonlyArray<NormalizedEntry>,
): ReadonlyArray<BrowseRow> => entries.map(toBrowseRow)

const compareDates = (rowA: Row<BrowseRow>, rowB: Row<BrowseRow>): number => {
  const a = rowA.getValue<string | undefined>('date')
  const b = rowB.getValue<string | undefined>('date')
  if (a === undefined && b === undefined) return 0
  if (a === undefined) return 1
  if (b === undefined) return -1
  return a.localeCompare(b)
}

const filterTopics = (
  row: Row<BrowseRow>,
  _columnId: string,
  filterValue: readonly string[],
): boolean => {
  const topics = row.getValue<readonly string[]>('topics')
  if (filterValue.length === 0) return true
  return filterValue.some(f => topics.includes(f))
}

const titleColumn: ColumnDef<BrowseRow> = { id: 'title', accessorKey: 'title', header: 'Title', enableSorting: true, enableColumnFilter: true }
const dateColumn: ColumnDef<BrowseRow> = { id: 'date', accessorKey: 'date', header: 'Date', enableSorting: true, sortingFn: compareDates }
const topicsColumn: ColumnDef<BrowseRow> = { id: 'topics', accessorKey: 'topics', header: 'Topics', enableColumnFilter: true, filterFn: filterTopics }
const sourceColumn: ColumnDef<BrowseRow> = { id: 'source', accessorKey: 'source', header: 'Source', enableColumnFilter: true }
const excerptColumn: ColumnDef<BrowseRow> = { id: 'excerpt', accessorKey: 'excerpt', header: 'Excerpt', enableColumnFilter: true }
const uidColumn: ColumnDef<BrowseRow> = { id: 'uid', accessorKey: 'uid', header: 'UID', enableSorting: false, enableColumnFilter: false }

export const createBrowseColumns = (): ReadonlyArray<ColumnDef<BrowseRow>> =>
  [titleColumn, dateColumn, topicsColumn, sourceColumn, excerptColumn, uidColumn]
