import type { TypeRegistration } from './types.ts'

const JSON_INDENT = Number.parseInt('2', 10)

const registrationToNode = (site: string, r: TypeRegistration): Record<string, string> => ({
  '@type': 'solid:TypeRegistration',
  'solid:forClass': r.rdfType,
  'solid:instanceContainer': `${site}${r.containerPath}`,
  name: r.label,
})

export const buildTypeIndex = (
  site: string,
  context: Record<string, string>,
  registrations: ReadonlyArray<TypeRegistration>,
): string =>
  JSON.stringify(
    {
      '@context': { ...context, solid: 'http://www.w3.org/ns/solid/terms#' },
      '@type': 'WebSite',
      '@id': `${site}/`,
      hasPart: registrations.map(r => registrationToNode(site, r)),
    },
    undefined,
    JSON_INDENT,
  )
