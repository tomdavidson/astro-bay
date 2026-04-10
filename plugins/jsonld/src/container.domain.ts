import type { JsonLdNode } from './types.ts'

const JSON_INDENT = Number.parseInt('2', 10)

export const wrapAsContainer = (
  containerId: string,
  memberNodes: ReadonlyArray<JsonLdNode>,
  context: Record<string, string>,
): string =>
  JSON.stringify(
    {
      '@context': context,
      '@type': ['CollectionPage', 'ldp:BasicContainer'],
      '@id': containerId,
      'ldp:contains': memberNodes.map(n => ({ '@id': n['@id'] })),
      hasPart: memberNodes,
    },
    undefined,
    JSON_INDENT,
  )
