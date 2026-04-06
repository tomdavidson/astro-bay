export const buildAlternateLink = (route: string): string => {
  const jsonldPath = route.endsWith('/')
    ? `${route}index.jsonld`
    : `${route}/index.jsonld`
  return `<link rel="alternate" type="application/ld+json" href="${jsonldPath}">`
}
