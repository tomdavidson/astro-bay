/// <reference types="astro/client" />

declare module 'astro-content-hub:config' {
  import type { ResolvedConfig } from './config.ts'
  const config: Omit<ResolvedConfig, 'transforms'> & { readonly transforms?: ReadonlyArray<ResolvedConfig['transforms'][number]> } & { readonly astroCommand: string }
  export default config
}

declare module 'astro-content-hub:layout' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
  const Layout: AstroComponentFactory
  export default Layout
}
