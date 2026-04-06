declare module 'astro-content-hub:config' {
    import type { ResolvedConfig } from 'astro-content-hub/config'

    const config: Omit<ResolvedConfig, 'transforms'> & {
        readonly astroCommand: string
    }

    export default config
}

declare module 'astro-content-hub:layout' {
    const Layout: unknown
    export default Layout
}