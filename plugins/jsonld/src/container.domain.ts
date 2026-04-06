import type { JsonLdNode } from './types.ts'

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
      'hasPart': memberNodes,
    },
    null,
    2,
  )
