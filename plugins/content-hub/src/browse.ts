import type { ColumnDef } from '@tanstack/table-core'
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

export const createBrowseColumns = (): ReadonlyArray<ColumnDef<BrowseRow>> => [
  {
    id: 'title',
    accessorKey: 'title',
    header: 'Title',
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: 'date',
    accessorKey: 'date',
    header: 'Date',
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.getValue<string | null>('date')
      const b = rowB.getValue<string | null>('date')
      if (a == null && b == null) return 0
      if (a == null) return 1
      if (b == null) return -1
      return a.localeCompare(b)
    },
  },
  {
    id: 'topics',
    accessorKey: 'topics',
    header: 'Topics',
    enableColumnFilter: true,
    filterFn: (row, _columnId, filterValue: string[]) => {
      const topics = row.getValue<readonly string[]>('topics')
      if (filterValue.length === 0) return true
      return filterValue.some(f => topics.includes(f))
    },
  },
  {
    id: 'source',
    accessorKey: 'source',
    header: 'Source',
    enableColumnFilter: true,
  },
  {
    id: 'excerpt',
    accessorKey: 'excerpt',
    header: 'Excerpt',
    enableColumnFilter: true,
  },
  {
    id: 'uid',
    accessorKey: 'uid',
    header: 'UID',
    enableSorting: false,
    enableColumnFilter: false,
  },
]
