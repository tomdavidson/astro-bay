import type { PageSlice } from './types.ts'

export const paginate = <T>(
  entries: ReadonlyArray<T>,
  page: number,
  pageSize: number,
): PageSlice<T> => {
  const totalEntries = entries.length
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize))
  const clamped = Math.max(1, Math.min(page, totalPages))
  const start = (clamped - 1) * pageSize
  return {
    entries: entries.slice(start, start + pageSize),
    currentPage: clamped,
    totalPages,
    totalEntries,
    hasPrev: clamped > 1,
    hasNext: clamped < totalPages,
    prevPage: clamped > 1 ? clamped - 1 : undefined,
    nextPage: clamped < totalPages ? clamped + 1 : undefined,
  }
}
