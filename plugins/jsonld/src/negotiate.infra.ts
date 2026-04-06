import type { MiddlewareHandler } from 'astro'

export const createNegotiationMiddleware = (
  knownRoutes: ReadonlySet<string>,
): MiddlewareHandler =>
  async (context, next) => {
    const accept = context.request.headers.get('Accept') ?? ''
    if (!accept.includes('application/ld+json')) return next()
    if (!knownRoutes.has(context.url.pathname)) return next()

    const jsonldUrl = new URL(
      `${context.url.pathname}index.jsonld`,
      context.url.origin,
    )
    const response = await fetch(jsonldUrl)
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/ld+json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
