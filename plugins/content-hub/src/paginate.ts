import type { PageSlice } from './types.ts'

const pageMeta = (
  page: number,
  totalPages: number,
  totalEntries: number,
): Pick<
  PageSlice<unknown>,
  'currentPage' | 'totalPages' | 'totalEntries' | 'hasPrev' | 'hasNext' | 'prevPage' | 'nextPage'
> => ({
  currentPage: page,
  totalPages,
  totalEntries,
  hasPrev: page > 1,
  hasNext: page < totalPages,
  prevPage: page > 1 ? page - 1 : undefined,
  nextPage: page < totalPages ? page + 1 : undefined,
})

export const paginate = <T>(entries: ReadonlyArray<T>, page: number, pageSize: number): PageSlice<T> => {
  const totalEntries = entries.length
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize))

  if (page < 1 || page > totalPages) {
    return { entries: [], ...pageMeta(page, totalPages, totalEntries) }
  }

  const start = (page - 1) * pageSize
  return { entries: entries.slice(start, start + pageSize), ...pageMeta(page, totalPages, totalEntries) }
}
